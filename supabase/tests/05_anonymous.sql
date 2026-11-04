-- Visitors who are not signed in (anon key) read nothing and write nothing.
begin;
\ir helpers.psql

select plan(9);

select tests.authenticate_as_anon();

select throws_ok('select * from public.profiles', '42501', null, 'anon cannot read profiles');
select throws_ok('select * from public.exercises', '42501', null, 'anon cannot read exercises');
select throws_ok(
  'select * from public.workout_templates', '42501', null, 'anon cannot read workout_templates'
);
select throws_ok(
  'select * from public.workout_template_exercises', '42501', null,
  'anon cannot read workout_template_exercises'
);
select throws_ok('select * from public.activities', '42501', null, 'anon cannot read activities');
select throws_ok('select * from public.gym_sets', '42501', null, 'anon cannot read gym_sets');
select throws_ok(
  'select * from public.swim_entries', '42501', null, 'anon cannot read swim_entries'
);

select throws_ok(
  $$ insert into public.activities (user_id, type, local_date, timezone)
     values ('aaaaaaaa-0000-0000-0000-000000000000', 'gym', '2026-11-04', 'UTC') $$,
  '42501', null,
  'anon cannot write'
);

reset role;

-- Every table in public must have RLS on, including tables added later.
select is_empty(
  $$ select tablename from pg_tables where schemaname = 'public' and not rowsecurity $$,
  'every table in public has row level security enabled'
);

select * from finish();
rollback;
