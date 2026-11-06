-- delete_custom_exercise(): the exercise leaves the library and the saved workouts in one call;
-- logged sets, records and stats stay.
begin;
\ir helpers.psql

select plan(13);

select tests.authenticate_as('aaaaaaaa-0000-0000-0000-000000000000');

-- Ana's custom exercise, used in a logged set and in a saved workout next to a library exercise.
insert into public.exercises (id, owner_id, name_en, name_pt, muscle_group, equipment)
values ('aaaaaaaa-0000-0000-0007-000000000001', 'aaaaaaaa-0000-0000-0000-000000000000',
        'Landmine press', 'Landmine press', 'shoulders', 'barbell');

select tests.add_activity('gym', '2026-10-01', 'aaaaaaaa-0000-0000-0007-000000000101');
insert into public.gym_sets (activity_id, exercise_id, exercise_position, set_number, weight_kg, reps)
values ('aaaaaaaa-0000-0000-0007-000000000101', 'aaaaaaaa-0000-0000-0007-000000000001', 0, 1, 40, 8);

select public.save_workout_template(jsonb_build_object(
  'id', 'aaaaaaaa-0000-0000-0007-000000000201',
  'name', 'Shoulders',
  'exercises', jsonb_build_array(
    jsonb_build_object('id', 'aaaaaaaa-0000-0000-0007-000000000301',
      'exercise_id', 'aaaaaaaa-0000-0000-0007-000000000001'),
    jsonb_build_object('id', 'aaaaaaaa-0000-0000-0007-000000000302',
      'exercise_id', tests.exercise('overhead-press'))
  )
));

select isnt_empty(
  $$ select 1 from public.current_records
     where exercise_id = 'aaaaaaaa-0000-0000-0007-000000000001' $$,
  'before: the custom exercise has a record'
);

-- Deleting ---------------------------------------------------------------------------------------

select lives_ok(
  $$ select public.delete_custom_exercise('aaaaaaaa-0000-0000-0007-000000000001') $$,
  'a user deletes their own exercise in one call'
);

select is(
  (select deleted_at is not null from public.exercises
   where id = 'aaaaaaaa-0000-0000-0007-000000000001'),
  true,
  'the exercise is marked deleted (not removed)'
);

select results_eq(
  $$ select exercise_id from public.workout_template_exercises
     where template_id = 'aaaaaaaa-0000-0000-0007-000000000201' and deleted_at is null $$,
  $$ values (tests.exercise('overhead-press')) $$,
  'it leaves the saved workout; the other exercises stay'
);

select is(
  (select count(distinct deleted_at)::int from (
     select deleted_at from public.exercises where id = 'aaaaaaaa-0000-0000-0007-000000000001'
     union all
     select deleted_at from public.workout_template_exercises
     where id = 'aaaaaaaa-0000-0000-0007-000000000301'
   ) as marked),
  1,
  'with the same deletion time, in one transaction'
);

select is(
  (select count(*)::int from public.gym_sets
   where exercise_id = 'aaaaaaaa-0000-0000-0007-000000000001' and deleted_at is null),
  1,
  'logged sets are kept'
);

select isnt_empty(
  $$ select 1 from public.current_records
     where exercise_id = 'aaaaaaaa-0000-0000-0007-000000000001' $$,
  'and so are its records'
);

select results_eq(
  $$ select set_count from public.exercise_stats
     where exercise_id = 'aaaaaaaa-0000-0000-0007-000000000001' $$,
  $$ values (1) $$,
  'and its stats'
);

-- Repeating --------------------------------------------------------------------------------------

create temporary table first_delete as
select deleted_at from public.exercises where id = 'aaaaaaaa-0000-0000-0007-000000000001';

select lives_ok(
  $$ select public.delete_custom_exercise('aaaaaaaa-0000-0000-0007-000000000001') $$,
  'calling it again (a retry) does not fail'
);

select is(
  (select deleted_at from public.exercises where id = 'aaaaaaaa-0000-0000-0007-000000000001'),
  (select deleted_at from first_delete),
  'and changes nothing'
);

-- Not the user's own -----------------------------------------------------------------------------

select throws_ok(
  format('select public.delete_custom_exercise(%L)', tests.exercise('deadlift')),
  'P0002', null,
  'a library exercise cannot be deleted'
);

select throws_ok(
  $$ select public.delete_custom_exercise('bbbbbbbb-0000-0000-0000-00000000e001') $$,
  'P0002', null,
  'another user''s exercise cannot be deleted (it is not found)'
);

-- Anonymous --------------------------------------------------------------------------------------

select tests.authenticate_as_anon();

select throws_ok(
  $$ select public.delete_custom_exercise('aaaaaaaa-0000-0000-0007-000000000001') $$,
  '42501', null,
  'anon cannot call it'
);

select * from finish();
rollback;
