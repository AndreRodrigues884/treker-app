-- Saved workouts ("Push A") and the ordered exercises in each, with target sets and reps.

create table public.workout_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  notes text check (char_length(notes) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  -- Target of composite foreign keys that also check the owner.
  unique (id, user_id)
);

create index workout_templates_user_id_updated_at_idx
on public.workout_templates (user_id, updated_at);

create trigger set_timestamps
before insert or update on public.workout_templates
for each row execute function private.set_timestamps();

create table public.workout_template_exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  template_id uuid not null,
  exercise_id uuid not null references public.exercises (id),
  -- Order in the workout; ties are broken by id.
  position smallint not null check (position >= 0),
  target_sets smallint check (target_sets between 1 and 20),
  -- A range such as 8-12; min = max for a fixed target.
  target_reps_min smallint check (target_reps_min between 1 and 1000),
  target_reps_max smallint check (target_reps_max between 1 and 1000),
  -- For exercises measured in seconds (plank).
  target_seconds smallint check (target_seconds between 1 and 3600),
  notes text check (char_length(notes) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  -- The template must belong to the same user.
  foreign key (template_id, user_id)
    references public.workout_templates (id, user_id) on delete cascade,
  check (target_reps_min <= target_reps_max)
);

create index workout_template_exercises_template_id_position_idx
on public.workout_template_exercises (template_id, position);

create index workout_template_exercises_user_id_updated_at_idx
on public.workout_template_exercises (user_id, updated_at);

create trigger set_timestamps
before insert or update on public.workout_template_exercises
for each row execute function private.set_timestamps();

create function private.check_workout_template_exercise()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.assert_exercise_available(new.exercise_id, new.user_id);
  return new;
end;
$$;

revoke all on function private.check_workout_template_exercise() from public, anon, authenticated;

create trigger check_references
before insert or update of exercise_id, user_id on public.workout_template_exercises
for each row execute function private.check_workout_template_exercise();

-- Access ---------------------------------------------------------------------------------------
-- Owner only. Deleting means setting deleted_at, so users get no delete.

alter table public.workout_templates enable row level security;
alter table public.workout_template_exercises enable row level security;

revoke all on table public.workout_templates from anon, authenticated;
revoke all on table public.workout_template_exercises from anon, authenticated;
grant select, insert, update on table public.workout_templates to authenticated;
grant select, insert, update on table public.workout_template_exercises to authenticated;

create policy "workout_templates: owner can read"
on public.workout_templates for select to authenticated
using (user_id = (select auth.uid()));

create policy "workout_templates: owner can insert"
on public.workout_templates for insert to authenticated
with check (user_id = (select auth.uid()));

create policy "workout_templates: owner can update"
on public.workout_templates for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create policy "workout_template_exercises: owner can read"
on public.workout_template_exercises for select to authenticated
using (user_id = (select auth.uid()));

create policy "workout_template_exercises: owner can insert"
on public.workout_template_exercises for insert to authenticated
with check (user_id = (select auth.uid()));

create policy "workout_template_exercises: owner can update"
on public.workout_template_exercises for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));
