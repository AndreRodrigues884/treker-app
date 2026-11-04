-- A user never reads, changes or deletes another user's rows, in every table with user data.
-- Ana (aaaaaaaa-...) tries to reach Bruno's (bbbbbbbb-...) rows created in helpers.psql.
begin;
\ir helpers.psql

select plan(36);

select tests.authenticate_as('aaaaaaaa-0000-0000-0000-000000000000');

-- Custom exercises -----------------------------------------------------------------------------

select results_eq(
  $$ select id from public.exercises where owner_id is not null $$,
  $$ values ('aaaaaaaa-0000-0000-0000-00000000e001'::uuid) $$,
  'exercises: a user reads only their own custom exercises'
);
select is_empty(
  $$ update public.exercises set name_en = 'Hacked'
     where id = 'bbbbbbbb-0000-0000-0000-00000000e001' returning id $$,
  'exercises: a user cannot update another user''s exercise'
);
select throws_ok(
  $$ delete from public.exercises where id = 'bbbbbbbb-0000-0000-0000-00000000e001' $$,
  '42501', null,
  'exercises: a user cannot delete rows'
);
select throws_ok(
  $$ insert into public.exercises (owner_id, name_en, name_pt, muscle_group, equipment)
     values ('bbbbbbbb-0000-0000-0000-000000000000', 'X', 'X', 'chest', 'barbell') $$,
  '42501', null,
  'exercises: a user cannot create rows for another user'
);

-- Workout templates ----------------------------------------------------------------------------

select results_eq(
  $$ select id from public.workout_templates $$,
  $$ values ('aaaaaaaa-0000-0000-0000-00000000f001'::uuid) $$,
  'workout_templates: a user reads only their own rows'
);
select is_empty(
  $$ update public.workout_templates set name = 'Hacked'
     where id = 'bbbbbbbb-0000-0000-0000-00000000f001' returning id $$,
  'workout_templates: a user cannot update another user''s row'
);
select is_empty(
  $$ update public.workout_templates set deleted_at = now()
     where id = 'bbbbbbbb-0000-0000-0000-00000000f001' returning id $$,
  'workout_templates: a user cannot soft-delete another user''s row'
);
select throws_ok(
  $$ delete from public.workout_templates where id = 'bbbbbbbb-0000-0000-0000-00000000f001' $$,
  '42501', null,
  'workout_templates: a user cannot delete rows'
);
select throws_ok(
  $$ insert into public.workout_templates (user_id, name)
     values ('bbbbbbbb-0000-0000-0000-000000000000', 'Fake') $$,
  '42501', null,
  'workout_templates: a user cannot create rows for another user'
);

-- Workout template exercises -------------------------------------------------------------------

select results_eq(
  $$ select id from public.workout_template_exercises $$,
  $$ values ('aaaaaaaa-0000-0000-0000-00000000f101'::uuid) $$,
  'workout_template_exercises: a user reads only their own rows'
);
select is_empty(
  $$ update public.workout_template_exercises set target_sets = 5
     where id = 'bbbbbbbb-0000-0000-0000-00000000f101' returning id $$,
  'workout_template_exercises: a user cannot update another user''s row'
);
select is_empty(
  $$ update public.workout_template_exercises set deleted_at = now()
     where id = 'bbbbbbbb-0000-0000-0000-00000000f101' returning id $$,
  'workout_template_exercises: a user cannot soft-delete another user''s row'
);
select throws_ok(
  $$ delete from public.workout_template_exercises
     where id = 'bbbbbbbb-0000-0000-0000-00000000f101' $$,
  '42501', null,
  'workout_template_exercises: a user cannot delete rows'
);
select throws_ok(
  $$ insert into public.workout_template_exercises (user_id, template_id, exercise_id, position)
     values ('bbbbbbbb-0000-0000-0000-000000000000', 'bbbbbbbb-0000-0000-0000-00000000f001',
             'bbbbbbbb-0000-0000-0000-00000000e001', 1) $$,
  '42501', null,
  'workout_template_exercises: a user cannot create rows for another user'
);

-- Activities -----------------------------------------------------------------------------------

select results_eq(
  $$ select id from public.activities order by id $$,
  $$ values ('aaaaaaaa-0000-0000-0000-00000000a001'::uuid),
            ('aaaaaaaa-0000-0000-0000-00000000a002'::uuid) $$,
  'activities: a user reads only their own rows'
);
select is_empty(
  $$ update public.activities set title = 'Hacked'
     where id = 'bbbbbbbb-0000-0000-0000-00000000a001' returning id $$,
  'activities: a user cannot update another user''s row'
);
select is_empty(
  $$ update public.activities set deleted_at = now()
     where id = 'bbbbbbbb-0000-0000-0000-00000000a001' returning id $$,
  'activities: a user cannot soft-delete another user''s row'
);
select throws_ok(
  $$ delete from public.activities where id = 'bbbbbbbb-0000-0000-0000-00000000a001' $$,
  '42501', null,
  'activities: a user cannot delete rows'
);
select throws_ok(
  $$ insert into public.activities (user_id, type, local_date, timezone)
     values ('bbbbbbbb-0000-0000-0000-000000000000', 'gym', '2026-11-04', 'UTC') $$,
  '42501', null,
  'activities: a user cannot create rows for another user'
);

-- Gym sets -------------------------------------------------------------------------------------

select results_eq(
  $$ select id from public.gym_sets $$,
  $$ values ('aaaaaaaa-0000-0000-0000-00000000c001'::uuid) $$,
  'gym_sets: a user reads only their own rows'
);
select is_empty(
  $$ update public.gym_sets set reps = 20
     where id = 'bbbbbbbb-0000-0000-0000-00000000c001' returning id $$,
  'gym_sets: a user cannot update another user''s row'
);
select is_empty(
  $$ update public.gym_sets set deleted_at = now()
     where id = 'bbbbbbbb-0000-0000-0000-00000000c001' returning id $$,
  'gym_sets: a user cannot soft-delete another user''s row'
);
select throws_ok(
  $$ delete from public.gym_sets where id = 'bbbbbbbb-0000-0000-0000-00000000c001' $$,
  '42501', null,
  'gym_sets: a user cannot delete rows'
);
select throws_ok(
  $$ insert into public.gym_sets
       (user_id, activity_id, exercise_id, exercise_position, set_number, reps)
     values ('bbbbbbbb-0000-0000-0000-000000000000', 'bbbbbbbb-0000-0000-0000-00000000a001',
             'bbbbbbbb-0000-0000-0000-00000000e001', 0, 2, 5) $$,
  '42501', null,
  'gym_sets: a user cannot create rows for another user'
);

-- Swim entries ---------------------------------------------------------------------------------

select results_eq(
  $$ select id from public.swim_entries $$,
  $$ values ('aaaaaaaa-0000-0000-0000-00000000d001'::uuid) $$,
  'swim_entries: a user reads only their own rows'
);
select is_empty(
  $$ update public.swim_entries set time_cs = 1
     where id = 'bbbbbbbb-0000-0000-0000-00000000d001' returning id $$,
  'swim_entries: a user cannot update another user''s row'
);
select is_empty(
  $$ update public.swim_entries set deleted_at = now()
     where id = 'bbbbbbbb-0000-0000-0000-00000000d001' returning id $$,
  'swim_entries: a user cannot soft-delete another user''s row'
);
select throws_ok(
  $$ delete from public.swim_entries where id = 'bbbbbbbb-0000-0000-0000-00000000d001' $$,
  '42501', null,
  'swim_entries: a user cannot delete rows'
);
select throws_ok(
  $$ insert into public.swim_entries
       (user_id, activity_id, stroke, distance, pool_length, time_cs, kind)
     values ('bbbbbbbb-0000-0000-0000-000000000000', 'bbbbbbbb-0000-0000-0000-00000000a002',
             'free', 50, '25m', 3000, 'training') $$,
  '42501', null,
  'swim_entries: a user cannot create rows for another user'
);

-- Moving own rows to another user --------------------------------------------------------------

select throws_ok(
  $$ update public.activities set user_id = 'bbbbbbbb-0000-0000-0000-000000000000'
     where id = 'aaaaaaaa-0000-0000-0000-00000000a001' $$,
  '42501', null,
  'a user cannot hand their rows over to another user'
);

-- Own rows still work --------------------------------------------------------------------------

select isnt_empty(
  $$ update public.activities set title = 'Push day', deleted_at = null
     where id = 'aaaaaaaa-0000-0000-0000-00000000a001' returning id $$,
  'a user updates their own activity'
);
select isnt_empty(
  $$ update public.gym_sets set deleted_at = now()
     where id = 'aaaaaaaa-0000-0000-0000-00000000c001' returning id $$,
  'a user soft-deletes their own set'
);

-- Bruno's rows are untouched -------------------------------------------------------------------

reset role;

select results_eq(
  $$ select name_en from public.exercises where id = 'bbbbbbbb-0000-0000-0000-00000000e001' $$,
  $$ values ('Bruno row') $$,
  'Bruno''s exercise is unchanged'
);
select results_eq(
  $$ select title, deleted_at from public.activities
     where id = 'bbbbbbbb-0000-0000-0000-00000000a001' $$,
  $$ values (null::text, null::timestamptz) $$,
  'Bruno''s activity is unchanged'
);
select results_eq(
  $$ select reps, deleted_at from public.gym_sets
     where id = 'bbbbbbbb-0000-0000-0000-00000000c001' $$,
  $$ values (8::smallint, null::timestamptz) $$,
  'Bruno''s set is unchanged'
);
select results_eq(
  $$ select time_cs, deleted_at from public.swim_entries
     where id = 'bbbbbbbb-0000-0000-0000-00000000d001' $$,
  $$ values (6245, null::timestamptz) $$,
  'Bruno''s swim entry is unchanged'
);

select * from finish();
rollback;
