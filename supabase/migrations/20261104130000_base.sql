-- Building blocks shared by every table: a private schema for internal functions (not exposed
-- through the Data API), the enums used by the v1 tables, and the timestamp trigger.

create schema if not exists private;
revoke all on schema private from public;
-- Needed so check constraints that call private functions work for API users.
grant usage on schema private to authenticated, service_role;

-- Enums ---------------------------------------------------------------------------------------
-- New values can be added later with `alter type ... add value` without breaking old app versions.

create type public.weight_unit as enum ('kg', 'lb');
create type public.pool_unit as enum ('m', 'yd');
create type public.visibility as enum ('private', 'followers', 'public');
create type public.activity_type as enum ('gym', 'swim');

create type public.muscle_group as enum (
  'chest',
  'back',
  'shoulders',
  'biceps',
  'triceps',
  'forearms',
  'core',
  'quads',
  'hamstrings',
  'glutes',
  'calves',
  'full_body'
);

create type public.equipment as enum (
  'barbell',
  'dumbbell',
  'kettlebell',
  'machine',
  'cable',
  'smith_machine',
  'ez_bar',
  'bodyweight',
  'band',
  'other'
);

create type public.exercise_unit as enum ('reps', 'seconds');
create type public.swim_stroke as enum ('free', 'back', 'breast', 'fly', 'im');
create type public.pool_length as enum ('25m', '50m', '25yd');
create type public.swim_kind as enum ('race', 'training');

-- Timestamps ----------------------------------------------------------------------------------
-- Server time is the source of truth for sync: clients pull rows whose updated_at is newer than
-- their last sync, so clients can never set created_at or updated_at themselves.

create function private.set_timestamps()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.created_at := pg_catalog.now();
  else
    -- Ids are generated on the phone and identify a row across devices; they never change.
    if new.id is distinct from old.id then
      raise exception 'id cannot be changed' using errcode = 'check_violation';
    end if;
    new.created_at := old.created_at;
  end if;
  new.updated_at := pg_catalog.now();
  return new;
end;
$$;

revoke all on function private.set_timestamps() from public, anon, authenticated;

-- Validation helpers --------------------------------------------------------------------------

-- True for IANA names such as 'Europe/Lisbon'. Declared immutable so it can be used in checks.
create function private.is_valid_timezone(tz text)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
begin
  -- A fixed instant keeps the function truly immutable; an unknown zone raises an error.
  perform pg_catalog.to_timestamp(0) at time zone tz;
  return true;
exception
  when invalid_parameter_value then
    return false;
end;
$$;

revoke all on function private.is_valid_timezone(text) from public, anon;
grant execute on function private.is_valid_timezone(text) to authenticated, service_role;
