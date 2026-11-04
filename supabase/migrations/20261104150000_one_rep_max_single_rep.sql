-- A single rep is a real 1RM, not an estimate: with 1 rep the 1RM is the weight itself. Epley still
-- applies from 2 to 12 reps. Keep in sync with src/core/records/one-rep-max.ts; both are tested
-- against supabase/tests/fixtures/one-rep-max-cases.json.

create or replace function private.estimate_one_rep_max(
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
    -- One rep: the weight lifted (for bodyweight exercises, the added weight).
    when p_reps = 1 then pg_catalog.round(coalesce(p_weight_kg, 0), 2)
    -- Epley: (weight + bw) x (1 + reps / 30) - bw.
    when p_adds_bodyweight then pg_catalog.round(
      ((coalesce(p_weight_kg, 0) + p_bodyweight_kg) * (30 + p_reps) - 30 * p_bodyweight_kg) / 30,
      2
    )
    else pg_catalog.round(p_weight_kg * (30 + p_reps) / 30, 2)
  end;
$$;

-- Existing records of single-rep sets were computed with the old rule: rebuild every gym key.
select private.rebuild_records(
  array(select distinct row(s.user_id, s.exercise_id)::private.gym_key from public.gym_sets s),
  null
);
