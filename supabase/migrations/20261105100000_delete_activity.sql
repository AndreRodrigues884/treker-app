-- Deleting an activity in one call: the activity, its gym sets and its swim times are marked
-- deleted_at in a single transaction, and the derived records are rebuilt once per key.
--
-- Records: marking the children deleted would fire their own rebuild triggers, and marking the
-- activity deleted fires the activity's trigger, which rebuilds the same keys again. The function
-- sets the transaction-local flag treker.defer_record_rebuild while it updates the children, so
-- their triggers skip; the final update of the activity then rebuilds every key of the activity
-- once. Users cannot set the flag themselves: the API only exposes functions in public, and each
-- request is its own transaction.

-- Update triggers of gym_sets and swim_entries, now skipping while the flag is on. --------------

create or replace function private.gym_sets_records_after_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- delete_activity rebuilds these keys itself, once (see above).
  if pg_catalog.current_setting('treker.defer_record_rebuild', true) = 'on' then
    return null;
  end if;

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

create or replace function private.swim_entries_records_after_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- delete_activity rebuilds these keys itself, once (see above).
  if pg_catalog.current_setting('treker.defer_record_rebuild', true) = 'on' then
    return null;
  end if;

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

-- delete_activity -------------------------------------------------------------------------------

-- Runs as the caller (security invoker), so RLS applies: only the caller's own activity can be
-- found and changed. Calling it again for an already deleted activity changes nothing.
create function public.delete_activity(p_activity_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_deleted_at timestamptz;
begin
  select a.deleted_at into v_deleted_at
  from public.activities a
  where a.id = p_activity_id and a.user_id = (select auth.uid());

  if not found then
    raise exception 'activity % not found', p_activity_id using errcode = 'no_data_found';
  end if;

  -- Already deleted: nothing to do, so retrying after a network failure is harmless.
  if v_deleted_at is not null then
    return;
  end if;

  perform pg_catalog.set_config('treker.defer_record_rebuild', 'on', true);

  update public.gym_sets
  set deleted_at = pg_catalog.now()
  where activity_id = p_activity_id and deleted_at is null;

  update public.swim_entries
  set deleted_at = pg_catalog.now()
  where activity_id = p_activity_id and deleted_at is null;

  perform pg_catalog.set_config('treker.defer_record_rebuild', 'off', true);

  -- The activity's trigger rebuilds every record key of its sets and times, once each.
  update public.activities
  set deleted_at = pg_catalog.now()
  where id = p_activity_id;
end;
$$;

comment on function public.delete_activity(uuid) is
  'Marks an activity and its sets and swim times deleted in one transaction; rebuilds records once.';

revoke all on function public.delete_activity(uuid) from public, anon;
grant execute on function public.delete_activity(uuid) to authenticated;
