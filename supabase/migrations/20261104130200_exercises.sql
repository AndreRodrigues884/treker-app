-- Exercises: a shared library (owner_id null, managed only by migrations and seeds) plus custom
-- exercises owned by a user. The muscle group is a label, not a way to navigate the app.

create table public.exercises (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users (id) on delete cascade,
  -- Stable key for library exercises across environments; custom exercises have none.
  slug text unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  -- Custom exercises store the user's name in both columns.
  name_en text not null check (char_length(btrim(name_en)) between 1 and 80),
  name_pt text not null check (char_length(btrim(name_pt)) between 1 and 80),
  muscle_group public.muscle_group not null,
  equipment public.equipment not null,
  -- False for exercises with no external load (e.g. plank).
  tracks_load boolean not null default true,
  unit public.exercise_unit not null default 'reps',
  -- True when the athlete's bodyweight is part of the load (pull-ups, dips).
  adds_bodyweight boolean not null default false,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint exercises_library_has_slug check ((owner_id is null) = (slug is not null))
);

create index exercises_owner_id_updated_at_idx on public.exercises (owner_id, updated_at)
where owner_id is not null;

create trigger set_timestamps
before insert or update on public.exercises
for each row execute function private.set_timestamps();

-- Access ---------------------------------------------------------------------------------------
-- Everyone signed in reads the library; each user reads and changes only their own custom
-- exercises. No policy allows writing rows with owner_id null, so the library is read-only
-- through the API. Deleting means setting deleted_at.

alter table public.exercises enable row level security;

revoke all on table public.exercises from anon, authenticated;
grant select, insert, update on table public.exercises to authenticated;

create policy "exercises: read library and own"
on public.exercises for select to authenticated
using (owner_id is null or owner_id = (select auth.uid()));

create policy "exercises: owner can insert"
on public.exercises for insert to authenticated
with check (owner_id = (select auth.uid()));

create policy "exercises: owner can update"
on public.exercises for update to authenticated
using (owner_id = (select auth.uid()))
with check (owner_id = (select auth.uid()));

-- Reference check ------------------------------------------------------------------------------
-- Rows of other tables may only use library exercises or the row owner's own exercises. Runs as
-- a trigger (not only RLS) so it also holds inside security definer functions.

create function private.assert_exercise_available(p_exercise_id uuid, p_user_id uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_owner_id uuid;
begin
  select e.owner_id into v_owner_id from public.exercises e where e.id = p_exercise_id;
  -- A missing exercise is reported by the foreign key.
  if found and v_owner_id is not null and v_owner_id <> p_user_id then
    raise exception 'exercise % is not available to this user', p_exercise_id
      using errcode = 'foreign_key_violation';
  end if;
end;
$$;

revoke all on function private.assert_exercise_available(uuid, uuid) from public, anon, authenticated;
