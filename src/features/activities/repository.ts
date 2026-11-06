// Activities (one row per workout, gym or swim). Repositories are the only place that calls
// Supabase for the athlete's data; screens use them through the query hooks (queries.ts).
// Creating upserts by an id made on the phone, so repeating a request never duplicates a row.
import { localDateOf, type LocalDate } from '@/core/dates';
import type { DataContext } from '@/lib/data/context';
import { throwIfError, unwrap, unwrapMaybe } from '@/lib/data/result';
import { supabase } from '@/lib/supabase/client';
import type { Tables } from '@/lib/supabase/database.types';

export type ActivityRow = Tables<'activities'>;
export type GymSetRow = Tables<'gym_sets'>;
export type SwimEntryRow = Tables<'swim_entries'>;
export type ActivityType = ActivityRow['type'];

export type ActivityWithEntries = {
  activity: ActivityRow;
  gymSets: GymSetRow[];
  swimEntries: SwimEntryRow[];
};

export type StartActivityInput = {
  // Pass the same id when retrying, so the activity is not created twice.
  id?: string;
  type: ActivityType;
  // The athlete's timezone; the local date is taken in it.
  timezone: string;
  startedAt?: Date;
  // Defaults to the date of startedAt in the timezone.
  localDate?: LocalDate;
  title?: string | null;
  templateId?: string | null;
  // Defaults on the server to the profile's bodyweight.
  bodyweightKg?: number | null;
};

export async function startActivity(
  ctx: DataContext,
  input: StartActivityInput,
): Promise<ActivityRow> {
  const startedAt = input.startedAt ?? ctx.now();
  const row = {
    id: input.id ?? ctx.newId(),
    user_id: ctx.userId,
    type: input.type,
    local_date: input.localDate ?? localDateOf(startedAt, input.timezone),
    timezone: input.timezone,
    started_at: startedAt.toISOString(),
    title: input.title ?? null,
    template_id: input.templateId ?? null,
    ...(input.bodyweightKg !== undefined ? { bodyweight_kg: input.bodyweightKg } : {}),
  };
  return unwrap(
    await supabase.from('activities').upsert(row, { onConflict: 'id' }).select().single(),
  );
}

export function finishActivity(
  ctx: DataContext,
  id: string,
  endedAt: Date = ctx.now(),
): Promise<ActivityRow> {
  return updateActivity(ctx, id, { ended_at: endedAt.toISOString() });
}

export type ActivityChanges = Partial<
  Pick<ActivityRow, 'title' | 'notes' | 'local_date' | 'started_at' | 'ended_at' | 'bodyweight_kg'>
>;

export async function updateActivity(
  ctx: DataContext,
  id: string,
  changes: ActivityChanges,
): Promise<ActivityRow> {
  return unwrap(
    await supabase
      .from('activities')
      .update(changes)
      .eq('id', id)
      .eq('user_id', ctx.userId)
      .select()
      .single(),
  );
}

// Deletes (marks deleted_at) the activity with its sets and swim times in one request: Postgres
// delete_activity does it in a single transaction and rebuilds the records once. Repeating it
// after a network failure changes nothing.
export async function deleteActivity(_ctx: DataContext, id: string): Promise<void> {
  throwIfError(await supabase.rpc('delete_activity', { p_activity_id: id }));
}

// An activity with its sets (in exercise and set order) and swim times (in order), without
// deleted rows. Null when missing or deleted.
export async function getActivityWithEntries(
  ctx: DataContext,
  id: string,
): Promise<ActivityWithEntries | null> {
  const [activity, gymSets, swimEntries] = await Promise.all([
    supabase
      .from('activities')
      .select('*')
      .eq('id', id)
      .eq('user_id', ctx.userId)
      .is('deleted_at', null)
      .maybeSingle(),
    supabase
      .from('gym_sets')
      .select('*')
      .eq('activity_id', id)
      .is('deleted_at', null)
      .order('exercise_position', { ascending: true })
      .order('set_number', { ascending: true }),
    supabase
      .from('swim_entries')
      .select('*')
      .eq('activity_id', id)
      .is('deleted_at', null)
      .order('position', { ascending: true }),
  ]);
  const row = unwrapMaybe(activity);
  if (!row) return null;
  return { activity: row, gymSets: unwrap(gymSets), swimEntries: unwrap(swimEntries) };
}

export type DateRange = { start: LocalDate; end: LocalDate };

// Activities whose local date falls in the range (inclusive), newest first, without deleted ones.
export async function listActivities(ctx: DataContext, range: DateRange): Promise<ActivityRow[]> {
  return unwrap(
    await supabase
      .from('activities')
      .select('*')
      .eq('user_id', ctx.userId)
      .gte('local_date', range.start)
      .lte('local_date', range.end)
      .is('deleted_at', null)
      .order('local_date', { ascending: false })
      .order('started_at', { ascending: false }),
  );
}

// The athlete's latest workouts (not deleted), newest first, for the profile.
export async function listRecentActivities(ctx: DataContext, limit = 10): Promise<ActivityRow[]> {
  return unwrap(
    await supabase
      .from('activities')
      .select('*')
      .eq('user_id', ctx.userId)
      .is('deleted_at', null)
      .order('local_date', { ascending: false })
      .order('started_at', { ascending: false })
      .limit(limit),
  );
}

export async function countActivities(ctx: DataContext, range: DateRange): Promise<number> {
  const { count, error } = await supabase
    .from('activities')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', ctx.userId)
    .gte('local_date', range.start)
    .lte('local_date', range.end)
    .is('deleted_at', null);
  if (error) throw error;
  return count ?? 0;
}
