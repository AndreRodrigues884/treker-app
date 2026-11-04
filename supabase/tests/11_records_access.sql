-- Records and stats are read-only for users, and each user only sees their own.
begin;
\ir helpers.psql

select plan(17);

select tests.authenticate_as('aaaaaaaa-0000-0000-0000-000000000000');

-- No writes --------------------------------------------------------------------------------------

select throws_ok(
  $$ insert into public.personal_records
       (user_id, type, exercise_id, value, sequence, activity_id, gym_set_id, local_date)
     values ('aaaaaaaa-0000-0000-0000-000000000000', 'gym', 'aaaaaaaa-0000-0000-0000-00000000e001',
             500, 99, 'aaaaaaaa-0000-0000-0000-00000000a001',
             'aaaaaaaa-0000-0000-0000-00000000c001', '2026-11-03') $$,
  '42501', null,
  'a user cannot create records'
);
select throws_ok(
  $$ update public.personal_records set value = 500 $$,
  '42501', null,
  'a user cannot change records'
);
select throws_ok(
  $$ delete from public.personal_records $$,
  '42501', null,
  'a user cannot delete records'
);
select throws_ok(
  $$ insert into public.exercise_stats (user_id, exercise_id, total_volume_kg)
     values ('aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-00000000e001', 1e6) $$,
  '42501', null,
  'a user cannot create stats'
);
select throws_ok(
  $$ update public.exercise_stats set total_volume_kg = 1e6 $$,
  '42501', null,
  'a user cannot change stats'
);
select throws_ok(
  $$ delete from public.exercise_stats $$,
  '42501', null,
  'a user cannot delete stats'
);
select throws_ok(
  $$ select private.rebuild_records(null, null) $$,
  '42501', null,
  'a user cannot call the rebuild functions'
);

-- Reads ------------------------------------------------------------------------------------------

select isnt_empty(
  $$ select 1 from public.personal_records $$,
  'a user reads their own records'
);
select is_empty(
  $$ select 1 from public.personal_records
     where user_id <> 'aaaaaaaa-0000-0000-0000-000000000000' $$,
  'a user does not read other users'' records'
);
select is_empty(
  $$ select 1 from public.current_records
     where user_id <> 'aaaaaaaa-0000-0000-0000-000000000000' $$,
  'a user does not read other users'' current records'
);
select isnt_empty(
  $$ select 1 from public.exercise_stats $$,
  'a user reads their own stats'
);
select is_empty(
  $$ select 1 from public.exercise_stats
     where user_id <> 'aaaaaaaa-0000-0000-0000-000000000000' $$,
  'a user does not read other users'' stats'
);

-- Anonymous --------------------------------------------------------------------------------------

select tests.authenticate_as_anon();

select throws_ok('select * from public.personal_records', '42501', null,
  'anon cannot read records');
select throws_ok('select * from public.current_records', '42501', null,
  'anon cannot read current records');
select throws_ok('select * from public.exercise_stats', '42501', null,
  'anon cannot read stats');

reset role;

-- Bruno's derived rows exist and were not touched ------------------------------------------------

select results_eq(
  $$ select value from public.personal_records
     where user_id = 'bbbbbbbb-0000-0000-0000-000000000000' and type = 'gym' $$,
  $$ values (63.33) $$,
  'the other user''s record is intact (50 kg x 8)'
);
select results_eq(
  $$ select set_count from public.exercise_stats
     where user_id = 'bbbbbbbb-0000-0000-0000-000000000000' $$,
  $$ values (1) $$,
  'the other user''s stats are intact'
);

select * from finish();
rollback;
