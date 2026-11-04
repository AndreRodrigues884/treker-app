-- Gym records (estimated 1RM) and exercise stats are rebuilt from the sets.
begin;
\ir helpers.psql

select plan(20);

select tests.authenticate_as('aaaaaaaa-0000-0000-0000-000000000000');

create temporary view bench_records as
select value, previous_value, local_date
from public.personal_records
where exercise_id = tests.exercise('barbell-bench-press')
order by sequence;

-- First workout, then a worse one ----------------------------------------------------------------

select tests.add_activity('gym', '2026-10-01', 'aaaaaaaa-0000-0000-0001-000000000001');
select tests.add_set('aaaaaaaa-0000-0000-0001-000000000001', 'barbell-bench-press', 100, 5, 1);
select tests.add_set('aaaaaaaa-0000-0000-0001-000000000001', 'barbell-bench-press', 105, 3, 2);
select tests.add_set('aaaaaaaa-0000-0000-0001-000000000001', 'barbell-bench-press', 110, 2, 3);

select results_eq(
  'select value, previous_value from bench_records',
  $$ values (116.67, null::numeric), (117.33, 116.67) $$,
  'the first workout sets records each time the best improves (100x5, then 110x2; not 105x3)'
);

select results_eq(
  $$ select best_one_rep_max_kg, total_volume_kg, set_count, last_local_date
     from public.exercise_stats where exercise_id = tests.exercise('barbell-bench-press') $$,
  $$ values (117.33, 1035.000, 3, date '2026-10-01') $$,
  'exercise stats hold the best 1RM, volume, set count and last date'
);

select tests.add_activity('gym', '2026-10-03', 'aaaaaaaa-0000-0000-0001-000000000002');
select tests.add_set('aaaaaaaa-0000-0000-0001-000000000002', 'barbell-bench-press', 100, 3);

select is(
  (select count(*)::int from bench_records), 2,
  'a worse workout sets no record'
);

select tests.add_activity('gym', '2026-10-05', 'aaaaaaaa-0000-0000-0001-000000000003');
select tests.add_set('aaaaaaaa-0000-0000-0001-000000000003', 'barbell-bench-press', 112.5, 3);

select results_eq(
  'select value, local_date from bench_records offset 2',
  $$ values (123.75, date '2026-10-05') $$,
  'a better workout sets a new record'
);

-- A typo becomes a record, then is deleted ------------------------------------------------------

select tests.add_activity('gym', '2026-10-07', 'aaaaaaaa-0000-0000-0001-000000000004');
select tests.add_set('aaaaaaaa-0000-0000-0001-000000000004', 'barbell-bench-press', 250, 5)
  as typo_set \gset

select is(
  (select value from public.current_records
   where exercise_id = tests.exercise('barbell-bench-press')),
  291.67::numeric,
  'a typo (250 kg) becomes the current record'
);

select tests.add_activity('gym', '2026-10-09', 'aaaaaaaa-0000-0000-0001-000000000005');
select tests.add_set('aaaaaaaa-0000-0000-0001-000000000005', 'barbell-bench-press', 120, 3)
  as real_set \gset

select is(
  (select count(*)::int from bench_records), 4,
  'a real improvement after the typo is hidden by it'
);

update public.gym_sets set deleted_at = now() where id = :'typo_set';

select results_eq(
  'select value from bench_records',
  $$ values (116.67), (117.33), (123.75), (132.00) $$,
  'deleting the typo brings back the real records that came after it'
);

select results_eq(
  $$ select value, local_date from public.current_records
     where exercise_id = tests.exercise('barbell-bench-press') $$,
  $$ values (132.00, date '2026-10-09') $$,
  'the current record is the real best again'
);

update public.gym_sets set reps = 4 where id = :'real_set';

select results_eq(
  'select value from bench_records',
  $$ values (116.67), (117.33), (123.75), (136.00) $$,
  'correcting a set rebuilds its record'
);

-- What does not count ----------------------------------------------------------------------------

select tests.add_activity('gym', '2026-10-10', 'aaaaaaaa-0000-0000-0001-000000000006');
select tests.add_set('aaaaaaaa-0000-0000-0001-000000000006', 'back-squat', 200, 5, 1, true);
select tests.add_set('aaaaaaaa-0000-0000-0001-000000000006', 'back-squat', 100, 13, 2);
select tests.add_set('aaaaaaaa-0000-0000-0001-000000000006', 'back-squat', 80, 12, 3);

select results_eq(
  $$ select value from public.personal_records
     where exercise_id = tests.exercise('back-squat') order by sequence $$,
  $$ values (112.00) $$,
  'warm-ups and sets above 12 reps do not count for the 1RM (only 80x12 does)'
);

select results_eq(
  $$ select best_one_rep_max_kg, total_volume_kg, set_count
     from public.exercise_stats where exercise_id = tests.exercise('back-squat') $$,
  $$ values (112.00, 2260.000, 2) $$,
  'volume and set count leave out warm-ups but include sets above 12 reps'
);

insert into public.gym_sets (activity_id, exercise_id, exercise_position, set_number, duration_s)
values ('aaaaaaaa-0000-0000-0001-000000000006', tests.exercise('plank'), 1, 1, 60);

select is_empty(
  $$ select 1 from public.personal_records where exercise_id = tests.exercise('plank') $$,
  'exercises measured in seconds have no 1RM record'
);

select results_eq(
  $$ select best_one_rep_max_kg, total_volume_kg, set_count
     from public.exercise_stats where exercise_id = tests.exercise('plank') $$,
  $$ values (null::numeric, 0.000, 1) $$,
  'exercises measured in seconds still have stats'
);

-- Bodyweight ------------------------------------------------------------------------------------

update public.profiles set bodyweight_kg = 70 where id = 'aaaaaaaa-0000-0000-0000-000000000000';

select tests.add_activity('gym', '2026-09-01', 'aaaaaaaa-0000-0000-0001-000000000011');

select is(
  (select bodyweight_kg from public.activities where id = 'aaaaaaaa-0000-0000-0001-000000000011'),
  70.00,
  'a new activity copies the profile bodyweight'
);

select tests.add_set('aaaaaaaa-0000-0000-0001-000000000011', 'pull-up', 20, 5);

create temporary view pull_up_records as
select value from public.personal_records
where exercise_id = tests.exercise('pull-up')
order by sequence;

select results_eq(
  'select value from pull_up_records',
  $$ values (35.00) $$,
  'a pull-up with 20 kg added at 70 kg bodyweight: (90 x 35/30) - 70'
);

update public.profiles set bodyweight_kg = 90 where id = 'aaaaaaaa-0000-0000-0000-000000000000';

select results_eq(
  'select value from pull_up_records',
  $$ values (35.00) $$,
  'changing the profile bodyweight does not change old records'
);

select is(
  (select bodyweight_kg from public.activities where id = 'aaaaaaaa-0000-0000-0001-000000000011'),
  70.00,
  'nor the bodyweight stored on old activities'
);

select tests.add_activity('gym', '2026-09-08', 'aaaaaaaa-0000-0000-0001-000000000012');
select tests.add_set('aaaaaaaa-0000-0000-0001-000000000012', 'pull-up', 20, 5);

select results_eq(
  'select value from pull_up_records',
  $$ values (35.00), (38.33) $$,
  'the same set at a heavier bodyweight is a new record'
);

update public.activities set bodyweight_kg = 60 where id = 'aaaaaaaa-0000-0000-0001-000000000011';

select results_eq(
  'select value from pull_up_records',
  $$ values (33.33), (38.33) $$,
  'correcting the bodyweight of an activity rebuilds its records'
);

update public.activities set deleted_at = now() where id = 'aaaaaaaa-0000-0000-0001-000000000012';

select results_eq(
  'select value from pull_up_records',
  $$ values (33.33) $$,
  'deleting an activity removes its records'
);

select * from finish();
rollback;
