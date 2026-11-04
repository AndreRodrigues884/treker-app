-- Bodyweight on the day of the workout. Bodyweight exercises (pull-ups, dips) use it for their
-- estimated 1RM, so changing the weight in the profile never rewrites old records.

alter table public.activities
  add column bodyweight_kg numeric(5, 2)
    check (bodyweight_kg is null or (bodyweight_kg > 0 and bodyweight_kg < 500));

comment on column public.activities.bodyweight_kg is
  'Private. Copy of the athlete''s bodyweight on the day; defaults to the profile value.';

-- When the app does not send it, copy the current profile bodyweight at insert time.
create function private.default_activity_bodyweight()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.bodyweight_kg is null then
    select p.bodyweight_kg into new.bodyweight_kg
    from public.profiles p
    where p.id = new.user_id;
  end if;
  return new;
end;
$$;

revoke all on function private.default_activity_bodyweight() from public, anon, authenticated;

create trigger default_bodyweight
before insert on public.activities
for each row execute function private.default_activity_bodyweight();
