-- How rebuilds are triggered: once per key per statement, and on activity and exercise changes.
begin;
\ir helpers.psql

select plan(15);

select tests.authenticate_as('aaaaaaaa-0000-0000-0000-000000000000');

-- One statement, 50 sets, 5 exercises ------------------------------------------------------------

select tests.add_activity('gym', '2026-07-01', 'aaaaaaaa-0000-0000-0003-000000000001');

create temporary view bulk_exercises as
select tests.exercise(slug) as id
from unnest(array['barbell-row', 'lat-pulldown', 'leg-press', 'dumbbell-curl', 'triceps-pushdown'])
  as slug;

select tests.reset_rebuild_count();

insert into public.gym_sets (activity_id, exercise_id, exercise_position, set_number, weight_kg, reps)
select
  'aaaaaaaa-0000-0000-0003-000000000001',
  tests.exercise(e.slug),
  e.position,
  set_number,
  40 + set_number,
  5
from unnest(array['barbell-row', 'lat-pulldown', 'leg-press', 'dumbbell-curl', 'triceps-pushdown'])
  with ordinality as e (slug, position)
cross join generate_series(1, 10) as set_number;

select is(tests.rebuild_count(), 5, 'inserting 50 sets of 5 exercises rebuilds each key once');

select is(
  (select count(*)::int from public.current_records
   where exercise_id in (select id from bulk_exercises)),
  5,
  'each of the 5 exercises has a current record'
);

select tests.reset_rebuild_count();
update public.gym_sets set weight_kg = weight_kg + 5
where activity_id = 'aaaaaaaa-0000-0000-0003-000000000001';
select is(tests.rebuild_count(), 5, 'updating the 50 sets in one statement rebuilds each key once');

select tests.reset_rebuild_count();
update public.gym_sets set rpe = 8
where activity_id = 'aaaaaaaa-0000-0000-0003-000000000001';
select is(tests.rebuild_count(), 0, 'changes that cannot affect records (rpe) rebuild nothing');

select ok(
  exists (
    select 1 from pg_locks where locktype = 'advisory' and pid = pg_backend_pid() and granted
  ),
  'the rebuild holds a per-user advisory lock until the transaction ends'
);

select tests.reset_rebuild_count();
update public.gym_sets set deleted_at = now()
where activity_id = 'aaaaaaaa-0000-0000-0003-000000000001';
select is(tests.rebuild_count(), 5, 'deleting the 50 sets in one statement rebuilds each key once');

select is_empty(
  $$ select 1 from public.personal_records where exercise_id in (select id from bulk_exercises) $$,
  'deleted sets leave no records'
);

select is_empty(
  $$ select 1 from public.exercise_stats where exercise_id in (select id from bulk_exercises) $$,
  'deleted sets leave no stats'
);

-- Moving an activity to another date -------------------------------------------------------------

select tests.add_activity('gym', '2026-08-10', 'aaaaaaaa-0000-0000-0003-000000000010');
select tests.add_set('aaaaaaaa-0000-0000-0003-000000000010', 'deadlift', 140, 5);
select tests.add_activity('gym', '2026-08-20', 'aaaaaaaa-0000-0000-0003-000000000011');
select tests.add_set('aaaaaaaa-0000-0000-0003-000000000011', 'deadlift', 150, 5);

select results_eq(
  $$ select value from public.personal_records
     where exercise_id = tests.exercise('deadlift') order by sequence $$,
  $$ values (163.33), (175.00) $$,
  'two improving deadlift sessions give two records'
);

update public.activities set local_date = '2026-08-01'
where id = 'aaaaaaaa-0000-0000-0003-000000000011';

select results_eq(
  $$ select value, local_date from public.personal_records
     where exercise_id = tests.exercise('deadlift') order by sequence $$,
  $$ values (175.00, date '2026-08-01') $$,
  'moving the better session earlier rebuilds the history in the new order'
);

select results_eq(
  $$ select last_local_date from public.exercise_stats
     where exercise_id = tests.exercise('deadlift') $$,
  $$ values (date '2026-08-10') $$,
  'stats follow the new dates'
);

-- Changing how a custom exercise is measured -----------------------------------------------------

select isnt_empty(
  $$ select 1 from public.personal_records
     where exercise_id = 'aaaaaaaa-0000-0000-0000-00000000e001' $$,
  'the custom exercise has a record'
);

update public.exercises set tracks_load = false
where id = 'aaaaaaaa-0000-0000-0000-00000000e001';

select is_empty(
  $$ select 1 from public.personal_records
     where exercise_id = 'aaaaaaaa-0000-0000-0000-00000000e001' $$,
  'an exercise that no longer tracks load loses its 1RM records'
);

-- Account deletion -------------------------------------------------------------------------------

reset role;

select lives_ok(
  $$ delete from auth.users where id = 'bbbbbbbb-0000-0000-0000-000000000000' $$,
  'deleting an account works with the record triggers in place'
);

select is_empty(
  $$ select 1 from public.personal_records where user_id = 'bbbbbbbb-0000-0000-0000-000000000000'
     union all
     select 1 from public.exercise_stats where user_id = 'bbbbbbbb-0000-0000-0000-000000000000' $$,
  'deleting an account removes its records and stats'
);

select * from finish();
rollback;
