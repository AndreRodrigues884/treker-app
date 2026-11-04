begin;
\ir helpers.psql

select plan(14);

-- Signup ---------------------------------------------------------------------------------------

select results_eq(
  $$ select display_name, weight_unit::text, pool_unit::text, timezone, locale, visibility::text
     from public.profiles where id = 'aaaaaaaa-0000-0000-0000-000000000000' $$,
  $$ values ('Ana', 'kg', 'm', 'UTC', 'en', 'private') $$,
  'signing up creates a private profile with the display name and defaults'
);

select is(
  (select display_name from public.profiles where id = 'bbbbbbbb-0000-0000-0000-000000000000'),
  null,
  'signing up without a display name leaves it empty'
);

select is(
  (select onboarded_at from public.profiles where id = 'aaaaaaaa-0000-0000-0000-000000000000'),
  null,
  'a new profile has not done onboarding yet'
);

select tests.create_user(
  'cccccccc-0000-0000-0000-000000000000', 'long@example.com', '  ' || repeat('x', 80) || '  '
);
select is(
  (select char_length(display_name) from public.profiles
   where id = 'cccccccc-0000-0000-0000-000000000000'),
  50,
  'a too long display name is trimmed and capped instead of blocking the signup'
);

-- Access ---------------------------------------------------------------------------------------

select tests.authenticate_as('aaaaaaaa-0000-0000-0000-000000000000');

select results_eq(
  $$ select id from public.profiles $$,
  $$ values ('aaaaaaaa-0000-0000-0000-000000000000'::uuid) $$,
  'a user only reads their own profile'
);

select isnt_empty(
  $$ update public.profiles set display_name = 'Ana M', weight_unit = 'lb', timezone = 'Europe/Lisbon'
     where id = 'aaaaaaaa-0000-0000-0000-000000000000' returning id $$,
  'a user updates their own profile'
);

select isnt_empty(
  $$ update public.profiles
     set sports = '{gym}', gym_focus = 'strength', weekly_target = 3, onboarded_at = now()
     where id = 'aaaaaaaa-0000-0000-0000-000000000000' returning id $$,
  'a user saves their answers and marks their own onboarding as done'
);

select is_empty(
  $$ update public.profiles set display_name = 'Hacked'
     where id = 'bbbbbbbb-0000-0000-0000-000000000000' returning id $$,
  'a user cannot update another profile'
);

select throws_ok(
  $$ delete from public.profiles where id = 'bbbbbbbb-0000-0000-0000-000000000000' $$,
  '42501',
  null,
  'a user cannot delete a profile'
);

select throws_ok(
  $$ insert into public.profiles (id) values ('dddddddd-0000-0000-0000-000000000000') $$,
  '42501',
  null,
  'a user cannot create profiles'
);

select throws_ok(
  $$ update public.profiles set created_at = now() - interval '1 year'
     where id = 'aaaaaaaa-0000-0000-0000-000000000000' $$,
  '42501',
  null,
  'a user cannot change protected columns'
);

select throws_ok(
  $$ update public.profiles set timezone = 'Mars/Olympus'
     where id = 'aaaaaaaa-0000-0000-0000-000000000000' $$,
  '23514',
  null,
  'the timezone must be a real IANA timezone'
);

select throws_ok(
  $$ update public.profiles set bodyweight_kg = -70
     where id = 'aaaaaaaa-0000-0000-0000-000000000000' $$,
  '23514',
  null,
  'the bodyweight must be positive'
);

reset role;

select is(
  (select display_name from public.profiles where id = 'bbbbbbbb-0000-0000-0000-000000000000'),
  null,
  'the other profile was not changed'
);

select * from finish();
rollback;
