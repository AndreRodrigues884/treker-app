-- Phase 1d: session_progress, template_progress, one_rep_max_series, weekly_summary,
-- volume_by_muscle_group and template_usage.
begin;
\ir helpers.psql

select plan(21);

-- Ana's September, from her saved workout "Push A" (f001) and one without a saved workout:
--   W1  Mon  7 Sep 09:00 UTC      Push A   bench 100 x 8, plank 60 s
--   W2  Sun 13 Sep 23:30 Lisbon   Push A   bench 100 x 9, plank 50 s   (22:30 UTC, still Sunday)
--   S1  Tue 15 Sep                swim
--   W5  Wed 16 Sep                (none)   bench 105 x 5
--   W4  Thu 17 Sep                Push A   bench 200 x 5               DELETED
--   W3  Mon 21 Sep 00:30 Lisbon   Push A   bench 100 x 8, plank 50 s, deadlift 150 x 5
--                                          (Sunday 20 Sep 23:30 UTC, but Monday for Ana)
-- Bruno has a heavier bench on 10 Sep, which must never show.

select tests.authenticate_as('aaaaaaaa-0000-0000-0000-000000000000');

insert into public.activities (id, type, local_date, timezone, started_at, template_id, deleted_at)
values
  ('aaaaaaaa-0000-0000-000b-000000000001', 'gym', '2026-09-07', 'Europe/Lisbon',
   '2026-09-07 09:00+00', 'aaaaaaaa-0000-0000-0000-00000000f001', null),
  ('aaaaaaaa-0000-0000-000b-000000000002', 'gym', '2026-09-13', 'Europe/Lisbon',
   '2026-09-13 22:30+00', 'aaaaaaaa-0000-0000-0000-00000000f001', null),
  ('aaaaaaaa-0000-0000-000b-000000000010', 'swim', '2026-09-15', 'Europe/Lisbon',
   '2026-09-15 07:00+00', null, null),
  ('aaaaaaaa-0000-0000-000b-000000000005', 'gym', '2026-09-16', 'Europe/Lisbon',
   '2026-09-16 18:00+00', null, null),
  ('aaaaaaaa-0000-0000-000b-000000000004', 'gym', '2026-09-17', 'Europe/Lisbon',
   '2026-09-17 18:00+00', 'aaaaaaaa-0000-0000-0000-00000000f001', now()),
  ('aaaaaaaa-0000-0000-000b-000000000003', 'gym', '2026-09-21', 'Europe/Lisbon',
   '2026-09-20 23:30+00', 'aaaaaaaa-0000-0000-0000-00000000f001', null);

insert into public.gym_sets (
  activity_id, exercise_id, exercise_position, set_number, weight_kg, reps, duration_s
)
values
  ('aaaaaaaa-0000-0000-000b-000000000001', tests.exercise('barbell-bench-press'), 0, 1, 100, 8, null),
  ('aaaaaaaa-0000-0000-000b-000000000001', tests.exercise('plank'), 1, 1, null, null, 60),
  ('aaaaaaaa-0000-0000-000b-000000000002', tests.exercise('barbell-bench-press'), 0, 1, 100, 9, null),
  ('aaaaaaaa-0000-0000-000b-000000000002', tests.exercise('plank'), 1, 1, null, null, 50),
  ('aaaaaaaa-0000-0000-000b-000000000005', tests.exercise('barbell-bench-press'), 0, 1, 105, 5, null),
  ('aaaaaaaa-0000-0000-000b-000000000004', tests.exercise('barbell-bench-press'), 0, 1, 200, 5, null),
  ('aaaaaaaa-0000-0000-000b-000000000003', tests.exercise('barbell-bench-press'), 0, 1, 100, 8, null),
  ('aaaaaaaa-0000-0000-000b-000000000003', tests.exercise('plank'), 1, 1, null, null, 50),
  ('aaaaaaaa-0000-0000-000b-000000000003', tests.exercise('deadlift'), 2, 1, 150, 5, null);

select tests.authenticate_as('bbbbbbbb-0000-0000-0000-000000000000');
insert into public.activities (id, type, local_date, timezone)
values ('bbbbbbbb-0000-0000-000b-000000000001', 'gym', '2026-09-10', 'Europe/Lisbon');
insert into public.gym_sets (activity_id, exercise_id, exercise_position, set_number, weight_kg, reps)
values ('bbbbbbbb-0000-0000-000b-000000000001', tests.exercise('barbell-bench-press'), 0, 1, 300, 5);

select tests.authenticate_as('aaaaaaaa-0000-0000-0000-000000000000');

-- session_progress -------------------------------------------------------------------------------

select results_eq(
  $$ select exercise_position, measure, current_value, previous_value, previous_date, result
     from public.session_progress('aaaaaaaa-0000-0000-000b-000000000003') $$,
  $$ values (0, 'one_rep_max', 126.67::numeric, 122.50::numeric, date '2026-09-16', 'up'),
            (1, 'duration', 50::numeric, 50::numeric, date '2026-09-13', 'same'),
            (2, 'one_rep_max', 175::numeric, null::numeric, null::date, 'first') $$,
  'session_progress: each exercise against the previous workout with it, in any workout, '
  'skipping the deleted one'
);

select results_eq(
  $$ select distinct up_count, same_count, down_count, first_count, session_result
     from public.session_progress('aaaaaaaa-0000-0000-000b-000000000003') $$,
  $$ values (1, 1, 0, 1, 'up') $$,
  'session_progress: the summary on every row'
);

select results_eq(
  $$ select measure, result, previous_date
     from public.session_progress('aaaaaaaa-0000-0000-000b-000000000002') $$,
  $$ values ('one_rep_max', 'up', date '2026-09-07'), ('duration', 'down', date '2026-09-07') $$,
  'session_progress: a bench that went up and a plank that went down'
);

select is(
  (select distinct session_result
   from public.session_progress('aaaaaaaa-0000-0000-000b-000000000001')),
  'first',
  'session_progress: the first workout with every exercise is "first"'
);

select is_empty(
  $$ select 1 from public.session_progress('aaaaaaaa-0000-0000-000b-000000000004') $$,
  'session_progress: nothing for a deleted workout'
);

-- template_progress ------------------------------------------------------------------------------

select results_eq(
  $$ select distinct activity_id, local_date, session_result
     from public.template_progress('aaaaaaaa-0000-0000-0000-00000000f001')
     order by local_date $$,
  $$ values ('aaaaaaaa-0000-0000-000b-000000000001'::uuid, date '2026-09-07', 'first'),
            ('aaaaaaaa-0000-0000-000b-000000000002'::uuid, date '2026-09-13', 'same'),
            ('aaaaaaaa-0000-0000-000b-000000000003'::uuid, date '2026-09-21', 'up') $$,
  'template_progress: every workout done from the saved workout (not the deleted one), oldest first'
);

select results_eq(
  $$ select local_date, current_value, result
     from public.template_progress('aaaaaaaa-0000-0000-0000-00000000f001')
     where exercise_id = tests.exercise('barbell-bench-press') $$,
  $$ values (date '2026-09-07', 126.67::numeric, 'first'),
            (date '2026-09-13', 130.00::numeric, 'up'),
            (date '2026-09-21', 126.67::numeric, 'up') $$,
  'template_progress: the value and result of each exercise'
);

select results_eq(
  $$ select distinct local_date
     from public.template_progress('aaaaaaaa-0000-0000-0000-00000000f001', p_limit => 2)
     order by local_date $$,
  $$ values (date '2026-09-13'), (date '2026-09-21') $$,
  'template_progress: the last p_limit workouts'
);

-- one_rep_max_series --------------------------------------------------------------------------------

select results_eq(
  $$ select local_date, best_one_rep_max_kg
     from public.one_rep_max_series(
       array[tests.exercise('barbell-bench-press'), tests.exercise('plank')])
     where exercise_id = tests.exercise('barbell-bench-press') $$,
  $$ values (date '2026-09-07', 126.67::numeric), (date '2026-09-13', 130.00::numeric),
            (date '2026-09-16', 122.50::numeric), (date '2026-09-21', 126.67::numeric) $$,
  'one_rep_max_series: the best 1RM of each workout, oldest first, without deleted ones'
);

select is_empty(
  $$ select 1 from public.one_rep_max_series(array[tests.exercise('plank')]) $$,
  'one_rep_max_series: a plank has no 1RM'
);

select results_eq(
  $$ select local_date from public.one_rep_max_series(
       array[tests.exercise('barbell-bench-press')], date '2026-09-15') $$,
  $$ values (date '2026-09-16'), (date '2026-09-21') $$,
  'one_rep_max_series: from a date'
);

select throws_ok(
  $$ select * from public.one_rep_max_series(array[
       gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
       gen_random_uuid(), gen_random_uuid()]) $$,
  '22023',
  null,
  'one_rep_max_series: at most 5 exercises'
);

-- weekly_summary ---------------------------------------------------------------------------------------

select results_eq(
  $$ select week_start, workout_count, gym_count, volume_kg
     from public.weekly_summary('2026-09-09', '2026-10-01') $$,
  $$ values (date '2026-09-07', 2, 2, 1700::numeric),
            (date '2026-09-14', 2, 1, 525::numeric),
            (date '2026-09-21', 1, 1, 1550::numeric),
            (date '2026-09-28', 0, 0, 0::numeric) $$,
  'weekly_summary: Monday to Sunday weeks, Sunday 23:30 and Monday 00:30 in Lisbon in their '
  'own weeks, empty weeks as zero, without deleted workouts'
);

select results_eq(
  $$ select week_start from public.weekly_summary(null, '2026-09-20') limit 1 $$,
  $$ values (date '2026-09-07') $$,
  'weekly_summary: without p_from, from the week of the first workout'
);

select throws_ok(
  $$ select * from public.weekly_summary('2026-10-01', '2026-09-01') $$,
  '22023',
  null,
  'weekly_summary: p_from after p_to is refused'
);

-- volume_by_muscle_group -------------------------------------------------------------------------

select results_eq(
  $$ select muscle_group::text, volume_kg, set_count
     from public.volume_by_muscle_group('2026-09-01', '2026-09-30') $$,
  $$ values ('chest', 3025::numeric, 4), ('back', 750::numeric, 1), ('core', 0::numeric, 3) $$,
  'volume_by_muscle_group: the volume per muscle group, the largest first, without deleted sets'
);

-- template_usage -----------------------------------------------------------------------------------

select results_eq(
  $$ select template_id, name, workout_count, last_date
     from public.template_usage('2026-09-01', '2026-09-30') $$,
  $$ values ('aaaaaaaa-0000-0000-0000-00000000f001'::uuid, 'Push A', 3, date '2026-09-21') $$,
  'template_usage: how many times and the last date, without deleted workouts'
);

-- Other users and visitors ------------------------------------------------------------------------

select tests.authenticate_as('bbbbbbbb-0000-0000-0000-000000000000');

select is_empty(
  $$ select 1 from public.session_progress('aaaaaaaa-0000-0000-000b-000000000003')
     union all
     select 1 from public.template_progress('aaaaaaaa-0000-0000-0000-00000000f001')
     union all
     select 1 from public.template_usage('2026-09-01', '2026-09-30') $$,
  'another user gets nothing of Ana''s workouts or saved workouts'
);

select results_eq(
  $$ select best_one_rep_max_kg
     from public.one_rep_max_series(array[tests.exercise('barbell-bench-press')]) $$,
  $$ values (350.00::numeric) $$,
  'one_rep_max_series: only the user''s own sets'
);

select results_eq(
  $$ select sum(workout_count)::integer, sum(volume_kg)
     from public.weekly_summary('2026-09-01', '2026-09-30') $$,
  $$ values (1, 1500::numeric) $$,
  'weekly_summary: only the user''s own workouts'
);

select tests.authenticate_as_anon();

select throws_ok(
  $$ select * from public.weekly_summary('2026-09-01', '2026-09-30') $$,
  '42501',
  null,
  'a visitor cannot read statistics'
);

select * from finish();
rollback;
