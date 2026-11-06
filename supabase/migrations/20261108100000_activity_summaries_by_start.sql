-- Workouts on the same day are listed by their start time, not by id (which is random).
-- The order of list_activity_summaries becomes (local_date desc, started_at desc nulls last,
-- id desc), and its cursor gains the start time of the last row received. Workouts without a
-- start time come after the others of their day; the id only breaks exact ties.
--
-- The signature changes (a new cursor argument), so the old function is dropped. No released app
-- calls it yet.

drop function public.list_activity_summaries(date, uuid, integer);

-- The index that serves this order (and the calendar's ranges by user and date, like the one it
-- replaces).
create index activities_user_id_local_date_started_at_idx
on public.activities (user_id, local_date desc, started_at desc nulls last, id desc);

drop index public.activities_user_id_local_date_idx;

create function public.list_activity_summaries(
  p_before_date date default null,
  p_before_started_at timestamptz default null,
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
  -- The cursor is the (local_date, started_at, id) of the last row received; started_at may be
  -- null (that row had no start time), the date and id may not.
  if (p_before_date is null) <> (p_before_id is null)
     or (p_before_date is null and p_before_started_at is not null) then
    raise exception 'the cursor needs p_before_date and p_before_id (and that row''s started_at)'
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
    and (
      p_before_date is null
      -- An earlier day.
      or a.local_date < p_before_date
      -- The same day, after the cursor in (started_at desc nulls last, id desc).
      or (
        a.local_date = p_before_date
        and case
          when p_before_started_at is null
            -- The cursor had no start time: only the rows without one, by id.
            then a.started_at is null and a.id < p_before_id
          else
            a.started_at < p_before_started_at
            or a.started_at is null
            or (a.started_at = p_before_started_at and a.id < p_before_id)
        end
      )
    )
  order by a.local_date desc, a.started_at desc nulls last, a.id desc
  -- At most 50 rows a page, well under the API's max_rows.
  limit least(greatest(coalesce(p_limit, 20), 1), 50);
end;
$$;

revoke all on function public.list_activity_summaries(date, timestamptz, uuid, integer)
from public, anon;
grant execute on function public.list_activity_summaries(date, timestamptz, uuid, integer)
to authenticated;
