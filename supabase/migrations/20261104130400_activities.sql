-- One row per workout, of any sport. Base for the calendar, profile, sharing and future feed.

create table public.activities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  type public.activity_type not null,
  -- The athlete's local calendar date, sent by the app. Never derived from UTC.
  local_date date not null,
  -- Timezone the workout happened in, so times can be shown as the athlete saw them.
  timezone text not null check (private.is_valid_timezone(timezone)),
  started_at timestamptz,
  ended_at timestamptz,
  title text check (char_length(title) <= 100),
  notes text check (char_length(notes) <= 5000),
  visibility public.visibility not null default 'private',
  template_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (id, user_id),
  -- The template must belong to the same user.
  foreign key (template_id, user_id)
    references public.workout_templates (id, user_id) on delete set null (template_id),
  check (local_date between date '2000-01-01' and date '2100-01-01'),
  check (ended_at is null or (started_at is not null and ended_at >= started_at)),
  check (template_id is null or type = 'gym')
);

-- Calendar and history lists, paginated by the (local_date, id) cursor.
create index activities_user_id_local_date_idx
on public.activities (user_id, local_date desc, id desc);

create index activities_user_id_updated_at_idx on public.activities (user_id, updated_at);

create trigger set_timestamps
before insert or update on public.activities
for each row execute function private.set_timestamps();

-- Access ---------------------------------------------------------------------------------------
-- Owner only for now; 'followers' and 'public' visibility are read by future views.

alter table public.activities enable row level security;

revoke all on table public.activities from anon, authenticated;
grant select, insert, update on table public.activities to authenticated;

create policy "activities: owner can read"
on public.activities for select to authenticated
using (user_id = (select auth.uid()));

create policy "activities: owner can insert"
on public.activities for insert to authenticated
with check (user_id = (select auth.uid()));

create policy "activities: owner can update"
on public.activities for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

-- Shared by gym_sets and swim_entries: the parent activity must be of the right type.
create function private.assert_activity_type(
  p_activity_id uuid,
  p_user_id uuid,
  p_expected public.activity_type
)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_type public.activity_type;
begin
  select a.type into v_type
  from public.activities a
  where a.id = p_activity_id and a.user_id = p_user_id;
  -- A missing activity (or one of another user) is reported by the composite foreign key.
  if found and v_type <> p_expected then
    raise exception 'activity % is not a % activity', p_activity_id, p_expected
      using errcode = 'check_violation';
  end if;
end;
$$;

revoke all on function private.assert_activity_type(uuid, uuid, public.activity_type)
  from public, anon, authenticated;
