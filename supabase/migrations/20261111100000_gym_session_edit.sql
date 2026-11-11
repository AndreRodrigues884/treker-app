-- Phase 1c: editing a saved gym workout, and reading progress per exercise.
--
-- 1. The records triggers on gym_sets (insert) and activities (update) also skip while
--    treker.defer_record_rebuild is on, like the gym_sets and swim_entries update triggers
--    already do, so a function that changes a workout in several statements can rebuild each key
--    once at the end.
-- 2. private.rebuild_my_gym_keys: rebuilds the caller's own gym keys, for update_gym_session.
-- 3. update_gym_session: replaces a saved workout in one transaction.
-- 4. current_gym_records, exercise_progress, exercise_history: what the records and exercise
--    screens show, computed here so the app never loads every set.

-- 1. The flag on the remaining triggers ---------------------------------------------------------

create or replace function private.gym_sets_records_after_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- update_gym_session rebuilds these keys itself, once.
  if pg_catalog.current_setting('treker.defer_record_rebuild', true) = 'on' then
    return null;
  end if;

  perform private.rebuild_records(
    array(select row(n.user_id, n.exercise_id)::private.gym_key from new_rows n),
    null
  );
  return null;
end;
$$;

create or replace function private.activities_records_after_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_changed uuid[];
begin
  -- update_gym_session rebuilds these keys itself, once.
  if pg_catalog.current_setting('treker.defer_record_rebuild', true) = 'on' then
    return null;
  end if;

  v_changed := array(
    select n.id
    from old_rows o
    join new_rows n on n.id = o.id
    where (o.local_date, o.started_at, o.bodyweight_kg, o.deleted_at)
      is distinct from (n.local_date, n.started_at, n.bodyweight_kg, n.deleted_at)
  );

  if cardinality(v_changed) = 0 then
    return null;
  end if;

  perform private.rebuild_records(
    array(
      select row(s.user_id, s.exercise_id)::private.gym_key
      from public.gym_sets s
      where s.activity_id = any (v_changed)
    ),
    array(
      select row(w.user_id, w.stroke, w.distance, w.pool_length)::private.swim_key
      from public.swim_entries w
      where w.activity_id = any (v_changed)
    )
  );
  return null;
end;
$$;

-- 2. Rebuilding the caller's own keys ------------------------------------------------------------
-- Security definer (records are written only by the server), but it can only rebuild keys of
-- auth.uid(), from that user's own data, which is what the triggers would do anyway. It lives in
-- the private schema, which the API does not expose: only update_gym_session (security invoker)
-- calls it, hence the grant.

create function private.rebuild_my_gym_keys(p_exercise_ids uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
begin
  if v_user_id is null then
    raise exception 'not signed in' using errcode = 'insufficient_privilege';
  end if;
  perform private.rebuild_records(
    array(
      select distinct row(v_user_id, k.id)::private.gym_key
      from unnest(p_exercise_ids) as k (id)
      where k.id is not null
    ),
    null
  );
end;
$$;

revoke all on function private.rebuild_my_gym_keys(uuid[]) from public, anon;
grant execute on function private.rebuild_my_gym_keys(uuid[]) to authenticated;

-- The 1RM formula is plain arithmetic; the progress functions below (security invoker) use it.
grant execute on function private.estimate_one_rep_max(
  numeric, integer, boolean, public.exercise_unit, boolean, boolean, numeric
) to authenticated;

-- 3. update_gym_session(p_session jsonb) ---------------------------------------------------------
-- Replaces a saved gym workout in one request and one transaction:
--   - the activity's title, local date and start time (and timezone, when sent);
--   - its sets: those sent are upserted by id (new ones inserted, changed ones updated, removed
--     ones brought back), and the activity's other sets are marked deleted.
-- Records and stats are rebuilt once per key at the end, for the exercises before AND after the
-- change (an exercise taken out of the workout is rebuilt too). Repeating the same call leaves
-- the same data. Returns the records this workout holds afterwards.
--
-- p_session: the same shape as save_gym_session's (id, local_date, started_at, title,
-- template_id, sets[]), without ended_at.

create function public.update_gym_session(p_session jsonb)
returns setof public.personal_records
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_activity_id uuid;
  v_sets jsonb;
  v_keys uuid[];
begin
  if v_user_id is null then
    raise exception 'not signed in' using errcode = 'insufficient_privilege';
  end if;
  if pg_catalog.jsonb_typeof(p_session) is distinct from 'object' then
    raise exception 'p_session must be a JSON object' using errcode = 'invalid_parameter_value';
  end if;

  v_activity_id := (p_session ->> 'id')::uuid;
  v_sets := coalesce(p_session -> 'sets', '[]'::jsonb);
  if pg_catalog.jsonb_typeof(v_sets) <> 'array' then
    raise exception 'p_session.sets must be an array' using errcode = 'invalid_parameter_value';
  end if;

  -- The caller's own gym workout, not deleted. RLS hides everyone else's.
  perform 1
  from public.activities a
  where a.id = v_activity_id
    and a.user_id = v_user_id
    and a.type = 'gym'
    and a.deleted_at is null
  for update;
  if not found then
    raise exception 'gym workout % not found', v_activity_id using errcode = 'no_data_found';
  end if;

  -- Every exercise whose records may change: those in the workout now and those sent.
  v_keys := array(
    select s.exercise_id from public.gym_sets s
    where s.activity_id = v_activity_id and s.deleted_at is null
    union
    select (item ->> 'exercise_id')::uuid from pg_catalog.jsonb_array_elements(v_sets) as item
  );

  perform pg_catalog.set_config('treker.defer_record_rebuild', 'on', true);

  update public.activities a
  set title = nullif(pg_catalog.btrim(p_session ->> 'title'), ''),
      local_date = coalesce((p_session ->> 'local_date')::date, a.local_date),
      started_at = coalesce((p_session ->> 'started_at')::timestamptz, a.started_at),
      timezone = coalesce(p_session ->> 'timezone', a.timezone)
  where a.id = v_activity_id;

  -- The sets sent, upserted by id. A set id of another workout is never moved here.
  insert into public.gym_sets (
    id, user_id, activity_id, exercise_id, exercise_position, set_number,
    weight_kg, reps, duration_s, difficulty, is_warmup
  )
  select
    (item ->> 'id')::uuid,
    v_user_id,
    v_activity_id,
    (item ->> 'exercise_id')::uuid,
    (item ->> 'exercise_position')::smallint,
    (item ->> 'set_number')::smallint,
    (item ->> 'weight_kg')::numeric,
    (item ->> 'reps')::smallint,
    (item ->> 'duration_s')::integer,
    (item ->> 'difficulty')::public.set_difficulty,
    coalesce((item ->> 'is_warmup')::boolean, false)
  from pg_catalog.jsonb_array_elements(v_sets) as item
  on conflict (id) do update
  set exercise_id = excluded.exercise_id,
      exercise_position = excluded.exercise_position,
      set_number = excluded.set_number,
      weight_kg = excluded.weight_kg,
      reps = excluded.reps,
      duration_s = excluded.duration_s,
      difficulty = excluded.difficulty,
      is_warmup = excluded.is_warmup,
      deleted_at = null
  where public.gym_sets.activity_id = excluded.activity_id;

  -- The workout's other sets are gone.
  update public.gym_sets s
  set deleted_at = now()
  where s.activity_id = v_activity_id
    and s.deleted_at is null
    and s.id not in (
      select (item ->> 'id')::uuid from pg_catalog.jsonb_array_elements(v_sets) as item
    );

  perform pg_catalog.set_config('treker.defer_record_rebuild', 'off', true);
  perform private.rebuild_my_gym_keys(v_keys);

  return query
  select r.*
  from public.personal_records r
  where r.activity_id = v_activity_id
  order by r.exercise_id, r.sequence;
end;
$$;

revoke all on function public.update_gym_session(jsonb) from public, anon;
grant execute on function public.update_gym_session(jsonb) to authenticated;

-- 4. Reading ----------------------------------------------------------------------------------------

-- The current record of each exercise (or of one), with the set that gave it.
create function public.current_gym_records(p_exercise_id uuid default null)
returns table (
  exercise_id uuid,
  value numeric,
  previous_value numeric,
  local_date date,
  activity_id uuid,
  gym_set_id uuid,
  weight_kg numeric,
  reps smallint
)
language sql
stable
security invoker
set search_path = ''
as $$
  select r.exercise_id, r.value, r.previous_value, r.local_date, r.activity_id, r.gym_set_id,
         s.weight_kg, s.reps
  from public.current_records r
  left join public.gym_sets s on s.id = r.gym_set_id
  where r.user_id = (select auth.uid())
    and r.type = 'gym'
    and (p_exercise_id is null or r.exercise_id = p_exercise_id)
  order by r.local_date desc, r.exercise_id;
$$;

-- One point per workout with this exercise, oldest first, from p_from (all when null): the best
-- estimated 1RM of its work sets, its volume (weight × reps; assistance as zero) and sets, and
-- whether it set a record.
create function public.exercise_progress(p_exercise_id uuid, p_from date default null)
returns table (
  activity_id uuid,
  local_date date,
  started_at timestamptz,
  best_one_rep_max_kg numeric,
  volume_kg numeric,
  set_count integer,
  is_record boolean
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    a.id,
    a.local_date,
    a.started_at,
    max(private.estimate_one_rep_max(
      s.weight_kg, s.reps, s.is_warmup, e.unit, e.tracks_load, e.adds_bodyweight, a.bodyweight_kg
    )),
    coalesce(sum(greatest(coalesce(s.weight_kg, 0), 0) * coalesce(s.reps, 0)), 0),
    count(*)::integer,
    exists (
      select 1 from public.personal_records r
      where r.activity_id = a.id and r.exercise_id = p_exercise_id and r.type = 'gym'
    )
  from public.gym_sets s
  join public.activities a on a.id = s.activity_id
  join public.exercises e on e.id = s.exercise_id
  where s.user_id = (select auth.uid())
    and s.exercise_id = p_exercise_id
    and s.deleted_at is null
    and not s.is_warmup
    and a.deleted_at is null
    and (p_from is null or a.local_date >= p_from)
  group by a.id, a.local_date, a.started_at
  order by a.local_date, a.started_at nulls last, a.id;
$$;

-- The workouts with this exercise, newest first, one page at a time by the same cursor as the
-- workout list (local_date, started_at, id), each with its sets of this exercise in order.
create function public.exercise_history(
  p_exercise_id uuid,
  p_before_date date default null,
  p_before_started_at timestamptz default null,
  p_before_id uuid default null,
  p_limit integer default 20
)
returns table (
  activity_id uuid,
  title text,
  local_date date,
  started_at timestamptz,
  sets jsonb
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  if (p_before_date is null) <> (p_before_id is null)
     or (p_before_date is null and p_before_started_at is not null) then
    raise exception 'the cursor needs p_before_date and p_before_id (and that row''s started_at)'
      using errcode = 'invalid_parameter_value';
  end if;

  return query
  select
    a.id,
    a.title,
    a.local_date,
    a.started_at,
    (
      select pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'id', s.id, 'set_number', s.set_number, 'weight_kg', s.weight_kg, 'reps', s.reps,
          'duration_s', s.duration_s, 'difficulty', s.difficulty, 'is_warmup', s.is_warmup
        )
        order by s.exercise_position, s.set_number
      )
      from public.gym_sets s
      where s.activity_id = a.id and s.exercise_id = p_exercise_id and s.deleted_at is null
    )
  from public.activities a
  where a.user_id = (select auth.uid())
    and a.deleted_at is null
    and exists (
      select 1 from public.gym_sets s
      where s.activity_id = a.id and s.exercise_id = p_exercise_id and s.deleted_at is null
    )
    and (
      p_before_date is null
      or a.local_date < p_before_date
      or (
        a.local_date = p_before_date
        and case
          when p_before_started_at is null
            then a.started_at is null and a.id < p_before_id
          else
            a.started_at < p_before_started_at
            or a.started_at is null
            or (a.started_at = p_before_started_at and a.id < p_before_id)
        end
      )
    )
  order by a.local_date desc, a.started_at desc nulls last, a.id desc
  limit least(greatest(coalesce(p_limit, 20), 1), 50);
end;
$$;

revoke all on function public.current_gym_records(uuid) from public, anon;
grant execute on function public.current_gym_records(uuid) to authenticated;
revoke all on function public.exercise_progress(uuid, date) from public, anon;
grant execute on function public.exercise_progress(uuid, date) to authenticated;
revoke all on function public.exercise_history(uuid, date, timestamptz, uuid, integer)
from public, anon;
grant execute on function public.exercise_history(uuid, date, timestamptz, uuid, integer)
to authenticated;
