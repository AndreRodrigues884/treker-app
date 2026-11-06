-- delete_custom_exercise(p_exercise_id uuid): deletes one of the athlete's own exercises in one
-- request and one transaction:
--   - the exercise is marked deleted (deleted_at), so it leaves the library;
--   - its rows in the athlete's saved workouts (workout_template_exercises) are marked deleted,
--     so it leaves every template too.
-- Logged sets keep pointing at it, so past workouts, records and stats stay exactly as they were
-- (the records rebuild does not look at the exercise's deleted_at).
--
-- Security invoker: it runs as the athlete, so RLS applies. A library exercise or another user's
-- exercise is not found (no_data_found). Calling it again for a deleted exercise changes nothing.

create function public.delete_custom_exercise(p_exercise_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_deleted_at timestamptz;
begin
  select e.deleted_at into v_deleted_at
  from public.exercises e
  where e.id = p_exercise_id
    and e.owner_id = (select auth.uid());

  if not found then
    raise exception 'custom exercise % not found', p_exercise_id using errcode = 'no_data_found';
  end if;

  -- Already deleted (a retry after a network failure): nothing to do.
  if v_deleted_at is not null then
    return;
  end if;

  update public.workout_template_exercises wte
  set deleted_at = now()
  where wte.exercise_id = p_exercise_id
    and wte.user_id = (select auth.uid())
    and wte.deleted_at is null;

  update public.exercises e
  set deleted_at = now()
  where e.id = p_exercise_id;
end;
$$;

revoke all on function public.delete_custom_exercise(uuid) from public, anon;
grant execute on function public.delete_custom_exercise(uuid) to authenticated;
