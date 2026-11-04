-- The database 1RM matches the shared cases also used by the app's Jest tests
-- (src/core/records/records.test.ts). pg_prove runs psql from supabase/tests.
begin;
set local client_min_messages = warning;
create extension if not exists pgtap with schema extensions;

\set cases `cat fixtures/one-rep-max-cases.json`

select plan((select jsonb_array_length(:'cases'::jsonb)));

select is(
  private.estimate_one_rep_max(
    (c -> 'input' ->> 'weightKg')::numeric,
    (c -> 'input' ->> 'reps')::integer,
    (c -> 'input' ->> 'isWarmup')::boolean,
    (c -> 'input' ->> 'unit')::public.exercise_unit,
    (c -> 'input' ->> 'tracksLoad')::boolean,
    (c -> 'input' ->> 'addsBodyweight')::boolean,
    (c -> 'input' ->> 'bodyweightKg')::numeric
  ),
  (c ->> 'expected')::numeric,
  c ->> 'name'
)
from jsonb_array_elements(:'cases'::jsonb) as c;

select * from finish();
rollback;
