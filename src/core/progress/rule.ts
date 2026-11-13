// The progress rule: how an exercise did in a workout compared with the previous workout (not
// deleted) in which the athlete did it, whatever saved workout either came from. Mirrors
// private.progress_compare (supabase/migrations/20261112100000_gym_stats.sql); both are tested
// against supabase/tests/fixtures/progress-cases.json so they never diverge.
//
// Not the record: a record is the best estimated 1RM ever; progress compares two workouts.
import { estimateOneRepMax, type ExerciseUnit } from '../records';

export type ProgressMeasure = 'one_rep_max' | 'duration' | 'volume';
export type ProgressResult = 'up' | 'same' | 'down' | 'first';

export type ProgressExercise = {
  unit: ExerciseUnit;
  tracksLoad: boolean;
  addsBodyweight: boolean;
};

export type ProgressSet = {
  weightKg: number | null;
  reps: number | null;
  durationS: number | null;
  isWarmup?: boolean;
};

// What one workout gives for one exercise, before choosing the measure.
export type WorkoutMeasures = {
  // The best estimated 1RM (null when no set gives one).
  oneRepMaxKg: number | null;
  // The best time, for timed exercises.
  durationS: number | null;
  // Weight × reps of the sets done; assistance (negative weight) counts as zero.
  volumeKg: number;
};

export type ExerciseProgress = {
  measure: ProgressMeasure;
  current: number;
  previous: number | null;
  result: ProgressResult;
};

// A change of 0.5% or more counts as up or down.
export const PROGRESS_THRESHOLD = 0.005;

const MILLI = 1000;

/** The measures of the work sets of one exercise in one workout (warm-ups left out). */
export function workoutMeasures(
  exercise: ProgressExercise,
  sets: readonly ProgressSet[],
  bodyweightKg: number | null,
): WorkoutMeasures {
  const work = sets.filter((set) => !set.isWarmup);
  let oneRepMaxKg: number | null = null;
  let durationS: number | null = null;
  // In grams, so sums of decimals never drift.
  let volumeGrams = 0;
  for (const set of work) {
    const estimate = estimateOneRepMax({
      weightKg: set.weightKg,
      reps: set.reps,
      isWarmup: false,
      unit: exercise.unit,
      tracksLoad: exercise.tracksLoad,
      addsBodyweight: exercise.addsBodyweight,
      bodyweightKg,
    });
    if (estimate !== null && (oneRepMaxKg === null || estimate > oneRepMaxKg)) {
      oneRepMaxKg = estimate;
    }
    if (set.durationS !== null && (durationS === null || set.durationS > durationS)) {
      durationS = set.durationS;
    }
    volumeGrams += Math.round(Math.max(set.weightKg ?? 0, 0) * MILLI) * (set.reps ?? 0);
  }
  return { oneRepMaxKg, durationS, volumeKg: volumeGrams / MILLI };
}

/**
 * Compares an exercise in a workout with the previous workout with it (null: the first time).
 * The measure is the estimated 1RM of the best set when both workouts have one (or, the first
 * time, when this one does); otherwise the best time for timed exercises, and the volume for the
 * others.
 */
export function compareProgress(
  unit: ExerciseUnit,
  current: WorkoutMeasures,
  previous: WorkoutMeasures | null,
): ExerciseProgress {
  const measure: ProgressMeasure =
    current.oneRepMaxKg !== null && (previous === null || previous.oneRepMaxKg !== null)
      ? 'one_rep_max'
      : unit === 'seconds'
        ? 'duration'
        : 'volume';
  const valueOf = (measures: WorkoutMeasures): number =>
    measure === 'one_rep_max'
      ? (measures.oneRepMaxKg ?? 0)
      : measure === 'duration'
        ? (measures.durationS ?? 0)
        : measures.volumeKg;
  const value = valueOf(current);
  if (previous === null) return { measure, current: value, previous: null, result: 'first' };
  const before = valueOf(previous);
  return { measure, current: value, previous: before, result: progressResult(value, before) };
}

/** Up or down by 0.5% of the previous value or more; the same otherwise. */
export function progressResult(current: number, previous: number): 'up' | 'same' | 'down' {
  // In thousandths, as integers, so 0.5% exactly is never lost to floating point.
  const now = Math.round(current * MILLI);
  const before = Math.round(previous * MILLI);
  const limit = Math.abs(before);
  if (now > before && 200 * (now - before) >= limit) return 'up';
  if (now < before && 200 * (before - now) >= limit) return 'down';
  return 'same';
}

export type ProgressSummary = {
  up: number;
  same: number;
  down: number;
  first: number;
  // Exercises compared with a previous workout (first times left out).
  compared: number;
};

export function summarizeProgress(results: readonly ProgressResult[]): ProgressSummary {
  const count = (result: ProgressResult) => results.filter((item) => item === result).length;
  const summary = {
    up: count('up'),
    same: count('same'),
    down: count('down'),
    first: count('first'),
  };
  return { ...summary, compared: summary.up + summary.same + summary.down };
}

/**
 * A workout's overall result (private.overall_progress): more up than down is up, more down than
 * up is down, a tie is the same, and a workout where every exercise was new is a first.
 */
export function overallProgress(summary: ProgressSummary): ProgressResult {
  if (summary.compared === 0) return 'first';
  if (summary.up > summary.down) return 'up';
  if (summary.down > summary.up) return 'down';
  return 'same';
}
