-- One profile per user, created automatically when the user signs up.

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text check (display_name is null or char_length(display_name) between 1 and 50),
  weight_unit public.weight_unit not null default 'kg',
  pool_unit public.pool_unit not null default 'm',
  timezone text not null default 'UTC' check (private.is_valid_timezone(timezone)),
  locale text not null default 'en' check (locale in ('en', 'pt')),
  -- Private: never exposed in future public views.
  bodyweight_kg numeric(5, 2) check (bodyweight_kg is null or (bodyweight_kg > 0 and bodyweight_kg < 500)),
  visibility public.visibility not null default 'private',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on column public.profiles.bodyweight_kg is 'Private. Used for bodyweight 1RM estimates.';

create trigger set_timestamps
before insert or update on public.profiles
for each row execute function private.set_timestamps();

-- Access ---------------------------------------------------------------------------------------
-- Only the owner reads and updates their profile. Profiles are created by the signup trigger and
-- removed with the account, so users get no insert or delete.

alter table public.profiles enable row level security;

revoke all on table public.profiles from anon, authenticated;
grant select on table public.profiles to authenticated;
grant update (display_name, weight_unit, pool_unit, timezone, locale, bodyweight_kg, visibility)
  on table public.profiles to authenticated;

create policy "profiles: owner can read"
on public.profiles for select to authenticated
using (id = (select auth.uid()));

create policy "profiles: owner can update"
on public.profiles for update to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

-- Signup trigger -------------------------------------------------------------------------------

create function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    -- Never let bad metadata block the signup: trim, cap the length and treat '' as no name.
    nullif(left(btrim(new.raw_user_meta_data ->> 'display_name'), 50), '')
  );
  return new;
end;
$$;

revoke all on function private.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function private.handle_new_user();
