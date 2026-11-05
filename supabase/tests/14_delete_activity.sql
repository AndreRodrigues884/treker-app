-- delete_activity(): the activity and its children in one call, records rebuilt once per key.
begin;
\ir helpers.psql

select plan(18);

select tests.authenticate_as('aaaaaaaa-0000-0000-0000-000000000000');

-- Two gym sessions on the bench press: the second one sets the current record.
select tests.add_activity('gym', '2026-10-01', 'aaaaaaaa-0000-0000-0005-000000000001');
select tests.add_set('aaaaaaaa-0000-0000-0005-000000000001', 'barbell-bench-press', 100, 5, 1);
select tests.add_activity('gym', '2026-10-08', 'aaaaaaaa-0000-0000-0005-000000000002');
select tests.add_set('aaaaaaaa-0000-0000-0005-000000000002', 'barbell-bench-press', 110, 5, 1);
select tests.add_set('aaaaaaaa-0000-0000-0005-000000000002', 'barbell-bench-press', 112.5, 5, 2);
select tests.add_set('aaaaaaaa-0000-0000-0005-000000000002', 'deadlift', 150, 5, 3);
-- A swim session.
select tests.add_activity('swim', '2026-10-09', 'aaaaaaaa-0000-0000-0005-000000000003');
select tests.add_swim('aaaaaaaa-0000-0000-0005-000000000003', 'free', 50, '25m', 2900, 'race');
select tests.add_swim('aaaaaaaa-0000-0000-0005-000000000003', 'back', 50, '25m', 3300, 'race');

select results_eq(
  $$ select value from public.current_records
     where exercise_id = tests.exercise('barbell-bench-press') $$,
  $$ values (131.25) $$,
  'before: the second session holds the bench press record (112.5 x 5)'
);

-- Deleting a gym activity ------------------------------------------------------------------------

select tests.reset_rebuild_count();

select lives_ok(
  $$ select public.delete_activity('aaaaaaaa-0000-0000-0005-000000000002') $$,
  'a user deletes their own activity in one call'
);

select is(
  tests.rebuild_count(),
  2,
  'records are rebuilt once per key (bench press and deadlift), not once per statement'
);

select is(
  (select deleted_at is not null from public.activities
   where id = 'aaaaaaaa-0000-0000-0005-000000000002'),
  true,
  'the activity is marked deleted'
);

select is(
  (select count(*)::int from public.gym_sets
   where activity_id = 'aaaaaaaa-0000-0000-0005-000000000002' and deleted_at is null),
  0,
  'all its sets are marked deleted'
);

select is(
  (select count(distinct deleted_at)::int from public.gym_sets
   where activity_id = 'aaaaaaaa-0000-0000-0005-000000000002'),
  1,
  'with the same deletion time, in one transaction'
);

select results_eq(
  $$ select value, local_date from public.current_records
     where exercise_id = tests.exercise('barbell-bench-press') $$,
  $$ values (116.67, date '2026-10-01') $$,
  'the bench press record goes back to the first session'
);

select is_empty(
  $$ select 1 from public.personal_records where exercise_id = tests.exercise('deadlift') $$,
  'the deadlift, only in the deleted session, has no record left'
);

select results_eq(
  $$ select set_count from public.exercise_stats
     where exercise_id = tests.exercise('barbell-bench-press') $$,
  $$ values (1) $$,
  'stats no longer count the deleted sets'
);

-- Repeating -------------------------------------------------------------------------------------

select tests.reset_rebuild_count();

select lives_ok(
  $$ select public.delete_activity('aaaaaaaa-0000-0000-0005-000000000002') $$,
  'calling it again (a retry) does not fail'
);

select is(tests.rebuild_count(), 0, 'and changes nothing: no rebuild');

-- After the call: the flag is off and normal edits rebuild again --------------------------------

select is(
  pg_catalog.current_setting('treker.defer_record_rebuild', true) is distinct from 'on',
  true,
  'after delete_activity the defer flag is off'
);

select ok(
  (select pg_catalog.strpos(
     p.prosrc, $q$set_config('treker.defer_record_rebuild', 'on', true)$q$) > 0
   from pg_catalog.pg_proc p
   where p.oid = 'public.delete_activity(uuid)'::pg_catalog.regprocedure),
  'the flag is set with set_config(..., true), so it is local to the transaction'
);

select tests.reset_rebuild_count();
update public.gym_sets set weight_kg = 105
where activity_id = 'aaaaaaaa-0000-0000-0005-000000000001';

select results_eq(
  $$ select tests.rebuild_count(), (select value from public.current_records
     where exercise_id = tests.exercise('barbell-bench-press')) $$,
  $$ values (1, 122.5) $$,
  'a normal edit of a set rebuilds its record again (105 x 5)'
);

-- Deleting a swim activity -----------------------------------------------------------------------

select tests.reset_rebuild_count();
select public.delete_activity('aaaaaaaa-0000-0000-0005-000000000003');

select is(
  tests.rebuild_count(),
  2,
  'a swim activity rebuilds each of its events once (50 free and 50 back)'
);

select is_empty(
  $$ select 1 from public.swim_entries
     where activity_id = 'aaaaaaaa-0000-0000-0005-000000000003' and deleted_at is null $$,
  'its swim times are marked deleted'
);

-- Someone else's activity ------------------------------------------------------------------------

select throws_ok(
  $$ select public.delete_activity('bbbbbbbb-0000-0000-0000-00000000a001') $$,
  'P0002', null,
  'a user cannot delete another user''s activity (it is not found)'
);

-- Anonymous --------------------------------------------------------------------------------------

select tests.authenticate_as_anon();

select throws_ok(
  $$ select public.delete_activity('aaaaaaaa-0000-0000-0005-000000000001') $$,
  '42501', null,
  'anon cannot call it'
);

select * from finish();
rollback;
