-- update_gym_session(), and the reading functions of the records and exercise screens.
begin;
\ir helpers.psql

select plan(24);

select tests.authenticate_as('aaaaaaaa-0000-0000-0000-000000000000');

-- Two workouts: W1 (Oct 1) bench 100 x 5 and deadlift 150 x 5; W2 (Oct 8) bench 110 x 5.
-- Bench records: W1 116.67, then W2 128.33. Deadlift: W1 175.
select public.save_gym_session(jsonb_build_object(
  'id', 'aaaaaaaa-0000-0000-000a-000000000001', 'local_date', '2026-10-01',
  'timezone', 'Europe/Lisbon', 'started_at', '2026-10-01 09:00+00', 'title', 'W1',
  'sets', jsonb_build_array(
    jsonb_build_object('id', 'aaaaaaaa-0000-0000-000a-000000000101',
      'exercise_id', tests.exercise('barbell-bench-press'), 'exercise_position', 0,
      'set_number', 1, 'weight_kg', 100, 'reps', 5, 'difficulty', 'medium'),
    jsonb_build_object('id', 'aaaaaaaa-0000-0000-000a-000000000102',
      'exercise_id', tests.exercise('deadlift'), 'exercise_position', 1,
      'set_number', 1, 'weight_kg', 150, 'reps', 5))));
select public.save_gym_session(jsonb_build_object(
  'id', 'aaaaaaaa-0000-0000-000a-000000000002', 'local_date', '2026-10-08',
  'timezone', 'Europe/Lisbon', 'started_at', '2026-10-08 09:00+00', 'title', 'W2',
  'sets', jsonb_build_array(
    jsonb_build_object('id', 'aaaaaaaa-0000-0000-000a-000000000201',
      'exercise_id', tests.exercise('barbell-bench-press'), 'exercise_position', 0,
      'set_number', 1, 'weight_kg', 110, 'reps', 5))));

-- Reading: records, progress, history ---------------------------------------------------------

select results_eq(
  $$ select value, local_date, weight_kg, reps::int
     from public.current_gym_records(tests.exercise('barbell-bench-press')) $$,
  $$ values (128.33::numeric, date '2026-10-08', 110.000::numeric, 5) $$,
  'current_gym_records: the record with the set that gave it'
);

select results_eq(
  $$ select local_date, best_one_rep_max_kg, volume_kg, set_count, is_record
     from public.exercise_progress(tests.exercise('barbell-bench-press')) $$,
  $$ values (date '2026-10-01', 116.67::numeric, 500.000::numeric, 1, true),
            (date '2026-10-08', 128.33::numeric, 550.000::numeric, 1, true) $$,
  'exercise_progress: one point per workout, oldest first, with its best 1RM and volume'
);

select results_eq(
  $$ select local_date from public.exercise_progress(
       tests.exercise('barbell-bench-press'), date '2026-10-05') $$,
  $$ values (date '2026-10-08') $$,
  'exercise_progress from a date leaves out the older workouts'
);

select results_eq(
  $$ select activity_id, title, jsonb_array_length(sets),
            sets -> 0 ->> 'weight_kg', sets -> 0 ->> 'difficulty'
     from public.exercise_history(tests.exercise('barbell-bench-press'), p_limit => 1) $$,
  $$ values ('aaaaaaaa-0000-0000-000a-000000000002'::uuid, 'W2', 1, '110.000', null::text) $$,
  'exercise_history: newest workout first, with its sets of this exercise'
);

select results_eq(
  $$ select activity_id, sets -> 0 ->> 'difficulty' from public.exercise_history(
       tests.exercise('barbell-bench-press'), '2026-10-08', '2026-10-08 09:00+00',
       'aaaaaaaa-0000-0000-000a-000000000002', 1) $$,
  $$ values ('aaaaaaaa-0000-0000-000a-000000000001'::uuid, 'medium') $$,
  'and the next page by cursor'
);

-- Editing a set that was a record ---------------------------------------------------------------

select tests.reset_rebuild_count();

select is_empty(
  $$ select 1 from public.update_gym_session(jsonb_build_object(
       'id', 'aaaaaaaa-0000-0000-000a-000000000002', 'local_date', '2026-10-08',
       'started_at', '2026-10-08 09:00+00', 'title', 'W2',
       'sets', jsonb_build_array(
         jsonb_build_object('id', 'aaaaaaaa-0000-0000-000a-000000000201',
           'exercise_id', tests.exercise('barbell-bench-press'), 'exercise_position', 0,
           'set_number', 1, 'weight_kg', 90, 'reps', 5, 'difficulty', 'easy')))) $$,
  'W2''s set lowered to 90 x 5: W2 holds no record any more'
);

select results_eq(
  $$ select value, activity_id from public.personal_records
     where exercise_id = tests.exercise('barbell-bench-press') order by sequence $$,
  $$ values (116.67::numeric, 'aaaaaaaa-0000-0000-000a-000000000001'::uuid) $$,
  'the record history is rebuilt: only W1''s 116.67 is left'
);

select is(tests.rebuild_count(), 1, 'one rebuild for the one exercise');

select results_eq(
  $$ select weight_kg, difficulty::text from public.gym_sets
     where id = 'aaaaaaaa-0000-0000-000a-000000000201' $$,
  $$ values (90.000::numeric, 'easy'::text) $$,
  'the set is changed in place, with its difficulty'
);

-- Taking an exercise out ---------------------------------------------------------------------------

select tests.reset_rebuild_count();

select lives_ok(
  $$ select public.update_gym_session(jsonb_build_object(
       'id', 'aaaaaaaa-0000-0000-000a-000000000001', 'local_date', '2026-10-01',
       'started_at', '2026-10-01 09:00+00', 'title', 'W1 edited',
       'sets', jsonb_build_array(
         jsonb_build_object('id', 'aaaaaaaa-0000-0000-000a-000000000101',
           'exercise_id', tests.exercise('barbell-bench-press'), 'exercise_position', 0,
           'set_number', 1, 'weight_kg', 100, 'reps', 5, 'difficulty', 'medium')))) $$,
  'W1 without the deadlift'
);

select is_empty(
  $$ select 1 from public.personal_records where exercise_id = tests.exercise('deadlift') $$,
  'the deadlift key is rebuilt too: its record is gone'
);

select is(tests.rebuild_count(), 2, 'once per key: the bench press and the deadlift');

select results_eq(
  $$ select deleted_at is not null from public.gym_sets
     where id = 'aaaaaaaa-0000-0000-000a-000000000102' $$,
  $$ values (true) $$,
  'the deadlift set is marked deleted, not removed'
);

select results_eq(
  $$ select title from public.activities where id = 'aaaaaaaa-0000-0000-000a-000000000001' $$,
  $$ values ('W1 edited'::text) $$,
  'the title changed'
);

-- Changing the date ----------------------------------------------------------------------------------

create temporary table w1_after_oct_8 as
select jsonb_build_object(
  'id', 'aaaaaaaa-0000-0000-000a-000000000001', 'local_date', '2026-10-15',
  'started_at', '2026-10-15 18:00+00', 'title', 'W1 edited',
  'sets', jsonb_build_array(
    jsonb_build_object('id', 'aaaaaaaa-0000-0000-000a-000000000101',
      'exercise_id', tests.exercise('barbell-bench-press'), 'exercise_position', 0,
      'set_number', 1, 'weight_kg', 100, 'reps', 5, 'difficulty', 'medium'),
    jsonb_build_object('id', 'aaaaaaaa-0000-0000-000a-000000000103',
      'exercise_id', tests.exercise('barbell-bench-press'), 'exercise_position', 0,
      'set_number', 2, 'weight_kg', 95, 'reps', 5))
) as payload;

select results_eq(
  $$ select value, activity_id from public.update_gym_session((select payload from w1_after_oct_8))
     order by sequence $$,
  $$ values (116.67::numeric, 'aaaaaaaa-0000-0000-000a-000000000001'::uuid) $$,
  'moved after W2 (with a new set): returns the records it holds now'
);

select results_eq(
  $$ select value, local_date, sequence from public.personal_records
     where exercise_id = tests.exercise('barbell-bench-press') order by sequence $$,
  $$ values (105.00::numeric, date '2026-10-08', 1), (116.67::numeric, date '2026-10-15', 2) $$,
  'the records are put back in date order: W2 first, then W1'
);

-- Repeating -------------------------------------------------------------------------------------------

create temporary table before_retry as
select id, weight_kg, reps, set_number, deleted_at from public.gym_sets
where activity_id = 'aaaaaaaa-0000-0000-000a-000000000001';

select lives_ok(
  $$ select public.update_gym_session((select payload from w1_after_oct_8)) $$,
  'repeating the same call does not fail'
);

select results_eq(
  $$ select id, weight_kg, reps, set_number, deleted_at from public.gym_sets
     where activity_id = 'aaaaaaaa-0000-0000-000a-000000000001' order by id $$,
  $$ select * from before_retry order by id $$,
  'and leaves the same sets'
);

select results_eq(
  $$ select value, local_date, sequence from public.personal_records
     where exercise_id = tests.exercise('barbell-bench-press') order by sequence $$,
  $$ values (105.00::numeric, date '2026-10-08', 1), (116.67::numeric, date '2026-10-15', 2) $$,
  'and the same records'
);

select is(
  pg_catalog.current_setting('treker.defer_record_rebuild', true),
  'off',
  'the defer flag is off afterwards'
);

-- Other users ------------------------------------------------------------------------------------------

select throws_ok(
  $$ select * from public.update_gym_session(jsonb_build_object(
       'id', 'bbbbbbbb-0000-0000-0000-00000000a001', 'local_date', '2026-10-01',
       'sets', '[]'::jsonb)) $$,
  'P0002', null,
  'cannot edit another user''s workout (it is not found)'
);

select results_eq(
  $$ select count(*)::int from public.current_gym_records() r
     where r.exercise_id = 'bbbbbbbb-0000-0000-0000-00000000e001' $$,
  $$ values (0) $$,
  'other users'' records are not visible'
);

-- Anonymous ------------------------------------------------------------------------------------------

select tests.authenticate_as_anon();

select throws_ok(
  $$ select * from public.update_gym_session('{"id": "aaaaaaaa-0000-0000-000a-000000000001"}') $$,
  '42501', null,
  'anon cannot edit'
);

select throws_ok(
  $$ select * from public.exercise_progress(gen_random_uuid()) $$,
  '42501', null,
  'anon cannot read progress'
);

select * from finish();
rollback;
