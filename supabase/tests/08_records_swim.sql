-- Swim records: the fastest time per stroke, distance and pool length.
begin;
\ir helpers.psql

select plan(11);

select tests.authenticate_as('aaaaaaaa-0000-0000-0000-000000000000');

create temporary view breast_50_short as
select value, previous_value, swim_kind::text as kind
from public.personal_records
where type = 'swim' and stroke = 'breast' and distance = 50 and pool_length = '25m'
order by sequence;

-- An impossible time, then corrected -------------------------------------------------------------

select tests.add_activity('swim', '2026-10-01', 'aaaaaaaa-0000-0000-0002-000000000001');
select tests.add_swim('aaaaaaaa-0000-0000-0002-000000000001', 'breast', 50, '25m', 2900, 'race');

select results_eq(
  'select value from breast_50_short',
  $$ values (2900.00) $$,
  'the first time sets a record'
);

select tests.add_activity('swim', '2026-10-02', 'aaaaaaaa-0000-0000-0002-000000000002');
select tests.add_swim('aaaaaaaa-0000-0000-0002-000000000002', 'breast', 50, '25m', 1500, 'training')
  as typo_entry \gset

select tests.add_activity('swim', '2026-10-03', 'aaaaaaaa-0000-0000-0002-000000000003');
select tests.add_swim('aaaaaaaa-0000-0000-0002-000000000003', 'breast', 50, '25m', 2850, 'race');
select tests.add_activity('swim', '2026-10-04', 'aaaaaaaa-0000-0000-0002-000000000004');
select tests.add_swim('aaaaaaaa-0000-0000-0002-000000000004', 'breast', 50, '25m', 2800, 'training')
  as last_entry \gset

select results_eq(
  'select value from breast_50_short',
  $$ values (2900.00), (1500.00) $$,
  'an impossibly fast time (15.00) hides the real improvements after it'
);

update public.swim_entries set time_cs = 3000 where id = :'typo_entry';

select results_eq(
  'select value, previous_value, kind from breast_50_short',
  $$ values (2900.00, null::numeric, 'race'), (2850.00, 2900.00, 'race'),
            (2800.00, 2850.00, 'training') $$,
  'correcting the time brings back the real records, with their kind (race or training)'
);

update public.swim_entries set deleted_at = now() where id = :'last_entry';

select results_eq(
  'select value from breast_50_short',
  $$ values (2900.00), (2850.00) $$,
  'deleting an entry removes its record'
);

-- Pool lengths never mix -------------------------------------------------------------------------

select tests.add_activity('swim', '2026-10-10', 'aaaaaaaa-0000-0000-0002-000000000010');
select tests.add_swim('aaaaaaaa-0000-0000-0002-000000000010', 'free', 100, '25m', 6000);
select tests.add_swim('aaaaaaaa-0000-0000-0002-000000000010', 'free', 100, '50m', 6100);
select tests.add_swim('aaaaaaaa-0000-0000-0002-000000000010', 'free', 100, '25yd', 5500);

create temporary view free_100_current as
select pool_length::text as pool, value
from public.current_records
where type = 'swim' and stroke = 'free' and distance = 100
order by current_records.pool_length;

select results_eq(
  'select * from free_100_current',
  $$ values ('25m', 6000.00), ('50m', 6100.00), ('25yd', 5500.00) $$,
  'short course, long course and yards each keep their own record'
);

select tests.add_activity('swim', '2026-10-11', 'aaaaaaaa-0000-0000-0002-000000000011');
select tests.add_swim('aaaaaaaa-0000-0000-0002-000000000011', 'free', 100, '50m', 6050);

select results_eq(
  'select * from free_100_current',
  $$ values ('25m', 6000.00), ('50m', 6050.00), ('25yd', 5500.00) $$,
  'a long course improvement only changes the long course record'
);

select tests.add_swim('aaaaaaaa-0000-0000-0002-000000000011', 'free', 100, '25m', 6100);

select is(
  (select count(*)::int from public.personal_records
   where stroke = 'free' and distance = 100 and pool_length = '25m'),
  1,
  'a slower time sets no record'
);

select is(
  (select count(*)::int from public.personal_records
   where stroke = 'free' and distance = 100 and pool_length = '50m'),
  2,
  'the long course key has its own history'
);

select tests.add_swim('aaaaaaaa-0000-0000-0002-000000000011', 'back', 100, '25m', 7000);

select results_eq(
  $$ select stroke::text as stroke_name, value from public.current_records
     where distance = 100 and pool_length = '25m' order by stroke $$,
  $$ values ('free', 6000.00), ('back', 7000.00) $$,
  'strokes never mix either'
);

select results_eq(
  $$ select swim_kind::text, local_date from public.current_records
     where stroke = 'free' and distance = 100 and pool_length = '50m' $$,
  $$ values ('race', date '2026-10-11') $$,
  'a record keeps the date and the kind of the time that set it'
);

select results_eq(
  $$ select swim_entry_id is not null, gym_set_id is null, exercise_id is null
     from public.current_records where stroke = 'back' $$,
  $$ values (true, true, true) $$,
  'a swim record points to the entry that set it'
);

select * from finish();
rollback;
