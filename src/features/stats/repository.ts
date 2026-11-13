// Gym statistics and progress, read from Postgres: the progress of a workout and of a saved workout
// (session_progress, template_progress), the 1RM series of the strength chart, the weekly totals,
// the volume per muscle group and how often each saved workout was done. Postgres does the sums,
// the 1RM and the progress rule; the app never loads every set to work them out.
import type { MuscleGroup } from '@/core/exercises';
import type {
  ProgressMeasure,
  ProgressResult,
  ProgressSummary,
  TemplateProgressRow,
} from '@/core/progress';
import type { DataContext } from '@/lib/data/context';
import { unwrap } from '@/lib/data/result';
import { supabase } from '@/lib/supabase/client';

// The generated types mark every column and argument as required; some columns can be null, and
// p_from may be null (everything).
const numberOrNull = (value: unknown): number | null =>
  value === null || value === undefined ? null : Number(value);

export type ExerciseProgressRow = {
  exerciseId: string;
  position: number;
  measure: ProgressMeasure;
  current: number;
  previous: number | null;
  previousDate: string | null;
  result: ProgressResult;
};

export type WorkoutProgress = {
  exercises: ExerciseProgressRow[];
  summary: ProgressSummary;
  result: ProgressResult;
};

// For each exercise of a gym workout: how it did against the previous workout with it.
export async function getWorkoutProgress(
  _ctx: DataContext,
  activityId: string,
): Promise<WorkoutProgress> {
  const rows = unwrap(await supabase.rpc('session_progress', { p_activity_id: activityId }));
  const first = rows[0];
  const summary = {
    up: first?.up_count ?? 0,
    same: first?.same_count ?? 0,
    down: first?.down_count ?? 0,
    first: first?.first_count ?? 0,
  };
  return {
    exercises: rows.map((row) => ({
      exerciseId: row.exercise_id,
      position: row.exercise_position,
      measure: row.measure as ProgressMeasure,
      current: Number(row.current_value),
      previous: numberOrNull(row.previous_value),
      previousDate: (row.previous_date as string | null) ?? null,
      result: row.result as ProgressResult,
    })),
    summary: { ...summary, compared: summary.up + summary.same + summary.down },
    result: (first?.session_result as ProgressResult | undefined) ?? 'first',
  };
}

// The last workouts done from a saved workout, oldest first, with the progress of each exercise.
export async function getTemplateProgress(
  _ctx: DataContext,
  templateId: string,
  limit: number,
): Promise<TemplateProgressRow[]> {
  const rows = unwrap(
    await supabase.rpc('template_progress', { p_template_id: templateId, p_limit: limit }),
  );
  return rows.map((row) => ({
    activityId: row.activity_id,
    localDate: row.local_date,
    exerciseId: row.exercise_id,
    position: row.exercise_position,
    measure: row.measure as ProgressMeasure,
    value: Number(row.current_value),
    result: row.result as ProgressResult,
    sessionResult: row.session_result as ProgressResult,
  }));
}

export type OneRepMaxPoint = {
  exerciseId: string;
  activityId: string;
  localDate: string;
  valueKg: number;
};

// The best estimated 1RM of each workout, for up to 5 exercises, oldest first.
export async function getOneRepMaxSeries(
  _ctx: DataContext,
  exerciseIds: readonly string[],
  from: string | null,
): Promise<OneRepMaxPoint[]> {
  if (exerciseIds.length === 0) return [];
  const rows = unwrap(
    await supabase.rpc('one_rep_max_series', {
      p_exercise_ids: [...exerciseIds],
      ...(from ? { p_from: from } : {}),
    }),
  );
  return rows.map((row) => ({
    exerciseId: row.exercise_id,
    activityId: row.activity_id,
    localDate: row.local_date,
    valueKg: Number(row.best_one_rep_max_kg),
  }));
}

export type WeekSummary = {
  weekStart: string;
  // Workouts of every sport (the weekly target counts them all) and gym workouts.
  workoutCount: number;
  gymCount: number;
  volumeKg: number;
};

// Week by week, Monday to Sunday, including the weeks without workouts.
export async function getWeeklySummary(
  _ctx: DataContext,
  from: string | null,
  to: string,
): Promise<WeekSummary[]> {
  const rows = unwrap(await supabase.rpc('weekly_summary', { p_from: from as string, p_to: to }));
  return rows.map((row) => ({
    weekStart: row.week_start,
    workoutCount: row.workout_count,
    gymCount: row.gym_count,
    volumeKg: Number(row.volume_kg),
  }));
}

export type MuscleGroupVolume = {
  muscleGroup: MuscleGroup;
  volumeKg: number;
  setCount: number;
  // Workouts that trained this muscle group.
  workoutCount: number;
};

export async function getVolumeByMuscleGroup(
  _ctx: DataContext,
  from: string | null,
  to: string,
): Promise<MuscleGroupVolume[]> {
  const rows = unwrap(
    await supabase.rpc('volume_by_muscle_group', { p_from: from as string, p_to: to }),
  );
  return rows.map((row) => ({
    muscleGroup: row.muscle_group,
    volumeKg: Number(row.volume_kg),
    setCount: row.set_count,
    workoutCount: row.workout_count,
  }));
}

export type TemplateUsage = {
  templateId: string;
  name: string;
  workoutCount: number;
  lastDate: string;
};

// How many times each saved workout was done, the most done first.
export async function getTemplateUsage(
  _ctx: DataContext,
  from: string | null,
  to: string,
): Promise<TemplateUsage[]> {
  const rows = unwrap(await supabase.rpc('template_usage', { p_from: from as string, p_to: to }));
  return rows.map((row) => ({
    templateId: row.template_id,
    name: row.name,
    workoutCount: row.workout_count,
    lastDate: row.last_date,
  }));
}

export type ExerciseUsageRow = {
  exerciseId: string;
  setCount: number;
  lastLocalDate: string | null;
  bestOneRepMaxKg: number | null;
};

// Every exercise the athlete has done (exercise_stats), for the strength chart's default choice.
export async function listExerciseUsage(ctx: DataContext): Promise<ExerciseUsageRow[]> {
  const rows = unwrap(
    await supabase
      .from('exercise_stats')
      .select('exercise_id, set_count, last_local_date, best_one_rep_max_kg')
      .eq('user_id', ctx.userId),
  );
  return rows.map((row) => ({
    exerciseId: row.exercise_id,
    setCount: row.set_count,
    lastLocalDate: row.last_local_date,
    bestOneRepMaxKg: numberOrNull(row.best_one_rep_max_kg),
  }));
}
