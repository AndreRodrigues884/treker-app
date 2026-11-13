-- volume_by_muscle_group also returns how many workouts trained each muscle group (the Statistics
-- screen shows "workouts logged per muscle group"). A new column changes the return type, so the
-- function is dropped and created again, with the same rules and grants.

drop function public.volume_by_muscle_group(date, date);

create function public.volume_by_muscle_group(p_from date, p_to date)
returns table (
  muscle_group public.muscle_group,
  volume_kg numeric,
  set_count integer,
  workout_count integer
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    e.muscle_group,
    sum(greatest(coalesce(s.weight_kg, 0), 0) * coalesce(s.reps, 0)),
    count(*)::integer,
    count(distinct a.id)::integer
  from public.activities a
  join public.gym_sets s on s.activity_id = a.id
  join public.exercises e on e.id = s.exercise_id
  where a.user_id = (select auth.uid())
    and a.deleted_at is null
    and a.type = 'gym'
    and (p_from is null or a.local_date >= p_from)
    and a.local_date <= p_to
    and s.deleted_at is null
    and not s.is_warmup
  group by e.muscle_group
  order by 4 desc, 2 desc, e.muscle_group;
$$;

revoke all on function public.volume_by_muscle_group(date, date) from public, anon;
grant execute on function public.volume_by_muscle_group(date, date) to authenticated;
