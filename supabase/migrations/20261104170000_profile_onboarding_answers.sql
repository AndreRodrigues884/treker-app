-- Onboarding answers. Each one changes something in the app (home screen, records, units), so the
-- questionnaire asks nothing that is not used. profiles.onboarded_at (20261104160000) marks the
-- questionnaire as done.

create type public.gym_focus as enum ('strength', 'hypertrophy', 'maintenance');
create type public.swim_style as enum ('competitive', 'fitness');

-- True when an array has no repeated values. Used by checks, so it must be immutable.
create function private.has_distinct_values(p_values anyarray)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select pg_catalog.cardinality(p_values) = (select count(distinct v) from unnest(p_values) as v);
$$;

revoke all on function private.has_distinct_values(anyarray) from public, anon;
grant execute on function private.has_distinct_values(anyarray) to authenticated, service_role;

alter table public.profiles
  -- The sports the athlete trains (activity_type, so running can join later).
  add column sports public.activity_type[]
    check (
      sports is null
      or (
        cardinality(sports) >= 1
        and array_position(sports, null) is null
        and private.has_distinct_values(sports)
      )
    ),
  add column gym_focus public.gym_focus,
  add column swim_style public.swim_style,
  -- Preselected pool length when logging a swim time.
  add column default_pool_length public.pool_length,
  -- Workouts per week, all sports together.
  add column weekly_target smallint check (weekly_target between 1 and 14);

-- The minimal onboarding of step 4a did not ask these questions: those users answer the new
-- questionnaire on their next sign-in.
update public.profiles set onboarded_at = null where onboarded_at is not null;

-- Once onboarding is done, every answer the chosen sports need is there.
alter table public.profiles
  add constraint profiles_onboarding_complete check (
    onboarded_at is null
    or (
      sports is not null
      and weekly_target is not null
      and (not 'gym' = any (sports) or gym_focus is not null)
      and (not 'swim' = any (sports) or (swim_style is not null and default_pool_length is not null))
    )
  );

grant update (sports, gym_focus, swim_style, default_pool_length, weekly_target)
  on table public.profiles to authenticated;
