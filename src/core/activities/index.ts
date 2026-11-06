// Workouts as the profile and the workout screen show them: the summary of each, the cursor of
// the next page, and the totals of one workout. Pure TypeScript.
//
// The totals follow the same rules as Postgres list_activity_summaries (and exercise_stats):
// work sets only (no warm-ups, nothing deleted), volume = weight x reps with assistance
// (negative weight) counted as zero, swim distance in metres with yard pools converted.
// supabase/tests/17_activity_summaries.sql and activities.test.ts check the same example.
import { METRES_PER_YARD } from '../units';

export type ActivityType = 'gym' | 'swim';

export type ActivitySummary = {
  id: string;
  type: ActivityType;
  title: string | null;
  localDate: string;
  startedAt: string | null;
  endedAt: string | null;
  // Null until the workout has a start and an end.
  durationS: number | null;
  // Gym: work sets. Swim: times logged.
  setCount: number;
  // Gym only.
  volumeKg: number | null;
  // Swim only.
  distanceM: number | null;
};

// Where the next page starts: the (local_date, id) of the last row received.
export type ActivityCursor = { localDate: string; id: string };

// The next page's cursor, or undefined when this page was the last (it came back short).
export function nextCursor(
  page: readonly Pick<ActivitySummary, 'localDate' | 'id'>[],
  pageSize: number,
): ActivityCursor | undefined {
  const last = page[page.length - 1];
  if (page.length < pageSize || !last) return undefined;
  return { localDate: last.localDate, id: last.id };
}

export function durationSeconds(startedAt: string | null, endedAt: string | null): number | null {
  if (!startedAt || !endedAt) return null;
  const seconds = Math.floor((Date.parse(endedAt) - Date.parse(startedAt)) / 1000);
  return Number.isFinite(seconds) && seconds >= 0 ? seconds : null;
}

type SetForTotals = {
  weight_kg: number | null;
  reps: number | null;
  is_warmup: boolean;
  deleted_at: string | null;
};

export function gymTotals(sets: readonly SetForTotals[]): { setCount: number; volumeKg: number } {
  const work = sets.filter((set) => !set.is_warmup && set.deleted_at === null);
  const volumeKg = work.reduce(
    (total, set) => total + Math.max(set.weight_kg ?? 0, 0) * (set.reps ?? 0),
    0,
  );
  return { setCount: work.length, volumeKg };
}

type EntryForTotals = {
  distance: number;
  pool_length: '25m' | '50m' | '25yd';
  deleted_at: string | null;
};

export function swimTotals(entries: readonly EntryForTotals[]): {
  setCount: number;
  distanceM: number;
} {
  const kept = entries.filter((entry) => entry.deleted_at === null);
  const distanceM = kept.reduce(
    (total, entry) =>
      total + (entry.pool_length === '25yd' ? entry.distance * METRES_PER_YARD : entry.distance),
    0,
  );
  return { setCount: kept.length, distanceM };
}

// The sets of a gym workout, one group per exercise in the order they were done, each in set
// order.
export function groupSetsByExercise<
  T extends { exercise_id: string; exercise_position: number; set_number: number },
>(sets: readonly T[]): { exerciseId: string; position: number; sets: T[] }[] {
  const groups = new Map<number, { exerciseId: string; position: number; sets: T[] }>();
  for (const set of sets) {
    const group = groups.get(set.exercise_position) ?? {
      exerciseId: set.exercise_id,
      position: set.exercise_position,
      sets: [],
    };
    group.sets.push(set);
    groups.set(set.exercise_position, group);
  }
  return [...groups.values()]
    .sort((a, b) => a.position - b.position)
    .map((group) => ({
      ...group,
      sets: [...group.sets].sort((a, b) => a.set_number - b.set_number),
    }));
}
