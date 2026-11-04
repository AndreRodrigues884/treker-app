-- Onboarding answers on the profile: consistency rules and who can change them.
begin;
\ir helpers.psql

select plan(16);

select tests.authenticate_as('aaaaaaaa-0000-0000-0000-000000000000');

create temporary view ana_profile as
select * from public.profiles where id = 'aaaaaaaa-0000-0000-0000-000000000000';

-- Consistency ------------------------------------------------------------------------------------

select lives_ok(
  $$ update public.profiles set sports = '{gym}', weekly_target = 3
     where id = 'aaaaaaaa-0000-0000-0000-000000000000' $$,
  'answers can be saved one by one before onboarding is done'
);

select throws_ok(
  $$ update public.profiles set onboarded_at = now()
     where id = 'aaaaaaaa-0000-0000-0000-000000000000' $$,
  '23514', null,
  'gym needs a focus before onboarding is done'
);

select lives_ok(
  $$ update public.profiles set gym_focus = 'strength', onboarded_at = now()
     where id = 'aaaaaaaa-0000-0000-0000-000000000000' $$,
  'gym with a focus completes onboarding'
);

select throws_ok(
  $$ update public.profiles set sports = '{gym,swim}'
     where id = 'aaaaaaaa-0000-0000-0000-000000000000' $$,
  '23514', null,
  'adding swim needs a swim style and a pool length'
);

select throws_ok(
  $$ update public.profiles set sports = '{gym,swim}', swim_style = 'competitive'
     where id = 'aaaaaaaa-0000-0000-0000-000000000000' $$,
  '23514', null,
  'swim needs a default pool length'
);

select lives_ok(
  $$ update public.profiles
     set sports = '{gym,swim}', swim_style = 'competitive', default_pool_length = '50m'
     where id = 'aaaaaaaa-0000-0000-0000-000000000000' $$,
  'gym and swim with every answer is complete'
);

select lives_ok(
  $$ update public.profiles set sports = '{swim}', gym_focus = null
     where id = 'aaaaaaaa-0000-0000-0000-000000000000' $$,
  'swim only does not need a gym focus'
);

select throws_ok(
  $$ update public.profiles set weekly_target = null
     where id = 'aaaaaaaa-0000-0000-0000-000000000000' $$,
  '23514', null,
  'a completed onboarding needs a weekly target'
);

-- Values -----------------------------------------------------------------------------------------

select throws_ok(
  $$ update public.profiles set sports = '{}'
     where id = 'aaaaaaaa-0000-0000-0000-000000000000' $$,
  '23514', null,
  'sports cannot be empty'
);

select throws_ok(
  $$ update public.profiles set sports = '{swim,swim}'
     where id = 'aaaaaaaa-0000-0000-0000-000000000000' $$,
  '23514', null,
  'sports cannot repeat'
);

select throws_ok(
  $$ update public.profiles set weekly_target = 0
     where id = 'aaaaaaaa-0000-0000-0000-000000000000' $$,
  '23514', null,
  'the weekly target is at least 1'
);

select throws_ok(
  $$ update public.profiles set weekly_target = 15
     where id = 'aaaaaaaa-0000-0000-0000-000000000000' $$,
  '23514', null,
  'the weekly target is at most 14'
);

select results_eq(
  $$ select sports::text, swim_style::text, default_pool_length::text, weekly_target
     from ana_profile $$,
  $$ values ('{swim}', 'competitive', '50m', 3::smallint) $$,
  'the failed updates left the saved answers as they were'
);

-- Permissions ------------------------------------------------------------------------------------

select is_empty(
  $$ update public.profiles set sports = '{gym}', gym_focus = 'hypertrophy', weekly_target = 7
     where id = 'bbbbbbbb-0000-0000-0000-000000000000' returning id $$,
  'a user cannot change another user''s answers'
);

select tests.authenticate_as_anon();

select throws_ok(
  $$ update public.profiles set weekly_target = 7 $$,
  '42501', null,
  'anon cannot change answers'
);

reset role;

select results_eq(
  $$ select sports, gym_focus::text, weekly_target from public.profiles
     where id = 'bbbbbbbb-0000-0000-0000-000000000000' $$,
  $$ values (null::public.activity_type[], null::text, null::smallint) $$,
  'the other user''s answers are unchanged'
);

select * from finish();
rollback;
