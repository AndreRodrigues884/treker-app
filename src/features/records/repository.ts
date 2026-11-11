// Records and progress per exercise, read from Postgres: the current gym records (with the set
// that gave each), exercise_stats, and the points and history of one exercise. Postgres does the
// sums and the 1RM; the app never loads every set to work them out.
import type { ActivityCursor } from '@/core/activities';
import type { Difficulty } from '@/core/session';
import type { DataContext } from '@/lib/data/context';
import { unwrap, unwrapMaybe } from '@/lib/data/result';
import { supabase } from '@/lib/supabase/client';
import type { Tables } from '@/lib/supabase/database.types';

export type GymRecord = {
  exerciseId: string;
  // Estimated 1RM in kg.
  valueKg: number;
  previousKg: number | null;
  localDate: string;
  activityId: string;
  // The set that gave it.
  weightKg: number | null;
  reps: number | null;
};

// The current record of every exercise (or of one), the most recent first.
export async function listGymRecords(_ctx: DataContext, exerciseId?: string): Promise<GymRecord[]> {
  const rows = unwrap(
    await supabase.rpc('current_gym_records', exerciseId ? { p_exercise_id: exerciseId } : {}),
  );
  // The generated types mark every column as required; previous value and the set can be null.
  return rows.map((row) => ({
    exerciseId: row.exercise_id,
    valueKg: Number(row.value),
    previousKg: row.previous_value === null ? null : Number(row.previous_value),
    localDate: row.local_date,
    activityId: row.activity_id,
    weightKg: (row.weight_kg as number | null) === null ? null : Number(row.weight_kg),
    reps: row.reps as number | null,
  }));
}

export type ExerciseStatsRow = Tables<'exercise_stats'>;

// Total volume, number of work sets and the last workout with this exercise (null: never done).
export async function getExerciseStats(
  ctx: DataContext,
  exerciseId: string,
): Promise<ExerciseStatsRow | null> {
  return unwrapMaybe(
    await supabase
      .from('exercise_stats')
      .select('*')
      .eq('user_id', ctx.userId)
      .eq('exercise_id', exerciseId)
      .maybeSingle(),
  );
}

export type ProgressPoint = {
  activityId: string;
  localDate: string;
  // The best estimated 1RM of the workout (null for exercises without one, like a plank).
  oneRepMaxKg: number | null;
  volumeKg: number;
  setCount: number;
  isRecord: boolean;
};

// One point per workout with this exercise, oldest first, from `from` (everything when null).
export async function getExerciseProgress(
  _ctx: DataContext,
  exerciseId: string,
  from: string | null,
): Promise<ProgressPoint[]> {
  const rows = unwrap(
    await supabase.rpc('exercise_progress', {
      p_exercise_id: exerciseId,
      ...(from ? { p_from: from } : {}),
    }),
  );
  return rows.map((row) => ({
    activityId: row.activity_id,
    localDate: row.local_date,
    oneRepMaxKg:
      (row.best_one_rep_max_kg as number | null) === null ? null : Number(row.best_one_rep_max_kg),
    volumeKg: Number(row.volume_kg),
    setCount: row.set_count,
    isRecord: row.is_record,
  }));
}

export type HistorySet = {
  id: string;
  setNumber: number;
  weightKg: number | null;
  reps: number | null;
  durationS: number | null;
  difficulty: Difficulty | null;
};

export type HistoryEntry = {
  activityId: string;
  title: string | null;
  localDate: string;
  startedAt: string | null;
  sets: HistorySet[];
};

// The workouts with this exercise, newest first, one page at a time by cursor.
export async function listExerciseHistory(
  _ctx: DataContext,
  exerciseId: string,
  options: { before?: ActivityCursor; limit: number },
): Promise<HistoryEntry[]> {
  const rows = unwrap(
    await supabase.rpc('exercise_history', {
      p_exercise_id: exerciseId,
      p_limit: options.limit,
      ...(options.before
        ? {
            p_before_date: options.before.localDate,
            p_before_id: options.before.id,
            ...(options.before.startedAt !== null
              ? { p_before_started_at: options.before.startedAt }
              : {}),
          }
        : {}),
    }),
  );
  return rows.map((row) => ({
    activityId: row.activity_id,
    title: row.title as string | null,
    localDate: row.local_date,
    startedAt: row.started_at as string | null,
    sets: ((row.sets as Record<string, unknown>[] | null) ?? []).map((set) => ({
      id: set.id as string,
      setNumber: set.set_number as number,
      weightKg: set.weight_kg === null ? null : Number(set.weight_kg),
      reps: set.reps as number | null,
      durationS: set.duration_s as number | null,
      difficulty: set.difficulty as Difficulty | null,
    })),
  }));
}
