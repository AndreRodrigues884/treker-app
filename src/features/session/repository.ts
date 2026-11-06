// The gym session: saving a finished workout (Postgres save_gym_session, one request, one
// transaction), "last time" per exercise (last_performance) and the current records, for the
// live PR seal.
import type { LastPerformance, SaveSessionPayload } from '@/core/session';
import type { PersonalRecordRow } from '@/features/activities/repository';
import type { DataContext } from '@/lib/data/context';
import { unwrap } from '@/lib/data/result';
import { supabase } from '@/lib/supabase/client';

/**
 * Saves the workout and all its done sets at once, with the ids made on the phone. Repeating it
 * with the same payload (a retry after a network failure) duplicates nothing. Returns the official
 * records this workout set, after Postgres rebuilt them.
 */
export async function saveGymSession(
  _ctx: DataContext,
  payload: SaveSessionPayload,
): Promise<PersonalRecordRow[]> {
  return unwrap(await supabase.rpc('save_gym_session', { p_session: payload }));
}

// For each exercise, the work sets of the latest workout in which the athlete did it.
export async function getLastPerformance(
  _ctx: DataContext,
  exerciseIds: readonly string[],
): Promise<LastPerformance> {
  if (exerciseIds.length === 0) return {};
  const rows = unwrap(await supabase.rpc('last_performance', { p_exercise_ids: [...exerciseIds] }));
  const result: LastPerformance = {};
  for (const row of rows) {
    (result[row.exercise_id] ??= []).push({
      workSetIndex: row.work_set_index,
      weightKg: row.weight_kg === null ? null : Number(row.weight_kg),
      reps: row.reps,
      durationS: row.duration_s,
      difficulty: row.difficulty,
      localDate: row.local_date,
    });
  }
  return result;
}

// The best estimated 1RM per exercise (current_records), in kg.
export async function getCurrentGymRecords(ctx: DataContext): Promise<Record<string, number>> {
  const rows = unwrap(
    await supabase.from('current_records').select('*').eq('user_id', ctx.userId).eq('type', 'gym'),
  );
  const result: Record<string, number> = {};
  for (const row of rows) {
    if (row.exercise_id) result[row.exercise_id] = Number(row.value);
  }
  return result;
}
