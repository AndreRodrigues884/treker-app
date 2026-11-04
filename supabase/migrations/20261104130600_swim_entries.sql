-- Times of a swim activity: races and training repeats. A swim activity has several entries.

create table public.swim_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  activity_id uuid not null,
  -- Order within the activity.
  position smallint not null default 0 check (position >= 0),
  stroke public.swim_stroke not null,
  -- In the pool's unit: metres for 25m/50m pools, yards for 25yd pools. Times from different
  -- pool lengths are never compared, so the distance never needs converting.
  distance smallint not null check (distance between 25 and 10000),
  pool_length public.pool_length not null,
  -- Centiseconds (hundredths of a second), the precision of touchpad timing.
  time_cs integer not null check (time_cs between 1 and 3600000),
  kind public.swim_kind not null,
  -- Time of each segment in centiseconds, in order.
  splits_cs integer[] check (
    splits_cs is null
    or (
      cardinality(splits_cs) between 1 and 400
      and array_position(splits_cs, null) is null
      and 0 < all (splits_cs)
    )
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  -- The activity must belong to the same user.
  foreign key (activity_id, user_id)
    references public.activities (id, user_id) on delete cascade,
  -- Whole lengths of the pool only.
  check (distance % case pool_length when '50m' then 50 else 25 end = 0)
);

create index swim_entries_activity_id_idx on public.swim_entries (activity_id);
-- Best times per event: stroke, distance and pool length.
create index swim_entries_user_event_idx
on public.swim_entries (user_id, stroke, distance, pool_length);
create index swim_entries_user_id_updated_at_idx on public.swim_entries (user_id, updated_at);

create trigger set_timestamps
before insert or update on public.swim_entries
for each row execute function private.set_timestamps();

create function private.check_swim_entry()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.assert_activity_type(new.activity_id, new.user_id, 'swim');
  return new;
end;
$$;

revoke all on function private.check_swim_entry() from public, anon, authenticated;

create trigger check_references
before insert or update of activity_id, user_id on public.swim_entries
for each row execute function private.check_swim_entry();

-- Access ---------------------------------------------------------------------------------------

alter table public.swim_entries enable row level security;

revoke all on table public.swim_entries from anon, authenticated;
grant select, insert, update on table public.swim_entries to authenticated;

create policy "swim_entries: owner can read"
on public.swim_entries for select to authenticated
using (user_id = (select auth.uid()));

create policy "swim_entries: owner can insert"
on public.swim_entries for insert to authenticated
with check (user_id = (select auth.uid()));

create policy "swim_entries: owner can update"
on public.swim_entries for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));
