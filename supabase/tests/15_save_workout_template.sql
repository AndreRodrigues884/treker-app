-- save_workout_template(): the template and its list of exercises in one call and one transaction.
begin;
\ir helpers.psql

select plan(17);

select tests.authenticate_as('aaaaaaaa-0000-0000-0000-000000000000');

-- Saving a new template --------------------------------------------------------------------------

select lives_ok(
  $$ select public.save_workout_template(jsonb_build_object(
       'id', 'aaaaaaaa-0000-0000-0006-000000000001',
       'name', 'Push A',
       'exercises', jsonb_build_array(
         jsonb_build_object('id', 'aaaaaaaa-0000-0000-0006-000000000101',
           'exercise_id', tests.exercise('barbell-bench-press'),
           'target_sets', 4, 'target_reps_min', 5, 'target_reps_max', 5),
         jsonb_build_object('id', 'aaaaaaaa-0000-0000-0006-000000000102',
           'exercise_id', tests.exercise('overhead-press'),
           'target_sets', 3, 'target_reps_min', 8, 'target_reps_max', 8),
         jsonb_build_object('id', 'aaaaaaaa-0000-0000-0006-000000000103',
           'exercise_id', tests.exercise('plank'),
           'target_sets', 3, 'target_seconds', 60)
       )
     )) $$,
  'a user saves a new template with its exercises in one call'
);

select results_eq(
  $$ select name, user_id from public.workout_templates
     where id = 'aaaaaaaa-0000-0000-0006-000000000001' $$,
  $$ values ('Push A'::text, 'aaaaaaaa-0000-0000-0000-000000000000'::uuid) $$,
  'the template is created for the signed-in user'
);

select results_eq(
  $$ select id, position::int, target_sets::int, target_reps_min::int, target_seconds::int
     from public.workout_template_exercises
     where template_id = 'aaaaaaaa-0000-0000-0006-000000000001' and deleted_at is null
     order by position $$,
  $$ values
       ('aaaaaaaa-0000-0000-0006-000000000101'::uuid, 0, 4, 5, null::int),
       ('aaaaaaaa-0000-0000-0006-000000000102'::uuid, 1, 3, 8, null),
       ('aaaaaaaa-0000-0000-0006-000000000103'::uuid, 2, 3, null, 60) $$,
  'the exercises are saved in the order of the list, with their targets'
);

-- Repeating the same call (a retry) --------------------------------------------------------------

select lives_ok(
  $$ select public.save_workout_template(jsonb_build_object(
       'id', 'aaaaaaaa-0000-0000-0006-000000000001',
       'name', 'Push A',
       'exercises', jsonb_build_array(
         jsonb_build_object('id', 'aaaaaaaa-0000-0000-0006-000000000101',
           'exercise_id', tests.exercise('barbell-bench-press'),
           'target_sets', 4, 'target_reps_min', 5, 'target_reps_max', 5),
         jsonb_build_object('id', 'aaaaaaaa-0000-0000-0006-000000000102',
           'exercise_id', tests.exercise('overhead-press'),
           'target_sets', 3, 'target_reps_min', 8, 'target_reps_max', 8),
         jsonb_build_object('id', 'aaaaaaaa-0000-0000-0006-000000000103',
           'exercise_id', tests.exercise('plank'),
           'target_sets', 3, 'target_seconds', 60)
       )
     )) $$,
  'repeating the same call (a retry) does not fail'
);

select is(
  (select count(*)::int from public.workout_templates
   where id = 'aaaaaaaa-0000-0000-0006-000000000001'),
  1,
  'and does not duplicate the template'
);

select is(
  (select count(*)::int from public.workout_template_exercises
   where template_id = 'aaaaaaaa-0000-0000-0006-000000000001'),
  3,
  'nor its exercises'
);

-- Replacing the list -----------------------------------------------------------------------------
-- Overhead press moves to the top, bench press stays second, the plank is removed and a new
-- exercise is added at the end. The template is renamed.

select lives_ok(
  $$ select public.save_workout_template(jsonb_build_object(
       'id', 'aaaaaaaa-0000-0000-0006-000000000001',
       'name', 'Push A (heavy)',
       'exercises', jsonb_build_array(
         jsonb_build_object('id', 'aaaaaaaa-0000-0000-0006-000000000102',
           'exercise_id', tests.exercise('overhead-press'),
           'target_sets', 5, 'target_reps_min', 3, 'target_reps_max', 3),
         jsonb_build_object('id', 'aaaaaaaa-0000-0000-0006-000000000101',
           'exercise_id', tests.exercise('barbell-bench-press'),
           'target_sets', 4, 'target_reps_min', 5, 'target_reps_max', 5),
         jsonb_build_object('id', 'aaaaaaaa-0000-0000-0006-000000000104',
           'exercise_id', tests.exercise('chest-dip'),
           'target_sets', 3, 'target_reps_min', 10, 'target_reps_max', 10)
       )
     )) $$,
  'saving again replaces the list'
);

select results_eq(
  $$ select id, position::int, target_sets::int
     from public.workout_template_exercises
     where template_id = 'aaaaaaaa-0000-0000-0006-000000000001' and deleted_at is null
     order by position $$,
  $$ values
       ('aaaaaaaa-0000-0000-0006-000000000102'::uuid, 0, 5),
       ('aaaaaaaa-0000-0000-0006-000000000101'::uuid, 1, 4),
       ('aaaaaaaa-0000-0000-0006-000000000104'::uuid, 2, 3) $$,
  'the new order and targets are saved, and the new exercise is added at the end'
);

select is(
  (select deleted_at is not null from public.workout_template_exercises
   where id = 'aaaaaaaa-0000-0000-0006-000000000103'),
  true,
  'an exercise taken out of the list is marked deleted, not removed'
);

select is(
  (select name from public.workout_templates where id = 'aaaaaaaa-0000-0000-0006-000000000001'),
  'Push A (heavy)',
  'the template is renamed'
);

-- One transaction: an invalid list changes nothing -----------------------------------------------

select throws_ok(
  $$ select public.save_workout_template(jsonb_build_object(
       'id', 'aaaaaaaa-0000-0000-0006-000000000001',
       'name', 'Broken',
       'exercises', jsonb_build_array(
         jsonb_build_object('id', 'aaaaaaaa-0000-0000-0006-000000000102',
           'exercise_id', tests.exercise('overhead-press'), 'target_sets', 99)
       )
     )) $$,
  '23514', null,
  'a target out of range is refused'
);

select results_eq(
  $$ select (select name from public.workout_templates
             where id = 'aaaaaaaa-0000-0000-0006-000000000001'),
            (select count(*)::int from public.workout_template_exercises
             where template_id = 'aaaaaaaa-0000-0000-0006-000000000001' and deleted_at is null) $$,
  $$ values ('Push A (heavy)'::text, 3) $$,
  'and nothing was changed: not the name, not the list'
);

-- Other users ------------------------------------------------------------------------------------

select throws_ok(
  $$ select public.save_workout_template(jsonb_build_object(
       'id', 'aaaaaaaa-0000-0000-0006-000000000002',
       'name', 'Pull',
       'exercises', jsonb_build_array(
         jsonb_build_object('id', 'aaaaaaaa-0000-0000-0006-000000000201',
           'exercise_id', 'bbbbbbbb-0000-0000-0000-00000000e001')
       )
     )) $$,
  '23503', null,
  'a template cannot use another user''s custom exercise'
);

select throws_ok(
  $$ select public.save_workout_template(jsonb_build_object(
       'id', 'bbbbbbbb-0000-0000-0000-00000000f001',
       'name', 'Taken over',
       'exercises', '[]'::jsonb
     )) $$,
  '42501', null,
  'a user cannot write to another user''s template'
);

select throws_ok(
  $$ select public.save_workout_template(jsonb_build_object(
       'id', 'aaaaaaaa-0000-0000-0006-000000000003',
       'name', 'Steal a row',
       'exercises', jsonb_build_array(
         jsonb_build_object('id', 'bbbbbbbb-0000-0000-0000-00000000f101',
           'exercise_id', tests.exercise('deadlift'))
       )
     )) $$,
  '42501', null,
  'a user cannot take over a row of another user''s template'
);

reset role;

select results_eq(
  $$ select t.name, e.template_id, e.deleted_at
     from public.workout_templates t
     join public.workout_template_exercises e on e.template_id = t.id
     where t.id = 'bbbbbbbb-0000-0000-0000-00000000f001' $$,
  $$ values ('Pull B'::text, 'bbbbbbbb-0000-0000-0000-00000000f001'::uuid, null::timestamptz) $$,
  'the other user''s template and its exercises are unchanged'
);

-- Anonymous --------------------------------------------------------------------------------------

select tests.authenticate_as_anon();

select throws_ok(
  $$ select public.save_workout_template('{"id": "aaaaaaaa-0000-0000-0006-000000000009", "name": "x"}') $$,
  '42501', null,
  'anon cannot call it'
);

select * from finish();
rollback;
