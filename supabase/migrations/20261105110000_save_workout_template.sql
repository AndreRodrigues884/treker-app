-- save_workout_template(p_template jsonb): saves a workout template and its list of exercises in
-- one request and one transaction. The template is upserted by its id, and the list is replaced:
-- exercises sent are upserted by their ids, in the order of the array (position 0, 1, 2...), and
-- the template's other exercises are marked deleted. The ids are made on the phone, so repeating
-- the same call after a network failure changes nothing and never duplicates a row.
--
-- p_template:
--   {
--     "id": uuid, "name": text, "notes": text | null,
--     "exercises": [
--       { "id": uuid, "exercise_id": uuid, "target_sets": int | null,
--         "target_reps_min": int | null, "target_reps_max": int | null,
--         "target_seconds": int | null, "notes": text | null }
--     ]
--   }
--
-- Security invoker: it runs as the athlete, so RLS and the table checks apply as for any write.
-- Another user's template cannot be written (the upsert's update policy fails) and another
-- user's custom exercises cannot be used (the reference trigger rejects them).

create function public.save_workout_template(p_template jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_template_id uuid;
  v_items jsonb;
begin
  if v_user_id is null then
    raise exception 'not signed in' using errcode = 'insufficient_privilege';
  end if;

  if pg_catalog.jsonb_typeof(p_template) is distinct from 'object' then
    raise exception 'p_template must be a JSON object' using errcode = 'invalid_parameter_value';
  end if;

  v_template_id := (p_template ->> 'id')::uuid;
  v_items := coalesce(p_template -> 'exercises', '[]'::jsonb);

  if v_template_id is null then
    raise exception 'p_template.id is required' using errcode = 'invalid_parameter_value';
  end if;
  if pg_catalog.jsonb_typeof(v_items) <> 'array' then
    raise exception 'p_template.exercises must be an array' using errcode = 'invalid_parameter_value';
  end if;
  if exists (
    select 1 from pg_catalog.jsonb_array_elements(v_items) as item
    where (item ->> 'id') is null or (item ->> 'exercise_id') is null
  ) then
    raise exception 'every exercise needs id and exercise_id' using errcode = 'invalid_parameter_value';
  end if;

  -- The template. A row with this id owned by someone else fails the update policy (42501).
  insert into public.workout_templates (id, user_id, name, notes)
  values (v_template_id, v_user_id, p_template ->> 'name', p_template ->> 'notes')
  on conflict (id) do update
  set name = excluded.name,
      notes = excluded.notes;

  -- A row id of this user's that belongs to another of their templates is a client bug: moving it
  -- would silently empty the other template.
  if exists (
    select 1
    from public.workout_template_exercises wte
    join pg_catalog.jsonb_array_elements(v_items) as item
      on wte.id = (item ->> 'id')::uuid
    where wte.template_id <> v_template_id
  ) then
    raise exception 'an exercise row belongs to another template'
      using errcode = 'invalid_parameter_value';
  end if;

  -- Exercises no longer in the list are marked deleted (never removed).
  update public.workout_template_exercises wte
  set deleted_at = now()
  where wte.template_id = v_template_id
    and wte.deleted_at is null
    and wte.id not in (
      select (item ->> 'id')::uuid from pg_catalog.jsonb_array_elements(v_items) as item
    );

  -- The list, in the order of the array. Rows sent again are updated (and undeleted).
  insert into public.workout_template_exercises (
    id, user_id, template_id, exercise_id, position,
    target_sets, target_reps_min, target_reps_max, target_seconds, notes
  )
  select
    (item.value ->> 'id')::uuid,
    v_user_id,
    v_template_id,
    (item.value ->> 'exercise_id')::uuid,
    (item.ordinality - 1)::smallint,
    (item.value ->> 'target_sets')::smallint,
    (item.value ->> 'target_reps_min')::smallint,
    (item.value ->> 'target_reps_max')::smallint,
    (item.value ->> 'target_seconds')::smallint,
    item.value ->> 'notes'
  from pg_catalog.jsonb_array_elements(v_items) with ordinality as item (value, ordinality)
  on conflict (id) do update
  set exercise_id = excluded.exercise_id,
      position = excluded.position,
      target_sets = excluded.target_sets,
      target_reps_min = excluded.target_reps_min,
      target_reps_max = excluded.target_reps_max,
      target_seconds = excluded.target_seconds,
      notes = excluded.notes,
      deleted_at = null;
end;
$$;

revoke all on function public.save_workout_template(jsonb) from public, anon;
grant execute on function public.save_workout_template(jsonb) to authenticated;
