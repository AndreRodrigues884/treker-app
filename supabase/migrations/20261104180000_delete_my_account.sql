-- Deleting an account (GDPR). Removes the caller's auth user; every table with user data
-- references auth.users with on delete cascade, so profile, workouts, sets, times, records and
-- stats go with it in the same transaction.

create function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  -- The identity always comes from the token, never from a parameter.
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'not signed in' using errcode = 'insufficient_privilege';
  end if;

  delete from auth.users where id = v_user_id;
end;
$$;

comment on function public.delete_my_account() is
  'Deletes the signed-in user and, by cascade, all of their data.';

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
