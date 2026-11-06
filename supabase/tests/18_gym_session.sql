-- save_gym_session() and last_performance(): the gym session of phase 1b.
begin;
\ir helpers.psql

select plan(20);

select tests.authenticate_as('aaaaaaaa-0000-0000-0000-000000000000');

-- A whole session in one call -------------------------------------------------------------------

create temporary table push_a as
select jsonb_build_object(
  'id', 'aaaaaaaa-0000-0000-0009-000000000001',
  'local_date', '2026-10-20',
  'timezone', 'Europe/Lisbon',
  'started_at', '2026-10-20 09:00+00',
  'ended_at', '2026-10-20 10:10+00',
  'title', 'Push A',
  'notes', 'Felt strong',
  'template_id', 'aaaaaaaa-0000-0000-0000-00000000f001',
  'sets', jsonb_build_array(
    jsonb_build_object('id', 'aaaaaaaa-0000-0000-0009-000000000101',
      'exercise_id', tests.exercise('barbell-bench-press'), 'exercise_position', 0,
      'set_number', 1, 'weight_kg', 60, 'reps', 5, 'is_warmup', true),
    jsonb_build_object('id', 'aaaaaaaa-0000-0000-0009-000000000102',
      'exercise_id', tests.exercise('barbell-bench-press'), 'exercise_position', 0,
      'set_number', 2, 'weight_kg', 100, 'reps', 5, 'difficulty', 'easy'),
    jsonb_build_object('id', 'aaaaaaaa-0000-0000-0009-000000000103',
      'exercise_id', tests.exercise('barbell-bench-press'), 'exercise_position', 0,
      'set_number', 3, 'weight_kg', 105, 'reps', 3),
    jsonb_build_object('id', 'aaaaaaaa-0000-0000-0009-000000000104',
      'exercise_id', tests.exercise('overhead-press'), 'exercise_position', 1,
      'set_number', 1, 'weight_kg', 50, 'reps', 8, 'difficulty', 'hard'),
    jsonb_build_object('id', 'aaaaaaaa-0000-0000-0009-000000000105',
      'exercise_id', tests.exercise('plank'), 'exercise_position', 2,
      'set_number', 1, 'duration_s', 60)
  )
) as payload;

select tests.reset_rebuild_count();

select set_eq(
  $$ select exercise_id, value, gym_set_id, activity_id
     from public.save_gym_session((select payload from push_a)) $$,
  $$ values
       (tests.exercise('barbell-bench-press'), 116.67::numeric,
        'aaaaaaaa-0000-0000-0009-000000000102'::uuid, 'aaaaaaaa-0000-0000-0009-000000000001'::uuid),
       (tests.exercise('overhead-press'), 63.33::numeric,
        'aaaaaaaa-0000-0000-0009-000000000104'::uuid, 'aaaaaaaa-0000-0000-0009-000000000001'::uuid) $$,
  'saves the session in one call and returns the records it set (no warm-up, no timed set)'
);

select is(
  tests.rebuild_count(),
  3,
  'records are rebuilt once per exercise (3), not once per set (5)'
);

select results_eq(
  $$ select type::text, local_date, title, notes, template_id, ended_at - started_at
     from public.activities where id = 'aaaaaaaa-0000-0000-0009-000000000001' $$,
  $$ values ('gym', date '2026-10-20', 'Push A', 'Felt strong',
             'aaaaaaaa-0000-0000-0000-00000000f001'::uuid, interval '70 minutes') $$,
  'the activity has the athlete''s local date, times, title, notes and template'
);

select results_eq(
  $$ select id, exercise_position::int, set_number::int, weight_kg, reps::int, difficulty::text,
            is_warmup
     from public.gym_sets where activity_id = 'aaaaaaaa-0000-0000-0009-000000000001'
     order by exercise_position, set_number $$,
  $$ values
       ('aaaaaaaa-0000-0000-0009-000000000101'::uuid, 0, 1, 60.000::numeric, 5, null::text, true),
       ('aaaaaaaa-0000-0000-0009-000000000102'::uuid, 0, 2, 100.000, 5, 'easy', false),
       ('aaaaaaaa-0000-0000-0009-000000000103'::uuid, 0, 3, 105.000, 3, null, false),
       ('aaaaaaaa-0000-0000-0009-000000000104'::uuid, 1, 1, 50.000, 8, 'hard', false),
       ('aaaaaaaa-0000-0000-0009-000000000105'::uuid, 2, 1, null, null, null, false) $$,
  'every set is saved with the ids made on the phone and how hard it felt'
);

select throws_ok(
  $$ select * from public.save_gym_session(jsonb_build_object(
       'id', 'aaaaaaaa-0000-0000-0009-000000000007', 'local_date', '2026-10-21',
       'timezone', 'Europe/Lisbon',
       'sets', jsonb_build_array(
         jsonb_build_object('id', 'aaaaaaaa-0000-0000-0009-000000000701',
           'exercise_id', tests.exercise('barbell-bench-press'), 'exercise_position', 0,
           'set_number', 1, 'weight_kg', 100, 'reps', 5, 'difficulty', 'brutal')))) $$,
  '22P02', null,
  'a difficulty other than easy, medium or hard is refused'
);

-- Repeating (a retry) ---------------------------------------------------------------------------

select tests.reset_rebuild_count();

select is(
  (select count(*)::int from public.save_gym_session((select payload from push_a))),
  2,
  'repeating the same call returns the same records'
);

select results_eq(
  $$ select (select count(*)::int from public.activities
             where id = 'aaaaaaaa-0000-0000-0009-000000000001'),
            (select count(*)::int from public.gym_sets
             where activity_id = 'aaaaaaaa-0000-0000-0009-000000000001'),
            (select count(*)::int from public.personal_records
             where activity_id = 'aaaaaaaa-0000-0000-0009-000000000001') $$,
  $$ values (1, 5, 2) $$,
  'and duplicates nothing: one activity, five sets, two records'
);

select is(tests.rebuild_count(), 0, 'and rebuilds nothing');

-- A failure half way leaves nothing ---------------------------------------------------------------

select throws_ok(
  $$ select * from public.save_gym_session(jsonb_build_object(
       'id', 'aaaaaaaa-0000-0000-0009-000000000002', 'local_date', '2026-10-21',
       'timezone', 'Europe/Lisbon', 'started_at', '2026-10-21 09:00+00',
       'ended_at', '2026-10-21 10:00+00',
       'sets', jsonb_build_array(
         jsonb_build_object('id', 'aaaaaaaa-0000-0000-0009-000000000201',
           'exercise_id', tests.exercise('barbell-bench-press'), 'exercise_position', 0,
           'set_number', 1, 'weight_kg', 100, 'reps', 5),
         jsonb_build_object('id', 'aaaaaaaa-0000-0000-0009-000000000202',
           'exercise_id', tests.exercise('barbell-bench-press'), 'exercise_position', 0,
           'set_number', 2, 'weight_kg', 100, 'reps', 0)))) $$,
  '23514', null,
  'an invalid set (0 reps) fails the call'
);

select is_empty(
  $$ select 1 from public.activities where id = 'aaaaaaaa-0000-0000-0009-000000000002'
     union all
     select 1 from public.gym_sets where id = 'aaaaaaaa-0000-0000-0009-000000000201' $$,
  'and leaves nothing behind: no activity, not even the valid set'
);

-- Other users ------------------------------------------------------------------------------------

select throws_ok(
  $$ select * from public.save_gym_session(jsonb_build_object(
       'id', 'aaaaaaaa-0000-0000-0009-000000000003', 'local_date', '2026-10-21',
       'timezone', 'Europe/Lisbon',
       'sets', jsonb_build_array(
         jsonb_build_object('id', 'aaaaaaaa-0000-0000-0009-000000000301',
           'exercise_id', 'bbbbbbbb-0000-0000-0000-00000000e001', 'exercise_position', 0,
           'set_number', 1, 'weight_kg', 20, 'reps', 10)))) $$,
  '23503', null,
  'cannot use another user''s custom exercise'
);

select is_empty(
  $$ select 1 from public.activities where id = 'aaaaaaaa-0000-0000-0009-000000000003' $$,
  'and saves nothing'
);

select throws_ok(
  $$ select * from public.save_gym_session(jsonb_build_object(
       'id', 'bbbbbbbb-0000-0000-0000-00000000a001', 'local_date', '2026-10-21',
       'timezone', 'Europe/Lisbon', 'sets', '[]'::jsonb)) $$,
  '42501', null,
  'cannot write into another user''s activity'
);

-- Only this activity's records -------------------------------------------------------------------

select tests.add_activity('gym', '2026-10-22', 'aaaaaaaa-0000-0000-0009-000000000004');

select results_eq(
  $$ select exercise_id, value, activity_id from public.save_gym_session(jsonb_build_object(
       'id', 'aaaaaaaa-0000-0000-0009-000000000005', 'local_date', '2026-10-23',
       'timezone', 'Europe/Lisbon', 'started_at', '2026-10-23 09:00+00',
       'ended_at', '2026-10-23 10:00+00',
       'sets', jsonb_build_array(
         jsonb_build_object('id', 'aaaaaaaa-0000-0000-0009-000000000501',
           'exercise_id', tests.exercise('barbell-bench-press'), 'exercise_position', 0,
           'set_number', 1, 'weight_kg', 50, 'reps', 5, 'is_warmup', true),
         jsonb_build_object('id', 'aaaaaaaa-0000-0000-0009-000000000502',
           'exercise_id', tests.exercise('barbell-bench-press'), 'exercise_position', 0,
           'set_number', 2, 'weight_kg', 110, 'reps', 5),
         jsonb_build_object('id', 'aaaaaaaa-0000-0000-0009-000000000503',
           'exercise_id', tests.exercise('overhead-press'), 'exercise_position', 1,
           'set_number', 1, 'weight_kg', 40, 'reps', 8, 'difficulty', 'medium')))) $$,
  $$ values (tests.exercise('barbell-bench-press'), 128.33::numeric,
             'aaaaaaaa-0000-0000-0009-000000000005'::uuid) $$,
  'returns only the records of this activity (bench beaten; the lighter press is not a record)'
);

-- last_performance -------------------------------------------------------------------------------

-- A deleted, more recent workout with the bench press: ignored.
select tests.add_activity('gym', '2026-10-25', 'aaaaaaaa-0000-0000-0009-000000000006');
select tests.add_set('aaaaaaaa-0000-0000-0009-000000000006', 'barbell-bench-press', 140, 5);
update public.activities set deleted_at = now()
where id = 'aaaaaaaa-0000-0000-0009-000000000006';

-- Another user's later bench press: ignored.
select tests.authenticate_as('bbbbbbbb-0000-0000-0000-000000000000');
select tests.add_activity('gym', '2026-10-26', 'bbbbbbbb-0000-0000-0009-000000000001');
select tests.add_set('bbbbbbbb-0000-0000-0009-000000000001', 'barbell-bench-press', 150, 5);
select tests.authenticate_as('aaaaaaaa-0000-0000-0000-000000000000');

select results_eq(
  $$ select exercise_id, activity_id, local_date, work_set_index, weight_kg, reps::int, duration_s,
            difficulty::text
     from public.last_performance(array[
       tests.exercise('barbell-bench-press'), tests.exercise('plank'), tests.exercise('deadlift')
     ]::uuid[])
     order by exercise_id, work_set_index $$,
  $$ select * from (values
       (tests.exercise('barbell-bench-press'), 'aaaaaaaa-0000-0000-0009-000000000005'::uuid,
        date '2026-10-23', 1, 110.000::numeric, 5, null::integer, null::text),
       (tests.exercise('plank'), 'aaaaaaaa-0000-0000-0009-000000000001'::uuid,
        date '2026-10-20', 1, null, null, 60, null)
     ) as expected order by 1, 4 $$,
  'the work sets of the latest workout per exercise; warm-ups, deleted workouts, other users and exercises never done are left out'
);

select results_eq(
  $$ select work_set_index, weight_kg, difficulty::text from public.last_performance(
       array[tests.exercise('overhead-press')]::uuid[]) $$,
  $$ values (1, 40.000::numeric, 'medium'::text) $$,
  'the latest workout wins even when an older one was heavier, with how hard it felt'
);

-- Two workouts the same day: the later start is "last time".
select tests.add_activity('gym', '2026-10-30', 'aaaaaaaa-0000-0000-0009-0000000000f2');
update public.activities set started_at = '2026-10-30 18:00+00'
where id = 'aaaaaaaa-0000-0000-0009-0000000000f2';
select tests.add_set('aaaaaaaa-0000-0000-0009-0000000000f2', 'deadlift', 180, 3);
select tests.add_activity('gym', '2026-10-30', 'aaaaaaaa-0000-0000-0009-0000000000f9');
update public.activities set started_at = '2026-10-30 07:00+00'
where id = 'aaaaaaaa-0000-0000-0009-0000000000f9';
select tests.add_set('aaaaaaaa-0000-0000-0009-0000000000f9', 'deadlift', 160, 3);

select results_eq(
  $$ select weight_kg from public.last_performance(array[tests.exercise('deadlift')]::uuid[]) $$,
  $$ values (180.000::numeric) $$,
  'on the same day, the workout that started later'
);

select results_eq(
  $$ select work_set_index, weight_kg from public.last_performance(
       array[tests.exercise('barbell-bench-press')]::uuid[]) $$,
  $$ values (1, 110.000::numeric) $$,
  'warm-ups are not numbered: the first work set is set 1'
);

-- Anonymous --------------------------------------------------------------------------------------

select tests.authenticate_as_anon();

select throws_ok(
  $$ select * from public.save_gym_session('{"id": "aaaaaaaa-0000-0000-0009-000000000009"}') $$,
  '42501', null,
  'anon cannot save a session'
);

select throws_ok(
  $$ select * from public.last_performance(array[]::uuid[]) $$,
  '42501', null,
  'anon cannot read last performance'
);

select * from finish();
rollback;
