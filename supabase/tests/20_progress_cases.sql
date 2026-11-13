-- The progress rule in the database matches the shared cases also used by the app's Jest tests
-- (src/core/progress/progress.test.ts). Each case becomes real rows: an exercise of its own, the
-- previous workout (if any) a week before the current one, and their sets; session_progress then
-- compares them. pg_prove runs psql from supabase/tests.
begin;
\ir helpers.psql

\set cases `cat fixtures/progress-cases.json`

select plan(3 * (select jsonb_array_length(:'cases'::jsonb)));

create temporary table progress_cases on commit drop as
select
  x.i,
  x.c,
  md5('exercise-' || x.i)::uuid as exercise_id,
  md5('previous-' || x.i)::uuid as previous_id,
  md5('current-' || x.i)::uuid as current_id
from jsonb_array_elements(:'cases'::jsonb) with ordinality as x (c, i);
grant select on progress_cases to authenticated;

select tests.authenticate_as('aaaaaaaa-0000-0000-0000-000000000000');

-- One exercise per case, with the case's unit, load and bodyweight flags.
insert into public.exercises (
  id, owner_id, name_en, name_pt, muscle_group, equipment, unit, tracks_load, adds_bodyweight
)
select
  p.exercise_id,
  'aaaaaaaa-0000-0000-0000-000000000000',
  'Case ' || p.i,
  'Caso ' || p.i,
  'chest',
  'other',
  (p.c -> 'exercise' ->> 'unit')::public.exercise_unit,
  (p.c -> 'exercise' ->> 'tracksLoad')::boolean,
  (p.c -> 'exercise' ->> 'addsBodyweight')::boolean
from progress_cases p;

-- The previous workout on 1 Jan, the current one on 8 Jan.
insert into public.activities (id, type, local_date, timezone, bodyweight_kg)
select p.previous_id, 'gym'::public.activity_type, date '2026-01-01', 'Europe/Lisbon',
       (p.c -> 'previous' ->> 'bodyweightKg')::numeric
from progress_cases p
where jsonb_typeof(p.c -> 'previous') = 'object'
union all
select p.current_id, 'gym', date '2026-01-08', 'Europe/Lisbon',
       (p.c -> 'current' ->> 'bodyweightKg')::numeric
from progress_cases p;

insert into public.gym_sets (
  activity_id, exercise_id, exercise_position, set_number, weight_kg, reps, duration_s
)
select w.activity_id, p.exercise_id, 0, s.n, (s.v ->> 'weightKg')::numeric,
       (s.v ->> 'reps')::smallint, (s.v ->> 'durationS')::integer
from progress_cases p
cross join lateral (
  select p.previous_id as activity_id, p.c -> 'previous' -> 'sets' as sets
  where jsonb_typeof(p.c -> 'previous') = 'object'
  union all
  select p.current_id, p.c -> 'current' -> 'sets'
) w
cross join lateral jsonb_array_elements(w.sets) with ordinality as s (v, n);

select is(
  r.measure || ' / ' || r.result,
  (p.c -> 'expected' ->> 'measure') || ' / ' || (p.c -> 'expected' ->> 'result'),
  (p.c ->> 'name') || ': measure and result'
)
from progress_cases p
cross join lateral public.session_progress(p.current_id) r
order by p.i;

select is(
  r.current_value,
  (p.c -> 'expected' ->> 'current')::numeric,
  (p.c ->> 'name') || ': today''s value'
)
from progress_cases p
cross join lateral public.session_progress(p.current_id) r
order by p.i;

select is(
  r.previous_value,
  (p.c -> 'expected' ->> 'previous')::numeric,
  (p.c ->> 'name') || ': previous value'
)
from progress_cases p
cross join lateral public.session_progress(p.current_id) r
order by p.i;

select * from finish();
rollback;
