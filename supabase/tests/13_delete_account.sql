-- delete_my_account(): removes the caller and all of their data, and nobody else's.
begin;
\ir helpers.psql

select plan(9);

-- helpers.psql gives Ana and Bruno a row in every table, including derived records and stats.
select ok(
  (select count(*) > 0 from public.personal_records
   where user_id = 'aaaaaaaa-0000-0000-0000-000000000000'),
  'Ana has derived data before deleting'
);

select is(
  (select prosecdef from pg_proc where oid = 'public.delete_my_account()'::regprocedure),
  true,
  'the function is security definer'
);

select ok(
  (select 'search_path=""' = any (proconfig) from pg_proc
   where oid = 'public.delete_my_account()'::regprocedure),
  'the function has a fixed, empty search_path'
);

-- Anonymous visitors --------------------------------------------------------------------------

select tests.authenticate_as_anon();

select throws_ok(
  'select public.delete_my_account()',
  '42501', null,
  'anon cannot call it'
);

reset role;

-- Ana deletes her account -------------------------------------------------------------------------

select tests.authenticate_as('aaaaaaaa-0000-0000-0000-000000000000');

select lives_ok(
  'select public.delete_my_account()',
  'a signed-in user deletes their own account'
);

reset role;

select is_empty(
  $$ select 1 from auth.users where id = 'aaaaaaaa-0000-0000-0000-000000000000' $$,
  'the auth user is gone'
);

select is_empty(
  $$ select 'profiles' from public.profiles where id = 'aaaaaaaa-0000-0000-0000-000000000000'
     union all select 'exercises' from public.exercises
       where owner_id = 'aaaaaaaa-0000-0000-0000-000000000000'
     union all select 'workout_templates' from public.workout_templates
       where user_id = 'aaaaaaaa-0000-0000-0000-000000000000'
     union all select 'workout_template_exercises' from public.workout_template_exercises
       where user_id = 'aaaaaaaa-0000-0000-0000-000000000000'
     union all select 'activities' from public.activities
       where user_id = 'aaaaaaaa-0000-0000-0000-000000000000'
     union all select 'gym_sets' from public.gym_sets
       where user_id = 'aaaaaaaa-0000-0000-0000-000000000000'
     union all select 'swim_entries' from public.swim_entries
       where user_id = 'aaaaaaaa-0000-0000-0000-000000000000'
     union all select 'personal_records' from public.personal_records
       where user_id = 'aaaaaaaa-0000-0000-0000-000000000000'
     union all select 'exercise_stats' from public.exercise_stats
       where user_id = 'aaaaaaaa-0000-0000-0000-000000000000' $$,
  'all of their data is gone, in every table'
);

select results_eq(
  $$ select
       (select count(*) from auth.users where id = 'bbbbbbbb-0000-0000-0000-000000000000'),
       (select count(*) from public.profiles where id = 'bbbbbbbb-0000-0000-0000-000000000000'),
       (select count(*) from public.activities where user_id = 'bbbbbbbb-0000-0000-0000-000000000000'),
       (select count(*) from public.gym_sets where user_id = 'bbbbbbbb-0000-0000-0000-000000000000'),
       (select count(*) from public.swim_entries where user_id = 'bbbbbbbb-0000-0000-0000-000000000000'),
       (select count(*) from public.personal_records where user_id = 'bbbbbbbb-0000-0000-0000-000000000000') $$,
  $$ values (1::bigint, 1::bigint, 2::bigint, 1::bigint, 1::bigint, 2::bigint) $$,
  'another user''s account and data are untouched'
);

select is(
  (select count(*)::int from public.exercises where owner_id is null),
  68,
  'the shared exercise library is untouched'
);

select * from finish();
rollback;
