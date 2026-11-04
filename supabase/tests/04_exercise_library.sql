-- The shared library is readable by every signed-in user and read-only through the API.
begin;
\ir helpers.psql

select plan(10);

select tests.authenticate_as('aaaaaaaa-0000-0000-0000-000000000000');

select ok(
  (select count(*) >= 60 from public.exercises where owner_id is null),
  'signed-in users read the exercise library'
);

select is_empty(
  $$ update public.exercises set name_en = 'Hacked' where slug = 'deadlift' returning id $$,
  'a user cannot update a library exercise'
);

select is_empty(
  $$ update public.exercises set archived = true, deleted_at = now()
     where owner_id is null returning id $$,
  'a user cannot archive or soft-delete library exercises'
);

-- Library rows are not visible for update, so this changes nothing instead of failing.
select is_empty(
  $$ update public.exercises set owner_id = 'aaaaaaaa-0000-0000-0000-000000000000', slug = null
     where slug = 'deadlift' returning id $$,
  'a user cannot take ownership of a library exercise'
);

select throws_ok(
  $$ delete from public.exercises where slug = 'deadlift' $$,
  '42501', null,
  'a user cannot delete a library exercise'
);

select throws_ok(
  $$ insert into public.exercises (slug, name_en, name_pt, muscle_group, equipment)
     values ('fake-lift', 'Fake', 'Falso', 'chest', 'barbell') $$,
  '42501', null,
  'a user cannot add exercises to the library'
);

select lives_ok(
  $$ insert into public.exercises (owner_id, name_en, name_pt, muscle_group, equipment)
     values ('aaaaaaaa-0000-0000-0000-000000000000', 'Landmine press', 'Landmine press',
             'shoulders', 'barbell') $$,
  'a user adds their own custom exercise'
);

select throws_ok(
  $$ insert into public.exercises (owner_id, slug, name_en, name_pt, muscle_group, equipment)
     values ('aaaaaaaa-0000-0000-0000-000000000000', 'my-lift', 'Mine', 'Meu', 'chest', 'barbell') $$,
  '23514', null,
  'custom exercises cannot take a library slug'
);

reset role;

select results_eq(
  $$ select name_en, archived, deleted_at from public.exercises where slug = 'deadlift' $$,
  $$ values ('Deadlift', false, null::timestamptz) $$,
  'the library is unchanged'
);

select is(
  (select count(*)::int from public.exercises where owner_id is null and deleted_at is not null),
  0,
  'no library exercise was soft-deleted'
);

select * from finish();
rollback;
