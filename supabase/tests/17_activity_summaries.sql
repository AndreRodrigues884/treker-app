-- list_activity_summaries(): pages of the athlete's workouts with their totals.
begin;
\ir helpers.psql

select plan(13);

select tests.authenticate_as('aaaaaaaa-0000-0000-0000-000000000000');

-- Start from no workouts: the helpers' two are put aside.
update public.activities set deleted_at = now()
where id in ('aaaaaaaa-0000-0000-0000-00000000a001', 'aaaaaaaa-0000-0000-0000-00000000a002');

-- A gym workout of 1 h 15 min: two bench sets of 100 x 5, a warm-up, a deleted set and an
-- assisted pull-up (negative weight).
select tests.add_activity('gym', '2026-10-01', 'aaaaaaaa-0000-0000-0008-000000000001');
update public.activities
set started_at = '2026-10-01 10:00+00', ended_at = '2026-10-01 11:15+00'
where id = 'aaaaaaaa-0000-0000-0008-000000000001';
select tests.add_set('aaaaaaaa-0000-0000-0008-000000000001', 'barbell-bench-press', 60, 5, 1, true);
select tests.add_set('aaaaaaaa-0000-0000-0008-000000000001', 'barbell-bench-press', 100, 5, 2);
select tests.add_set('aaaaaaaa-0000-0000-0008-000000000001', 'barbell-bench-press', 100, 5, 3);
select tests.add_set('aaaaaaaa-0000-0000-0008-000000000001', 'barbell-bench-press', 200, 5, 4);
update public.gym_sets set deleted_at = now()
where activity_id = 'aaaaaaaa-0000-0000-0008-000000000001' and set_number = 4;
select tests.add_set('aaaaaaaa-0000-0000-0008-000000000001', 'pull-up', -20, 8, 5);

-- Two workouts on the same day: a swim (50 m in a 25 m pool + 100 yd) and an empty gym session.
select tests.add_activity('swim', '2026-10-02', 'aaaaaaaa-0000-0000-0008-000000000002');
select tests.add_swim('aaaaaaaa-0000-0000-0008-000000000002', 'free', 50, '25m', 2900);
select tests.add_swim('aaaaaaaa-0000-0000-0008-000000000002', 'back', 100, '25yd', 7000);
select tests.add_activity('gym', '2026-10-02', 'aaaaaaaa-0000-0000-0008-000000000003');

-- A deleted workout.
select tests.add_activity('gym', '2026-10-03', 'aaaaaaaa-0000-0000-0008-000000000004');
update public.activities set deleted_at = now()
where id = 'aaaaaaaa-0000-0000-0008-000000000004';

-- Only these three.
create temporary table mine as
select id from public.activities
where user_id = 'aaaaaaaa-0000-0000-0000-000000000000' and deleted_at is null;

-- Totals ----------------------------------------------------------------------------------------

select results_eq(
  $$ select duration_s, set_count, volume_kg, distance_m
     from public.list_activity_summaries()
     where id = 'aaaaaaaa-0000-0000-0008-000000000001' $$,
  $$ values (4500, 3, 1000.000::numeric, null::numeric) $$,
  'gym: duration, work sets (no warm-up, no deleted set) and volume (assistance counts as zero)'
);

select results_eq(
  $$ select duration_s, set_count, volume_kg, distance_m
     from public.list_activity_summaries()
     where id = 'aaaaaaaa-0000-0000-0008-000000000002' $$,
  $$ values (null::integer, 2, null::numeric, 141.4400::numeric) $$,
  'swim: times logged and distance in metres (yards converted); no duration without an end'
);

select results_eq(
  $$ select set_count, volume_kg from public.list_activity_summaries()
     where id = 'aaaaaaaa-0000-0000-0008-000000000003' $$,
  $$ values (0, 0::numeric) $$,
  'a gym workout without sets: zero, not null'
);

select is_empty(
  $$ select 1 from public.list_activity_summaries()
     where id = 'aaaaaaaa-0000-0000-0008-000000000004' $$,
  'deleted workouts are left out'
);

select is(
  (select count(*)::int from public.list_activity_summaries() s
   where s.id not in (select id from mine)),
  0,
  'only the caller''s own workouts'
);

-- Pages -----------------------------------------------------------------------------------------

select results_eq(
  $$ select id from public.list_activity_summaries(p_limit => 2) $$,
  $$ values ('aaaaaaaa-0000-0000-0008-000000000003'::uuid),
            ('aaaaaaaa-0000-0000-0008-000000000002'::uuid) $$,
  'first page: newest day first, then by id (descending)'
);

select results_eq(
  $$ select id from public.list_activity_summaries(
       '2026-10-02', 'aaaaaaaa-0000-0000-0008-000000000002', 2) $$,
  $$ values ('aaaaaaaa-0000-0000-0008-000000000001'::uuid) $$,
  'the next page starts strictly after the cursor: nothing repeated, nothing skipped'
);

select is_empty(
  $$ select 1 from public.list_activity_summaries(
       '2026-10-01', 'aaaaaaaa-0000-0000-0008-000000000001', 2) $$,
  'after the last row: an empty page'
);

-- A workout logged meanwhile, on an earlier day, still lands on its page; one on a later day does
-- not shift the pages already loaded.
select tests.add_activity('gym', '2026-09-30', 'aaaaaaaa-0000-0000-0008-000000000005');
select tests.add_activity('gym', '2026-10-05', 'aaaaaaaa-0000-0000-0008-000000000006');

select results_eq(
  $$ select id from public.list_activity_summaries(
       '2026-10-02', 'aaaaaaaa-0000-0000-0008-000000000002', 2) $$,
  $$ values ('aaaaaaaa-0000-0000-0008-000000000001'::uuid),
            ('aaaaaaaa-0000-0000-0008-000000000005'::uuid) $$,
  'pages by cursor are stable while workouts are added'
);

select is(
  (select count(*)::int from public.list_activity_summaries(p_limit => 1000)),
  5,
  'a page never exceeds 50 rows (here all 5)'
);

select throws_ok(
  $$ select * from public.list_activity_summaries('2026-10-02', null, 2) $$,
  '22023', null,
  'a cursor needs both the date and the id'
);

select ok(
  (select count(*) = 1 from public.list_activity_summaries(p_limit => 0)),
  'a limit below 1 returns one row'
);

-- Anonymous -------------------------------------------------------------------------------------

select tests.authenticate_as_anon();

select throws_ok(
  $$ select * from public.list_activity_summaries() $$,
  '42501', null,
  'anon cannot call it'
);

select * from finish();
rollback;
