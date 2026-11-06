-- The gym session (phase 1b): saving a finished workout in one request, and "last time" for each
-- exercise while training.

-- save_gym_session(p_session jsonb) -------------------------------------------------------------
-- Saves a finished gym workout in one request and one transaction: the activity and all its sets,
-- with the ids made on the phone. Returns the personal records this activity set (after the
-- rebuild), so the app can show the official ones.
--
-- p_session:
--   {
--     "id": uuid, "local_date": "YYYY-MM-DD", "timezone": "Europe/Lisbon",
--     "started_at": timestamptz, "ended_at": timestamptz,
--     "title": text | null, "notes": text | null, "template_id": uuid | null,
--     "sets": [
--       { "id": uuid, "exercise_id": uuid, "exercise_position": int, "set_number": int,
--         "weight_kg": numeric | null, "reps": int | null, "duration_s": int | null,
--         "rpe": numeric | null, "is_warmup": bool }
--     ]
--   }
--
-- - Repeating the same call (a retry after a network failure) changes nothing: the activity and
--   every set are inserted with "on conflict do nothing" on their ids, and the records of the
--   activity are returned again.
-- - All the sets go in ONE insert statement, so the statement-level records trigger on gym_sets
--   rebuilds each key (exercise) once, however many sets it has. The activity is inserted first
--   and has no sets yet, so it rebuilds nothing.
-- - Any invalid value (a check, a foreign key, another user's custom exercise) fails the whole
--   call: nothing is left behind.
-- - Security invoker: RLS and the table checks apply as for any write. An activity id that
--   belongs to someone else is not overwritten; the call fails.

create function public.save_gym_session(p_session jsonb)
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

  -- The id may already be taken by another user's activity (invisible here through RLS).
  if not exists (
    select 1 from public.activities a where a.id = v_activity_id and a.user_id = v_user_id
  ) then
    raise exception 'activity % belongs to another user', v_activity_id
      using errcode = 'insufficient_privilege';
  end if;

  insert into public.gym_sets (
    id, user_id, activity_id, exercise_id, exercise_position, set_number,
    weight_kg, reps, duration_s, rpe, is_warmup
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
    (item ->> 'rpe')::numeric,
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

revoke all on function public.save_gym_session(jsonb) from public, anon;
grant execute on function public.save_gym_session(jsonb) to authenticated;

-- last_performance(p_exercise_ids uuid[]) ------------------------------------------------------
-- "Last time" for each exercise: the work sets (no warm-ups, nothing deleted) of the most recent
-- workout (not deleted) in which the athlete did it, with its date. Most recent = the order of the
-- workout list (local_date desc, started_at desc nulls last, id desc). work_set_index numbers the
-- work sets 1, 2, 3... in the order they were done, so the app can show set N next to set N.

create function public.last_performance(p_exercise_ids uuid[])
returns table (
  exercise_id uuid,
  activity_id uuid,
  local_date date,
  work_set_index integer,
  weight_kg numeric,
  reps smallint,
  duration_s integer,
  rpe numeric
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
    s.rpe
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
