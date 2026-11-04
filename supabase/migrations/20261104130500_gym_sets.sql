-- Sets of a gym activity.

create table public.gym_sets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  activity_id uuid not null,
  exercise_id uuid not null references public.exercises (id),
  -- Order of the exercise within the session, then of the set within the exercise.
  exercise_position smallint not null check (exercise_position >= 0),
  set_number smallint not null check (set_number between 1 and 100),
  -- External load in kg (3 decimals so lb values round-trip). For bodyweight exercises this is
  -- the added weight; negative means assistance (assisted pull-up machine).
  weight_kg numeric(7, 3) check (weight_kg between -300 and 1000),
  reps smallint check (reps between 1 and 1000),
  -- For exercises measured in seconds.
  duration_s integer check (duration_s between 1 and 86400),
  -- Rate of perceived exertion, 1 to 10 in steps of 0.5.
  rpe numeric(3, 1) check (rpe between 1 and 10 and rpe * 2 = trunc(rpe * 2)),
  -- Warm-up sets are excluded from volume, 1RM and PRs.
  is_warmup boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  -- The activity must belong to the same user.
  foreign key (activity_id, user_id)
    references public.activities (id, user_id) on delete cascade,
  -- Either reps or seconds, never both or neither.
  check (num_nonnulls(reps, duration_s) = 1)
);

create index gym_sets_activity_id_idx on public.gym_sets (activity_id);
create index gym_sets_user_id_exercise_id_idx on public.gym_sets (user_id, exercise_id);
create index gym_sets_user_id_updated_at_idx on public.gym_sets (user_id, updated_at);

create trigger set_timestamps
before insert or update on public.gym_sets
for each row execute function private.set_timestamps();

-- Rules that need other tables: the activity is a gym activity, the exercise is available to
-- the user, and the set matches how the exercise is measured.
create function private.check_gym_set()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_exercise record;
begin
  perform private.assert_activity_type(new.activity_id, new.user_id, 'gym');
  perform private.assert_exercise_available(new.exercise_id, new.user_id);

  select e.unit, e.tracks_load, e.adds_bodyweight into v_exercise
  from public.exercises e
  where e.id = new.exercise_id;

  if not found then
    return new;
  end if;

  if v_exercise.unit = 'reps' and new.reps is null then
    raise exception 'exercise % is measured in reps', new.exercise_id
      using errcode = 'check_violation';
  end if;
  if v_exercise.unit = 'seconds' and new.duration_s is null then
    raise exception 'exercise % is measured in seconds', new.exercise_id
      using errcode = 'check_violation';
  end if;
  if not v_exercise.tracks_load and new.weight_kg is not null then
    raise exception 'exercise % does not track load', new.exercise_id
      using errcode = 'check_violation';
  end if;
  if new.weight_kg < 0 and not v_exercise.adds_bodyweight then
    raise exception 'negative weight is only allowed on bodyweight exercises'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

revoke all on function private.check_gym_set() from public, anon, authenticated;

create trigger check_references
before insert or update of activity_id, exercise_id, user_id, weight_kg, reps, duration_s
on public.gym_sets
for each row execute function private.check_gym_set();

-- Access ---------------------------------------------------------------------------------------

alter table public.gym_sets enable row level security;

revoke all on table public.gym_sets from anon, authenticated;
grant select, insert, update on table public.gym_sets to authenticated;

create policy "gym_sets: owner can read"
on public.gym_sets for select to authenticated
using (user_id = (select auth.uid()));

create policy "gym_sets: owner can insert"
on public.gym_sets for insert to authenticated
with check (user_id = (select auth.uid()));

create policy "gym_sets: owner can update"
on public.gym_sets for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));
