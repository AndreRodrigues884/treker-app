-- list_activity_summaries(): one page of the athlete's workouts, newest first, each with the
-- numbers the profile list shows. The totals are computed here, next to the data, so the app never
-- loads every set or swim time to add them up.
--
-- Pages by cursor, never by offset: the first page passes no cursor; the next one passes the
-- (local_date, id) of the last row it got, and receives the rows strictly before it in the order
-- (local_date desc, id desc), which the index activities (user_id, local_date desc, id desc)
-- serves. Rows added or deleted meanwhile never make a page repeat or skip another row.
--
-- Per workout:
--   duration_s   ended_at - started_at in whole seconds; null until the workout has both.
--   set_count    gym: work sets (warm-ups left out, like the stats); swim: times logged.
--   volume_kg    gym: sum of weight x reps of the work sets, assistance (negative weight) as zero,
--                like exercise_stats.total_volume_kg; null for swimming.
--   distance_m   swim: total distance in metres (yard pools converted, 1 yd = 0.9144 m); null for
--                the gym.
-- Deleted workouts, sets and times are left out.
--
-- Security invoker with RLS: it only ever sees the caller's own rows.

create function public.list_activity_summaries(
  p_before_date date default null,
  p_before_id uuid default null,
  p_limit integer default 20
)
returns table (
  id uuid,
  type public.activity_type,
  title text,
  local_date date,
  started_at timestamptz,
  ended_at timestamptz,
  duration_s integer,
  set_count integer,
  volume_kg numeric,
  distance_m numeric
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  if (p_before_date is null) <> (p_before_id is null) then
    raise exception 'the cursor needs both p_before_date and p_before_id'
      using errcode = 'invalid_parameter_value';
  end if;

  return query
  select
    a.id,
    a.type,
    a.title,
    a.local_date,
    a.started_at,
    a.ended_at,
    case
      when a.started_at is not null and a.ended_at is not null
        then pg_catalog.floor(extract(epoch from a.ended_at - a.started_at))::integer
    end,
    coalesce(gym.set_count, swim.entry_count, 0)::integer,
    case when a.type = 'gym' then coalesce(gym.volume_kg, 0) end,
    case when a.type = 'swim' then coalesce(swim.distance_m, 0) end
  from public.activities a
  left join lateral (
    select
      count(*) as set_count,
      sum(greatest(coalesce(s.weight_kg, 0), 0) * coalesce(s.reps, 0)) as volume_kg
    from public.gym_sets s
    where s.activity_id = a.id
      and s.deleted_at is null
      and not s.is_warmup
  ) gym on a.type = 'gym'
  left join lateral (
    select
      count(*) as entry_count,
      sum(case when e.pool_length = '25yd' then e.distance * 0.9144 else e.distance end)
        as distance_m
    from public.swim_entries e
    where e.activity_id = a.id
      and e.deleted_at is null
  ) swim on a.type = 'swim'
  where a.user_id = (select auth.uid())
    and a.deleted_at is null
    and (p_before_date is null or (a.local_date, a.id) < (p_before_date, p_before_id))
  order by a.local_date desc, a.id desc
  -- At most 50 rows a page, well under the API's max_rows.
  limit least(greatest(coalesce(p_limit, 20), 1), 50);
end;
$$;

revoke all on function public.list_activity_summaries(date, uuid, integer) from public, anon;
grant execute on function public.list_activity_summaries(date, uuid, integer) to authenticated;
