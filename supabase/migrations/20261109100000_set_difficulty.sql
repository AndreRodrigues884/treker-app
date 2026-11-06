-- How hard each gym set felt: easy, medium or hard, chosen by the athlete when the set is done.
-- It replaces RPE in the app (the rpe column stays, unused, so old data is kept). It never
-- affects records or stats.

create type public.set_difficulty as enum ('easy', 'medium', 'hard');

alter table public.gym_sets add column difficulty public.set_difficulty;

comment on column public.gym_sets.difficulty is
  'How hard the set felt (easy, medium, hard). Optional. Replaces rpe in the app.';

-- save_gym_session: the same function, now saving each set's difficulty instead of rpe.
create or replace function public.save_gym_session(p_session jsonb)
returns setof public.personal_records
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_activity_id uuid;
  v_sets jsonb;
begin
  if v_user_id is null then
    raise exception 'not signed in' using errcode = 'insufficient_privilege';
  end if;
  if pg_catalog.jsonb_typeof(p_session) is distinct from 'object' then
    raise exception 'p_session must be a JSON object' using errcode = 'invalid_parameter_value';
  end if;

  v_activity_id := (p_session ->> 'id')::uuid;
  v_sets := coalesce(p_session -> 'sets', '[]'::jsonb);
  if v_activity_id is null then
    raise exception 'p_session.id is required' using errcode = 'invalid_parameter_value';
  end if;
  if pg_catalog.jsonb_typeof(v_sets) <> 'array' then
    raise exception 'p_session.sets must be an array' using errcode = 'invalid_parameter_value';
  end if;

  insert into public.activities (
    id, user_id, type, local_date, timezone, started_at, ended_at, title, notes, template_id
  )
  values (
    v_activity_id,
    v_user_id,
    'gym',
    (p_session ->> 'local_date')::date,
    p_session ->> 'timezone',
    (p_session ->> 'started_at')::timestamptz,
    (p_session ->> 'ended_at')::timestamptz,
    nullif(pg_catalog.btrim(p_session ->> 'title'), ''),
    nullif(pg_catalog.btrim(p_session ->> 'notes'), ''),
    (p_session ->> 'template_id')::uuid
  )
  on conflict (id) do nothing;

  if not exists (
    select 1 from public.activities a where a.id = v_activity_id and a.user_id = v_user_id
  ) then
    raise exception 'activity % belongs to another user', v_activity_id
      using errcode = 'insufficient_privilege';
  end if;

  -- One statement for every set, so the records trigger rebuilds each exercise once.
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
  on conflict (id) do nothing;

  return query
  select r.*
  from public.personal_records r
  where r.activity_id = v_activity_id
  order by r.exercise_id, r.sequence;
end;
$$;

-- last_performance: returns each set's difficulty instead of rpe. Its result columns change, so
-- the function is dropped and created again (same arguments, same rules).
drop function public.last_performance(uuid[]);

create function public.last_performance(p_exercise_ids uuid[])
returns table (
  exercise_id uuid,
  activity_id uuid,
  local_date date,
  work_set_index integer,
  weight_kg numeric,
  reps smallint,
  duration_s integer,
  difficulty public.set_difficulty
)
language sql
stable
security invoker
set search_path = ''
as $$
  with latest as (
    select distinct on (s.exercise_id) s.exercise_id, s.activity_id, a.local_date
    from public.gym_sets s
    join public.activities a on a.id = s.activity_id
    where s.user_id = (select auth.uid())
      and s.exercise_id = any (p_exercise_ids)
      and s.deleted_at is null
      and not s.is_warmup
      and a.deleted_at is null
    order by s.exercise_id, a.local_date desc, a.started_at desc nulls last, a.id desc
  )
  select
    l.exercise_id,
    l.activity_id,
    l.local_date,
    (pg_catalog.row_number() over (
      partition by l.exercise_id order by s.exercise_position, s.set_number
    ))::integer,
    s.weight_kg,
    s.reps,
    s.duration_s,
    s.difficulty
  from latest l
  join public.gym_sets s
    on s.activity_id = l.activity_id
   and s.exercise_id = l.exercise_id
   and s.deleted_at is null
   and not s.is_warmup
  order by l.exercise_id, s.exercise_position, s.set_number;
$$;

revoke all on function public.last_performance(uuid[]) from public, anon;
grant execute on function public.last_performance(uuid[]) to authenticated;
