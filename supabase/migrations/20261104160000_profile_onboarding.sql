-- When the user finished onboarding (name, units, optional bodyweight). Null means the app shows
-- onboarding after sign-in.

alter table public.profiles add column onboarded_at timestamptz;

grant update (onboarded_at) on table public.profiles to authenticated;
