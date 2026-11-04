-- References must point to rows the user is allowed to use, not just carry the right user_id.
begin;
\ir helpers.psql

select plan(12);

select tests.authenticate_as('aaaaaaaa-0000-0000-0000-000000000000');

-- Gym sets -------------------------------------------------------------------------------------

select throws_ok(
  $$ insert into public.gym_sets
       (user_id, activity_id, exercise_id, exercise_position, set_number, reps)
     values ('aaaaaaaa-0000-0000-0000-000000000000', 'bbbbbbbb-0000-0000-0000-00000000a001',
             (select id from public.exercises where slug = 'deadlift'), 0, 1, 5) $$,
  '23503', null,
  'a set cannot be added to another user''s activity'
);

select throws_ok(
  $$ insert into public.gym_sets
       (user_id, activity_id, exercise_id, exercise_position, set_number, reps)
     values ('aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-00000000a001',
             'bbbbbbbb-0000-0000-0000-00000000e001', 0, 1, 5) $$,
  '23503', null,
  'a set cannot use another user''s custom exercise'
);

select throws_ok(
  $$ update public.gym_sets set exercise_id = 'bbbbbbbb-0000-0000-0000-00000000e001'
     where id = 'aaaaaaaa-0000-0000-0000-00000000c001' $$,
  '23503', null,
  'a set cannot be changed to another user''s custom exercise'
);

select lives_ok(
  $$ insert into public.gym_sets
       (user_id, activity_id, exercise_id, exercise_position, set_number, weight_kg, reps)
     values ('aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-00000000a001',
             (select id from public.exercises where slug = 'deadlift'), 1, 1, 140, 5) $$,
  'a set can use a library exercise'
);

select lives_ok(
  $$ insert into public.gym_sets
       (user_id, activity_id, exercise_id, exercise_position, set_number, weight_kg, reps)
     values ('aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-00000000a001',
             'aaaaaaaa-0000-0000-0000-00000000e001', 0, 2, 12.5, 8) $$,
  'a set can use the user''s own custom exercise'
);

select throws_ok(
  $$ insert into public.gym_sets
       (user_id, activity_id, exercise_id, exercise_position, set_number, reps)
     values ('aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-00000000a002',
             (select id from public.exercises where slug = 'deadlift'), 0, 1, 5) $$,
  '23514', null,
  'a set cannot be added to a swim activity'
);

-- Swim entries ---------------------------------------------------------------------------------

select throws_ok(
  $$ insert into public.swim_entries
       (user_id, activity_id, stroke, distance, pool_length, time_cs, kind)
     values ('aaaaaaaa-0000-0000-0000-000000000000', 'bbbbbbbb-0000-0000-0000-00000000a002',
             'free', 50, '25m', 3000, 'race') $$,
  '23503', null,
  'a swim entry cannot be added to another user''s activity'
);

select throws_ok(
  $$ insert into public.swim_entries
       (user_id, activity_id, stroke, distance, pool_length, time_cs, kind)
     values ('aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-00000000a001',
             'free', 50, '25m', 3000, 'race') $$,
  '23514', null,
  'a swim entry cannot be added to a gym activity'
);

-- Templates ------------------------------------------------------------------------------------

select throws_ok(
  $$ insert into public.workout_template_exercises (user_id, template_id, exercise_id, position)
     values ('aaaaaaaa-0000-0000-0000-000000000000', 'bbbbbbbb-0000-0000-0000-00000000f001',
             (select id from public.exercises where slug = 'deadlift'), 1) $$,
  '23503', null,
  'an exercise cannot be added to another user''s template'
);

select throws_ok(
  $$ insert into public.workout_template_exercises (user_id, template_id, exercise_id, position)
     values ('aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-00000000f001',
             'bbbbbbbb-0000-0000-0000-00000000e001', 1) $$,
  '23503', null,
  'a template cannot use another user''s custom exercise'
);

select throws_ok(
  $$ insert into public.activities (user_id, type, local_date, timezone, template_id)
     values ('aaaaaaaa-0000-0000-0000-000000000000', 'gym', '2026-11-04', 'Europe/Lisbon',
             'bbbbbbbb-0000-0000-0000-00000000f001') $$,
  '23503', null,
  'an activity cannot use another user''s template'
);

select lives_ok(
  $$ insert into public.activities (user_id, type, local_date, timezone, template_id)
     values ('aaaaaaaa-0000-0000-0000-000000000000', 'gym', '2026-11-04', 'Europe/Lisbon',
             'aaaaaaaa-0000-0000-0000-00000000f001') $$,
  'an activity can use the user''s own template'
);

select * from finish();
rollback;
