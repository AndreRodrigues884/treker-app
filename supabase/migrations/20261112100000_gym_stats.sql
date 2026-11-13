-- Phase 1d: gym statistics.
--
-- 1. The progress rule (the same as src/core/progress, tested against the shared
--    supabase/tests/fixtures/progress-cases.json): how an exercise did in a workout compared with
--    the previous workout (not deleted) in which the athlete did it.
-- 2. session_progress and template_progress: that rule per exercise of a workout, and per workout
--    done from a saved workout.
-- 3. one_rep_max_series, weekly_summary, volume_by_muscle_group, template_usage: what the
--    Statistics screen shows.
--
-- Everything is computed here, so the app never loads every set. Weeks run Monday to Sunday on
-- the athlete's local dates (activities.local_date is already the day in their timezone). All
-- reading functions are security invoker (the athlete's RLS applies) and only for authenticated.

-- 1. The progress rule ---------------------------------------------------------------------------

-- Monday of the week of a date (ISO weeks, as in Portugal). Plain date arithmetic, so it never
-- depends on the session timezone.
create function private.week_start(p_date date)
returns date
language sql
immutable
set search_path = ''
as $$
  select p_date - (extract(isodow from p_date)::integer - 1);
$$;

-- How an exercise did compared with the previous workout in which it was done.
--
-- The measure is the estimated 1RM of the best set (the 1RM rules: bodyweight included for
-- exercises that add it, 1 to 12 reps) when both workouts have a set that gives one (or, the
-- first time, when this one does). Otherwise timed exercises use their best time, and the others
-- the volume of the sets done (weight x reps, assistance as zero).
--
-- Result: 'up' when the measure rose by 0.5% or more, 'down' when it fell by 0.5% or more,
-- 'same' otherwise, and 'first' without a previous workout. Numeric arithmetic, so exact.
create function private.progress_compare(
  p_unit public.exercise_unit,
  p_has_previous boolean,
  p_current_one_rep_max numeric,
  p_current_duration integer,
  p_current_volume numeric,
  p_previous_one_rep_max numeric,
  p_previous_duration integer,
  p_previous_volume numeric
)
returns table (measure text, current_value numeric, previous_value numeric, result text)
language sql
immutable
set search_path = ''
as $$
  with chosen as (
    select case
      when p_current_one_rep_max is not null
        and (not p_has_previous or p_previous_one_rep_max is not null) then 'one_rep_max'
      when p_unit = 'seconds' then 'duration'
      else 'volume'
    end as measure
  ),
  valued as (
    select
      c.measure,
      case c.measure
        when 'one_rep_max' then p_current_one_rep_max
        when 'duration' then p_current_duration::numeric
        else coalesce(p_current_volume, 0)
      end as current_value,
      case
        when not p_has_previous then null
        when c.measure = 'one_rep_max' then p_previous_one_rep_max
        when c.measure = 'duration' then p_previous_duration::numeric
        else coalesce(p_previous_volume, 0)
      end as previous_value
    from chosen c
  )
  select
    v.measure,
    v.current_value,
    v.previous_value,
    case
      when not p_has_previous then 'first'
      -- 0.5% of the previous value: 200 x change >= |previous|.
      when v.current_value > v.previous_value
        and 200 * (v.current_value - v.previous_value) >= abs(v.previous_value) then 'up'
      when v.current_value < v.previous_value
        and 200 * (v.previous_value - v.current_value) >= abs(v.previous_value) then 'down'
      else 'same'
    end
  from valued v;
$$;

-- A workout's overall result from its exercises: more up than down is 'up', more down than up is
-- 'down', a tie is 'same', and a workout where every exercise was done for the first time is
-- 'first'.
create function private.overall_progress(
  p_up integer,
  p_same integer,
  p_down integer,
  p_first integer
)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_up + p_same + p_down = 0 then 'first'
    when p_up > p_down then 'up'
    when p_down > p_up then 'down'
    else 'same'
  end;
$$;

-- The functions below are security invoker; these three are plain arithmetic.
revoke all on function private.week_start(date) from public, anon;
grant execute on function private.week_start(date) to authenticated;
revoke all on function private.progress_compare(
  public.exercise_unit, boolean, numeric, integer, numeric, numeric, integer, numeric
) from public, anon;
grant execute on function private.progress_compare(
  public.exercise_unit, boolean, numeric, integer, numeric, numeric, integer, numeric
) to authenticated;
revoke all on function private.overall_progress(integer, integer, integer, integer)
from public, anon;
grant execute on function private.overall_progress(integer, integer, integer, integer)
to authenticated;

-- 2. Progress of a workout ---------------------------------------------------------------------------

-- For each exercise of one of the caller's gym workouts: the measure, today's value, the value and
-- date of the previous workout with that exercise (in any workout, saved or not), and the result.
-- Every row also carries the workout's summary: how many exercises went up, stayed, went down or
-- were new, and the overall result. "Previous" follows the workout list's order: local date, then
-- start time (none = earliest of the day), then id.
create function public.session_progress(p_activity_id uuid)
returns table (
  exercise_id uuid,
  exercise_position integer,
  measure text,
  current_value numeric,
  previous_value numeric,
  previous_date date,
  previous_activity_id uuid,
  result text,
  up_count integer,
  same_count integer,
  down_count integer,
  first_count integer,
  session_result text
)
language sql
stable
security invoker
set search_path = ''
as $$
  with this_workout as (
    select
      a.id,
      a.local_date,
      coalesce(a.started_at, '-infinity'::timestamptz) as started_key,
      a.bodyweight_kg
    from public.activities a
    where a.id = p_activity_id
      and a.user_id = (select auth.uid())
      and a.type = 'gym'
      and a.deleted_at is null
  ),
  today as (
    select
      s.exercise_id,
      min(s.exercise_position)::integer as position,
      e.unit,
      max(private.estimate_one_rep_max(
        s.weight_kg, s.reps, s.is_warmup, e.unit, e.tracks_load, e.adds_bodyweight,
        w.bodyweight_kg
      )) as best_one_rep_max,
      max(s.duration_s) as best_duration,
      sum(greatest(coalesce(s.weight_kg, 0), 0) * coalesce(s.reps, 0)) as volume
    from this_workout w
    join public.gym_sets s on s.activity_id = w.id
    join public.exercises e on e.id = s.exercise_id
    where s.deleted_at is null and not s.is_warmup
    group by s.exercise_id, e.unit
  ),
  compared as (
    select
      t.exercise_id,
      t.position,
      prev.local_date as previous_date,
      prev.id as previous_activity_id,
      c.measure,
      c.current_value,
      c.previous_value,
      c.result
    from today t
    cross join this_workout w
    -- The previous workout with this exercise (gym_sets (user_id, exercise_id)).
    left join lateral (
      select a.id, a.local_date, a.bodyweight_kg
      from public.gym_sets s
      join public.activities a on a.id = s.activity_id
      where s.user_id = (select auth.uid())
        and s.exercise_id = t.exercise_id
        and s.deleted_at is null
        and not s.is_warmup
        and a.deleted_at is null
        and (a.local_date, coalesce(a.started_at, '-infinity'::timestamptz), a.id)
          < (w.local_date, w.started_key, w.id)
      order by a.local_date desc, coalesce(a.started_at, '-infinity'::timestamptz) desc, a.id desc
      limit 1
    ) prev on true
    left join lateral (
      select
        max(private.estimate_one_rep_max(
          s.weight_kg, s.reps, s.is_warmup, e.unit, e.tracks_load, e.adds_bodyweight,
          prev.bodyweight_kg
        )) as best_one_rep_max,
        max(s.duration_s) as best_duration,
        sum(greatest(coalesce(s.weight_kg, 0), 0) * coalesce(s.reps, 0)) as volume
      from public.gym_sets s
      join public.exercises e on e.id = s.exercise_id
      where s.activity_id = prev.id
        and s.exercise_id = t.exercise_id
        and s.deleted_at is null
        and not s.is_warmup
    ) before on true
    cross join lateral private.progress_compare(
      t.unit, prev.id is not null,
      t.best_one_rep_max, t.best_duration, t.volume,
      before.best_one_rep_max, before.best_duration, before.volume
    ) c
  ),
  counted as (
    select
      c.*,
      (count(*) filter (where c.result = 'up') over ())::integer as up_count,
      (count(*) filter (where c.result = 'same') over ())::integer as same_count,
      (count(*) filter (where c.result = 'down') over ())::integer as down_count,
      (count(*) filter (where c.result = 'first') over ())::integer as first_count
    from compared c
  )
  select
    c.exercise_id,
    c.position,
    c.measure,
    c.current_value,
    c.previous_value,
    c.previous_date,
    c.previous_activity_id,
    c.result,
    c.up_count,
    c.same_count,
    c.down_count,
    c.first_count,
    private.overall_progress(c.up_count, c.same_count, c.down_count, c.first_count)
  from counted c
  order by c.position, c.exercise_id;
$$;

-- The last p_limit workouts done from one of the caller's saved workouts (from p_from; all when
-- null), oldest first, each with the progress of every exercise (as session_progress) and its
-- overall result. At most 20 workouts.
create function public.template_progress(
  p_template_id uuid,
  p_from date default null,
  p_limit integer default 8
)
returns table (
  activity_id uuid,
  local_date date,
  started_at timestamptz,
  exercise_id uuid,
  exercise_position integer,
  measure text,
  current_value numeric,
  previous_value numeric,
  result text,
  session_result text
)
language sql
stable
security invoker
set search_path = ''
as $$
  with recent as (
    select a.id, a.local_date, a.started_at
    from public.activities a
    where a.user_id = (select auth.uid())
      and a.template_id = p_template_id
      and a.type = 'gym'
      and a.deleted_at is null
      and (p_from is null or a.local_date >= p_from)
    order by a.local_date desc, coalesce(a.started_at, '-infinity'::timestamptz) desc, a.id desc
    limit least(greatest(coalesce(p_limit, 8), 1), 20)
  )
  select
    r.id,
    r.local_date,
    r.started_at,
    p.exercise_id,
    p.exercise_position,
    p.measure,
    p.current_value,
    p.previous_value,
    p.result,
    p.session_result
  from recent r
  cross join lateral public.session_progress(r.id) p
  order by r.local_date, coalesce(r.started_at, '-infinity'::timestamptz), r.id, p.exercise_position;
$$;

-- 3. Statistics ----------------------------------------------------------------------------------------

-- The best estimated 1RM of each workout, per exercise (at most 5), oldest first, from p_from (all
-- when null). Workouts without a set that gives a 1RM are left out.
create function public.one_rep_max_series(p_exercise_ids uuid[], p_from date default null)
returns table (
  exercise_id uuid,
  activity_id uuid,
  local_date date,
  best_one_rep_max_kg numeric
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  if coalesce(cardinality(p_exercise_ids), 0) > 5 then
    raise exception 'at most 5 exercises' using errcode = 'invalid_parameter_value';
  end if;

  return query
  select
    s.exercise_id,
    a.id,
    a.local_date,
    max(private.estimate_one_rep_max(
      s.weight_kg, s.reps, s.is_warmup, e.unit, e.tracks_load, e.adds_bodyweight, a.bodyweight_kg
    ))
  from public.gym_sets s
  join public.activities a on a.id = s.activity_id
  join public.exercises e on e.id = s.exercise_id
  where s.user_id = (select auth.uid())
    and s.exercise_id = any (p_exercise_ids)
    and s.deleted_at is null
    and not s.is_warmup
    and a.deleted_at is null
    and (p_from is null or a.local_date >= p_from)
  group by s.exercise_id, a.id, a.local_date, a.started_at
  having max(private.estimate_one_rep_max(
    s.weight_kg, s.reps, s.is_warmup, e.unit, e.tracks_load, e.adds_bodyweight, a.bodyweight_kg
  )) is not null
  order by s.exercise_id, a.local_date, coalesce(a.started_at, '-infinity'::timestamptz), a.id;
end;
$$;

-- Per week (Monday to Sunday) from the week of p_from (the first workout's when null) to the week
-- of p_to, including weeks without workouts (zero): the workouts of every sport, the gym workouts,
-- and the gym volume (weight x reps of the work sets, assistance as zero).
create function public.weekly_summary(p_from date, p_to date)
returns table (
  week_start date,
  workout_count integer,
  gym_count integer,
  volume_kg numeric
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_first date;
  v_last date;
begin
  if p_to is null or (p_from is not null and p_from > p_to) then
    raise exception 'p_to is required and not before p_from' using errcode = 'invalid_parameter_value';
  end if;

  v_first := private.week_start(coalesce(
    p_from,
    (select min(a.local_date) from public.activities a
     where a.user_id = v_user_id and a.deleted_at is null),
    p_to
  ));
  v_last := private.week_start(p_to);

  return query
  with weeks as (
    select d::date as week_start
    from pg_catalog.generate_series(v_first, v_last, interval '7 days') as d
  ),
  workouts as (
    select private.week_start(a.local_date) as week_start, a.type
    from public.activities a
    where a.user_id = v_user_id
      and a.deleted_at is null
      and a.local_date between v_first and v_last + 6
  ),
  volume as (
    select
      private.week_start(a.local_date) as week_start,
      sum(greatest(coalesce(s.weight_kg, 0), 0) * coalesce(s.reps, 0)) as volume_kg
    from public.activities a
    join public.gym_sets s on s.activity_id = a.id
    where a.user_id = v_user_id
      and a.deleted_at is null
      and a.type = 'gym'
      and a.local_date between v_first and v_last + 6
      and s.deleted_at is null
      and not s.is_warmup
    group by 1
  )
  select
    w.week_start,
    (select count(*) from workouts x where x.week_start = w.week_start)::integer,
    (select count(*) from workouts x where x.week_start = w.week_start and x.type = 'gym')::integer,
    coalesce((select v.volume_kg from volume v where v.week_start = w.week_start), 0)
  from weeks w
  order by w.week_start;
end;
$$;

-- The volume of the work sets per muscle group (the exercise's label) between two dates (from the
-- first workout when p_from is null), the largest first.
create function public.volume_by_muscle_group(p_from date, p_to date)
returns table (
  muscle_group public.muscle_group,
  volume_kg numeric,
  set_count integer
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    e.muscle_group,
    sum(greatest(coalesce(s.weight_kg, 0), 0) * coalesce(s.reps, 0)),
    count(*)::integer
  from public.activities a
  join public.gym_sets s on s.activity_id = a.id
  join public.exercises e on e.id = s.exercise_id
  where a.user_id = (select auth.uid())
    and a.deleted_at is null
    and a.type = 'gym'
    and (p_from is null or a.local_date >= p_from)
    and a.local_date <= p_to
    and s.deleted_at is null
    and not s.is_warmup
  group by e.muscle_group
  order by 2 desc, 3 desc, e.muscle_group;
$$;

-- How many times each saved workout (not deleted) was done between two dates (all when p_from is
-- null), and the last date, the most done first.
create function public.template_usage(p_from date, p_to date)
returns table (
  template_id uuid,
  name text,
  workout_count integer,
  last_date date
)
language sql
stable
security invoker
set search_path = ''
as $$
  select t.id, t.name, count(*)::integer, max(a.local_date)
  from public.activities a
  join public.workout_templates t on t.id = a.template_id
  where a.user_id = (select auth.uid())
    and a.template_id is not null
    and a.deleted_at is null
    and t.deleted_at is null
    and (p_from is null or a.local_date >= p_from)
    and a.local_date <= p_to
  group by t.id, t.name
  order by 3 desc, 4 desc, t.name;
$$;

-- template_usage and template_progress find the workouts of a saved workout.
create index activities_user_id_template_id_idx
on public.activities (user_id, template_id, local_date desc)
where template_id is not null;

revoke all on function public.session_progress(uuid) from public, anon;
grant execute on function public.session_progress(uuid) to authenticated;
revoke all on function public.template_progress(uuid, date, integer) from public, anon;
grant execute on function public.template_progress(uuid, date, integer) to authenticated;
revoke all on function public.one_rep_max_series(uuid[], date) from public, anon;
grant execute on function public.one_rep_max_series(uuid[], date) to authenticated;
revoke all on function public.weekly_summary(date, date) from public, anon;
grant execute on function public.weekly_summary(date, date) to authenticated;
revoke all on function public.volume_by_muscle_group(date, date) from public, anon;
grant execute on function public.volume_by_muscle_group(date, date) to authenticated;
revoke all on function public.template_usage(date, date) from public, anon;
grant execute on function public.template_usage(date, date) to authenticated;
