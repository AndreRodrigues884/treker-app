-- Impossible values are rejected by the database, and timestamps are set by the server.
begin;
\ir helpers.psql

select plan(20);

-- Helper to insert a set on Ana's gym activity with a library exercise. Runs as the caller.
create function tests.insert_set(
  p_slug text,
  p_weight_kg numeric default null,
  p_reps smallint default null,
  p_duration_s integer default null,
  p_rpe numeric default null
)
returns void
language sql
as $$
  insert into public.gym_sets (
    user_id, activity_id, exercise_id, exercise_position, set_number,
    weight_kg, reps, duration_s, rpe
  )
  values (
    'aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-00000000a001',
    (select id from public.exercises where slug = p_slug), 5, 1,
    p_weight_kg, p_reps, p_duration_s, p_rpe
  );
$$;

select tests.authenticate_as('aaaaaaaa-0000-0000-0000-000000000000');

-- Gym sets -------------------------------------------------------------------------------------

select throws_ok($$ select tests.insert_set('deadlift', 100, 0::smallint) $$,
  '23514', null, 'reps must be at least 1');
select throws_ok($$ select tests.insert_set('deadlift', 100, -3::smallint) $$,
  '23514', null, 'reps cannot be negative');
select throws_ok($$ select tests.insert_set('deadlift', 100, 5::smallint, null, 11) $$,
  '23514', null, 'rpe cannot be above 10');
select throws_ok($$ select tests.insert_set('deadlift', 100, 5::smallint, null, 0.5) $$,
  '23514', null, 'rpe cannot be below 1');
select throws_ok($$ select tests.insert_set('deadlift', 100, 5::smallint, null, 7.3) $$,
  '23514', null, 'rpe moves in steps of 0.5');
select lives_ok($$ select tests.insert_set('deadlift', 100, 5::smallint, null, 8.5) $$,
  'rpe 8.5 is accepted');
select throws_ok($$ select tests.insert_set('deadlift', 100, 5::smallint, 30) $$,
  '23514', null, 'a set has reps or seconds, not both');
select throws_ok($$ select tests.insert_set('plank', null, 10::smallint) $$,
  '23514', null, 'an exercise measured in seconds needs seconds');
select lives_ok($$ select tests.insert_set('plank', null, null, 60) $$,
  'a plank of 60 seconds is accepted');
select throws_ok($$ select tests.insert_set('plank', 10, null, 60) $$,
  '23514', null, 'an exercise without load cannot have a weight');
select throws_ok($$ select tests.insert_set('barbell-bench-press', -20, 5::smallint) $$,
  '23514', null, 'negative weight is rejected on loaded exercises');
select lives_ok($$ select tests.insert_set('pull-up', -20, 5::smallint) $$,
  'negative weight (assistance) is accepted on bodyweight exercises');

-- Swim entries ---------------------------------------------------------------------------------

select throws_ok(
  $$ insert into public.swim_entries
       (user_id, activity_id, stroke, distance, pool_length, time_cs, kind)
     values ('aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-00000000a002',
             'free', 50, '25m', 0, 'race') $$,
  '23514', null, 'a swim time cannot be zero'
);
select throws_ok(
  $$ insert into public.swim_entries
       (user_id, activity_id, stroke, distance, pool_length, time_cs, kind)
     values ('aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-00000000a002',
             'free', 75, '50m', 6000, 'training') $$,
  '23514', null, 'the distance must be whole lengths of the pool'
);
select throws_ok(
  $$ insert into public.swim_entries
       (user_id, activity_id, stroke, distance, pool_length, time_cs, kind, splits_cs)
     values ('aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-00000000a002',
             'free', 100, '50m', 6000, 'race', array[2900, 0]) $$,
  '23514', null, 'splits must be positive'
);

-- Activities -----------------------------------------------------------------------------------

select throws_ok(
  $$ insert into public.activities (user_id, type, local_date, timezone, started_at, ended_at)
     values ('aaaaaaaa-0000-0000-0000-000000000000', 'gym', '2026-11-04', 'Europe/Lisbon',
             '2026-11-04 18:00+00', '2026-11-04 17:00+00') $$,
  '23514', null, 'an activity cannot end before it starts'
);
select throws_ok(
  $$ insert into public.activities (user_id, type, local_date, timezone)
     values ('aaaaaaaa-0000-0000-0000-000000000000', 'gym', '2026-11-04', 'Lisbon') $$,
  '23514', null, 'the activity timezone must be a real IANA timezone'
);

-- Timestamps -----------------------------------------------------------------------------------

select lives_ok(
  $$ insert into public.activities (id, user_id, type, local_date, timezone, created_at, updated_at)
     values ('aaaaaaaa-0000-0000-0000-00000000a009', 'aaaaaaaa-0000-0000-0000-000000000000',
             'swim', '2026-11-04', 'Europe/Lisbon', '2000-01-01', '2000-01-01') $$,
  'an activity is inserted with client timestamps'
);
select results_eq(
  $$ select created_at = now(), updated_at = now() from public.activities
     where id = 'aaaaaaaa-0000-0000-0000-00000000a009' $$,
  $$ values (true, true) $$,
  'created_at and updated_at are set by the server, not the client'
);
select throws_ok(
  $$ update public.activities set id = gen_random_uuid()
     where id = 'aaaaaaaa-0000-0000-0000-00000000a009' $$,
  '23514', null, 'a row id never changes'
);

select * from finish();
rollback;
