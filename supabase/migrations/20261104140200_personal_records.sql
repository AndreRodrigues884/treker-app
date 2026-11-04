-- Personal records and exercise stats. Both are derived data: never written by the app or by
-- users, always rebuilt from the sets and times, so editing or deleting an old entry leaves
-- them right.

-- Tables -----------------------------------------------------------------------------------------

-- History of records: each row is a moment when the all-time best of a key improved.
-- Gym key: (user_id, exercise_id). Swim key: (user_id, stroke, distance, pool_length).
create table public.personal_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  type public.activity_type not null,
  exercise_id uuid references public.exercises (id) on delete cascade,
  stroke public.swim_stroke,
  distance smallint,
  pool_length public.pool_length,
  -- Gym: estimated 1RM in kg (higher is better). Swim: time in centiseconds (lower is better).
  value numeric(10, 2) not null,
  -- The best before this record; null for the first record of a key.
  previous_value numeric(10, 2),
  -- 1, 2, 3... in the order the records were set within the key.
  sequence integer not null check (sequence >= 1),
  -- Where the record came from.
  activity_id uuid not null references public.activities (id) on delete cascade,
  gym_set_id uuid unique references public.gym_sets (id) on delete cascade,
  swim_entry_id uuid unique references public.swim_entries (id) on delete cascade,
  swim_kind public.swim_kind,
  local_date date not null,
  created_at timestamptz not null default now(),
  check (
    (
      type = 'gym'
      and exercise_id is not null and gym_set_id is not null
      and stroke is null and distance is null and pool_length is null
      and swim_entry_id is null and swim_kind is null
    )
    or (
      type = 'swim'
      and exercise_id is null and gym_set_id is null
      and stroke is not null and distance is not null and pool_length is not null
      and swim_entry_id is not null and swim_kind is not null
    )
  )
);

create index personal_records_gym_key_idx
on public.personal_records (user_id, exercise_id, sequence)
where type = 'gym';

create index personal_records_swim_key_idx
on public.personal_records (user_id, stroke, distance, pool_length, sequence)
where type = 'swim';

create index personal_records_activity_id_idx on public.personal_records (activity_id);

create table public.exercise_stats (
  user_id uuid not null references auth.users (id) on delete cascade,
  exercise_id uuid not null references public.exercises (id) on delete cascade,
  best_one_rep_max_kg numeric(10, 2),
  -- Sum of weight x reps of working sets; assistance (negative weight) counts as zero.
  total_volume_kg numeric(14, 3) not null default 0,
  -- Working sets (warm-ups excluded).
  set_count integer not null default 0,
  last_local_date date,
  updated_at timestamptz not null default now(),
  primary key (user_id, exercise_id)
);

-- The current best of each key: the last record in its history.
create view public.current_records
with (security_invoker = true)
as
select distinct on (user_id, type, exercise_id, stroke, distance, pool_length)
  id,
  user_id,
  type,
  exercise_id,
  stroke,
  distance,
  pool_length,
  value,
  previous_value,
  sequence,
  activity_id,
  gym_set_id,
  swim_entry_id,
  swim_kind,
  local_date
from public.personal_records
order by user_id, type, exercise_id, stroke, distance, pool_length, sequence desc;

-- Access -----------------------------------------------------------------------------------------
-- Users only read their own rows. Only the rebuild functions below write.

alter table public.personal_records enable row level security;
alter table public.exercise_stats enable row level security;

revoke all on table public.personal_records from anon, authenticated;
revoke all on table public.exercise_stats from anon, authenticated;
revoke all on table public.current_records from anon, authenticated;
grant select on table public.personal_records to authenticated;
grant select on table public.exercise_stats to authenticated;
grant select on table public.current_records to authenticated;

create policy "personal_records: owner can read"
on public.personal_records for select to authenticated
using (user_id = (select auth.uid()));

create policy "exercise_stats: owner can read"
on public.exercise_stats for select to authenticated
using (user_id = (select auth.uid()));

-- 1RM --------------------------------------------------------------------------------------------
-- Epley: (weight + bw) x (1 + reps / 30) - bw, where bw is the bodyweight for exercises that add
-- it and 0 otherwise. Rounded to 0.01 kg, half away from zero. Returns null when the set does not
-- count. Keep in sync with src/core/records/one-rep-max.ts; both are tested against
-- supabase/tests/fixtures/one-rep-max-cases.json.

create function private.estimate_one_rep_max(
  p_weight_kg numeric,
  p_reps integer,
  p_is_warmup boolean,
  p_unit public.exercise_unit,
  p_tracks_load boolean,
  p_adds_bodyweight boolean,
  p_bodyweight_kg numeric
)
returns numeric
language sql
immutable
set search_path = ''
as $$
  select case
    -- Warm-ups, timed or unloaded exercises, and sets above 12 reps (where Epley stops being
    -- reliable) do not count.
    when p_is_warmup or p_unit <> 'reps' or not p_tracks_load then null
    when p_reps is null or p_reps not between 1 and 12 then null
    -- Bodyweight exercises need the bodyweight of the day; a missing weight means none added.
    when p_adds_bodyweight and p_bodyweight_kg is null then null
    when not p_adds_bodyweight and p_weight_kg is null then null
    when p_adds_bodyweight then pg_catalog.round(
      ((coalesce(p_weight_kg, 0) + p_bodyweight_kg) * (30 + p_reps) - 30 * p_bodyweight_kg) / 30,
      2
    )
    else pg_catalog.round(p_weight_kg * (30 + p_reps) / 30, 2)
  end;
$$;

revoke all on function private.estimate_one_rep_max(
  numeric, integer, boolean, public.exercise_unit, boolean, boolean, numeric
) from public, anon, authenticated;

-- Rebuild ----------------------------------------------------------------------------------------

create type private.gym_key as (user_id uuid, exercise_id uuid);
create type private.swim_key as (
  user_id uuid,
  stroke public.swim_stroke,
  distance smallint,
  pool_length public.pool_length
);

-- Counts rebuilds in the current transaction (setting treker.record_rebuilds). Tests use it to
-- check that each key is rebuilt once per statement.
create function private.count_record_rebuild()
returns void
language sql
set search_path = ''
as $$
  select pg_catalog.set_config(
    'treker.record_rebuilds',
    (coalesce(nullif(pg_catalog.current_setting('treker.record_rebuilds', true), ''), '0')::integer + 1)::text,
    true
  );
$$;

-- Rebuilds the records and stats of one gym key from its full history.
create function private.rebuild_gym_key(p_user_id uuid, p_exercise_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_set record;
  v_best numeric;
  v_sequence integer := 0;
begin
  perform private.count_record_rebuild();

  delete from public.personal_records
  where user_id = p_user_id and type = 'gym' and exercise_id = p_exercise_id;

  for v_set in
    select
      s.id,
      s.activity_id,
      a.local_date,
      private.estimate_one_rep_max(
        s.weight_kg, s.reps, s.is_warmup, e.unit, e.tracks_load, e.adds_bodyweight, a.bodyweight_kg
      ) as one_rep_max
    from public.gym_sets s
    join public.activities a on a.id = s.activity_id
    join public.exercises e on e.id = s.exercise_id
    where s.user_id = p_user_id
      and s.exercise_id = p_exercise_id
      and s.deleted_at is null
      and a.deleted_at is null
    order by
      a.local_date, a.started_at nulls last, a.created_at, a.id,
      s.exercise_position, s.set_number, s.id
  loop
    if v_set.one_rep_max is not null and (v_best is null or v_set.one_rep_max > v_best) then
      v_sequence := v_sequence + 1;
      insert into public.personal_records (
        user_id, type, exercise_id, value, previous_value, sequence,
        activity_id, gym_set_id, local_date
      )
      values (
        p_user_id, 'gym', p_exercise_id, v_set.one_rep_max, v_best, v_sequence,
        v_set.activity_id, v_set.id, v_set.local_date
      );
      v_best := v_set.one_rep_max;
    end if;
  end loop;

  delete from public.exercise_stats where user_id = p_user_id and exercise_id = p_exercise_id;

  insert into public.exercise_stats (
    user_id, exercise_id, best_one_rep_max_kg, total_volume_kg, set_count, last_local_date
  )
  select
    p_user_id,
    p_exercise_id,
    v_best,
    coalesce(sum(greatest(s.weight_kg, 0) * s.reps) filter (where not s.is_warmup), 0),
    count(*) filter (where not s.is_warmup),
    max(a.local_date)
  from public.gym_sets s
  join public.activities a on a.id = s.activity_id
  where s.user_id = p_user_id
    and s.exercise_id = p_exercise_id
    and s.deleted_at is null
    and a.deleted_at is null
  having count(*) > 0;
end;
$$;

-- Rebuilds the records of one swim key from its full history. Races and training both count.
create function private.rebuild_swim_key(
  p_user_id uuid,
  p_stroke public.swim_stroke,
  p_distance smallint,
  p_pool_length public.pool_length
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_entry record;
  v_best integer;
  v_sequence integer := 0;
begin
  perform private.count_record_rebuild();

  delete from public.personal_records
  where user_id = p_user_id
    and type = 'swim'
    and stroke = p_stroke
    and distance = p_distance
    and pool_length = p_pool_length;

  for v_entry in
    select w.id, w.activity_id, w.time_cs, w.kind, a.local_date
    from public.swim_entries w
    join public.activities a on a.id = w.activity_id
    where w.user_id = p_user_id
      and w.stroke = p_stroke
      and w.distance = p_distance
      and w.pool_length = p_pool_length
      and w.deleted_at is null
      and a.deleted_at is null
    order by a.local_date, a.started_at nulls last, a.created_at, a.id, w.position, w.id
  loop
    if v_best is null or v_entry.time_cs < v_best then
      v_sequence := v_sequence + 1;
      insert into public.personal_records (
        user_id, type, stroke, distance, pool_length, value, previous_value, sequence,
        activity_id, swim_entry_id, swim_kind, local_date
      )
      values (
        p_user_id, 'swim', p_stroke, p_distance, p_pool_length, v_entry.time_cs, v_best, v_sequence,
        v_entry.activity_id, v_entry.id, v_entry.kind, v_entry.local_date
      );
      v_best := v_entry.time_cs;
    end if;
  end loop;
end;
$$;

-- Rebuilds each distinct key once. Takes a transaction-level advisory lock per user first, in a
-- fixed order, so two concurrent saves for the same user wait for each other (and cannot
-- deadlock) instead of both writing records from stale data.
create function private.rebuild_records(
  p_gym_keys private.gym_key[],
  p_swim_keys private.swim_key[]
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_gym private.gym_key;
  v_swim private.swim_key;
begin
  for v_user_id in
    select k.user_id from unnest(p_gym_keys) k
    union
    select k.user_id from unnest(p_swim_keys) k
    order by 1
  loop
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended('treker.records:' || v_user_id::text, 0)
    );
  end loop;

  for v_gym in select distinct k.user_id, k.exercise_id from unnest(p_gym_keys) k loop
    perform private.rebuild_gym_key(v_gym.user_id, v_gym.exercise_id);
  end loop;

  for v_swim in
    select distinct k.user_id, k.stroke, k.distance, k.pool_length from unnest(p_swim_keys) k
  loop
    perform private.rebuild_swim_key(v_swim.user_id, v_swim.stroke, v_swim.distance, v_swim.pool_length);
  end loop;
end;
$$;

revoke all on function private.count_record_rebuild() from public, anon, authenticated;
revoke all on function private.rebuild_gym_key(uuid, uuid) from public, anon, authenticated;
revoke all on function private.rebuild_swim_key(
  uuid, public.swim_stroke, smallint, public.pool_length
) from public, anon, authenticated;
revoke all on function private.rebuild_records(private.gym_key[], private.swim_key[])
  from public, anon, authenticated;

-- Statement-level triggers -----------------------------------------------------------------------
-- Each statement collects the keys it touched from its transition tables and rebuilds each key
-- once, however many rows it changed. Postgres allows transition tables on single-event triggers
-- only, hence one function per event.

-- Gym sets

create function private.gym_sets_records_after_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.rebuild_records(
    array(select row(n.user_id, n.exercise_id)::private.gym_key from new_rows n),
    null
  );
  return null;
end;
$$;

create function private.gym_sets_records_after_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.rebuild_records(
    array(
      select row(k.user_id, k.exercise_id)::private.gym_key
      from old_rows o
      join new_rows n on n.id = o.id
      cross join lateral (values (o.user_id, o.exercise_id), (n.user_id, n.exercise_id))
        as k (user_id, exercise_id)
      -- Only changes that can affect records or stats (rpe, for example, cannot).
      where (o.exercise_id, o.activity_id, o.exercise_position, o.set_number, o.weight_kg, o.reps,
             o.duration_s, o.is_warmup, o.deleted_at)
        is distinct from
            (n.exercise_id, n.activity_id, n.exercise_position, n.set_number, n.weight_kg, n.reps,
             n.duration_s, n.is_warmup, n.deleted_at)
    ),
    null
  );
  return null;
end;
$$;

create function private.gym_sets_records_after_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.rebuild_records(
    array(select row(o.user_id, o.exercise_id)::private.gym_key from old_rows o),
    null
  );
  return null;
end;
$$;

create trigger rebuild_records_after_insert
after insert on public.gym_sets
referencing new table as new_rows
for each statement execute function private.gym_sets_records_after_insert();

create trigger rebuild_records_after_update
after update on public.gym_sets
referencing old table as old_rows new table as new_rows
for each statement execute function private.gym_sets_records_after_update();

create trigger rebuild_records_after_delete
after delete on public.gym_sets
referencing old table as old_rows
for each statement execute function private.gym_sets_records_after_delete();

-- Swim entries

create function private.swim_entries_records_after_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.rebuild_records(
    null,
    array(
      select row(n.user_id, n.stroke, n.distance, n.pool_length)::private.swim_key from new_rows n
    )
  );
  return null;
end;
$$;

create function private.swim_entries_records_after_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.rebuild_records(
    null,
    array(
      select row(k.user_id, k.stroke, k.distance, k.pool_length)::private.swim_key
      from old_rows o
      join new_rows n on n.id = o.id
      cross join lateral (
        values
          (o.user_id, o.stroke, o.distance, o.pool_length),
          (n.user_id, n.stroke, n.distance, n.pool_length)
      ) as k (user_id, stroke, distance, pool_length)
      where (o.stroke, o.distance, o.pool_length, o.time_cs, o.kind, o.activity_id, o.position,
             o.deleted_at)
        is distinct from
            (n.stroke, n.distance, n.pool_length, n.time_cs, n.kind, n.activity_id, n.position,
             n.deleted_at)
    )
  );
  return null;
end;
$$;

create function private.swim_entries_records_after_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.rebuild_records(
    null,
    array(
      select row(o.user_id, o.stroke, o.distance, o.pool_length)::private.swim_key from old_rows o
    )
  );
  return null;
end;
$$;

create trigger rebuild_records_after_insert
after insert on public.swim_entries
referencing new table as new_rows
for each statement execute function private.swim_entries_records_after_insert();

create trigger rebuild_records_after_update
after update on public.swim_entries
referencing old table as old_rows new table as new_rows
for each statement execute function private.swim_entries_records_after_update();

create trigger rebuild_records_after_delete
after delete on public.swim_entries
referencing old table as old_rows
for each statement execute function private.swim_entries_records_after_delete();

-- Activities: the date, start time (order within a day), bodyweight or deletion changed.

create function private.activities_records_after_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_changed uuid[];
begin
  v_changed := array(
    select n.id
    from old_rows o
    join new_rows n on n.id = o.id
    where (o.local_date, o.started_at, o.bodyweight_kg, o.deleted_at)
      is distinct from (n.local_date, n.started_at, n.bodyweight_kg, n.deleted_at)
  );

  if cardinality(v_changed) = 0 then
    return null;
  end if;

  perform private.rebuild_records(
    array(
      select row(s.user_id, s.exercise_id)::private.gym_key
      from public.gym_sets s
      where s.activity_id = any (v_changed)
    ),
    array(
      select row(w.user_id, w.stroke, w.distance, w.pool_length)::private.swim_key
      from public.swim_entries w
      where w.activity_id = any (v_changed)
    )
  );
  return null;
end;
$$;

create trigger rebuild_records_after_update
after update on public.activities
referencing old table as old_rows new table as new_rows
for each statement execute function private.activities_records_after_update();

-- Exercises: how an exercise is measured changed (custom exercises, or the library through a
-- migration), so every user's sets of it are re-evaluated.

create function private.exercises_records_after_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.rebuild_records(
    array(
      select row(s.user_id, s.exercise_id)::private.gym_key
      from old_rows o
      join new_rows n on n.id = o.id
      join public.gym_sets s on s.exercise_id = n.id
      where (o.unit, o.tracks_load, o.adds_bodyweight)
        is distinct from (n.unit, n.tracks_load, n.adds_bodyweight)
    ),
    null
  );
  return null;
end;
$$;

create trigger rebuild_records_after_update
after update on public.exercises
referencing old table as old_rows new table as new_rows
for each statement execute function private.exercises_records_after_update();

revoke all on function private.gym_sets_records_after_insert() from public, anon, authenticated;
revoke all on function private.gym_sets_records_after_update() from public, anon, authenticated;
revoke all on function private.gym_sets_records_after_delete() from public, anon, authenticated;
revoke all on function private.swim_entries_records_after_insert() from public, anon, authenticated;
revoke all on function private.swim_entries_records_after_update() from public, anon, authenticated;
revoke all on function private.swim_entries_records_after_delete() from public, anon, authenticated;
revoke all on function private.activities_records_after_update() from public, anon, authenticated;
revoke all on function private.exercises_records_after_update() from public, anon, authenticated;
