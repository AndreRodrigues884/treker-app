// One-rep max: the weight itself for 1 rep, Epley for 2 to 12. Mirrors
// private.estimate_one_rep_max (latest in
// supabase/migrations/20261104150000_one_rep_max_single_rep.sql); both are tested against
// supabase/tests/fixtures/one-rep-max-cases.json so they never diverge.

export type ExerciseUnit = 'reps' | 'seconds';

export type OneRepMaxInput = {
  weightKg: number | null;
  reps: number | null;
  isWarmup: boolean;
  unit: ExerciseUnit;
  tracksLoad: boolean;
  addsBodyweight: boolean;
  // Bodyweight on the day of the workout; only used when the exercise adds it.
  bodyweightKg: number | null;
};

// Above this, Epley stops being reliable.
export const MAX_REPS_FOR_ONE_REP_MAX = 12;

const EPLEY_DIVISOR = 30;
const GRAMS_PER_KG = 1000;
// The result is rounded to 0.01 kg = 10 g.
const GRAMS_PER_STEP = 10;

/**
 * With 1 rep, the weight itself (a real 1RM, not an estimate). From 2 to 12 reps, Epley:
 * (weight + bw) × (1 + reps / 30) − bw, where bw is the bodyweight for exercises that add it
 * and 0 otherwise. For bodyweight exercises the result is the added weight. Returns kg rounded
 * to 0.01 (half away from zero, like Postgres), or null when the set does not count: warm-ups,
 * timed or unloaded exercises, reps outside 1 to 12, or a missing weight or bodyweight.
 */
export function estimateOneRepMax(input: OneRepMaxInput): number | null {
  const { weightKg, reps, isWarmup, unit, tracksLoad, addsBodyweight, bodyweightKg } = input;

  if (isWarmup || unit !== 'reps' || !tracksLoad) return null;
  if (reps === null || !Number.isInteger(reps) || reps < 1 || reps > MAX_REPS_FOR_ONE_REP_MAX) {
    return null;
  }
  if (addsBodyweight ? bodyweightKg === null : weightKg === null) return null;

  // Integer grams avoid floating point drift; weights have at most 3 decimals.
  const loadGrams = toGrams(weightKg ?? 0);
  const bodyweightGrams = addsBodyweight ? toGrams(bodyweightKg ?? 0) : 0;

  // 1RM in grams, multiplied by 30 to stay an integer. One rep keeps the weight as is:
  // (load + bw) × 30 − 30 × bw = 30 × load.
  const multiplier = reps === 1 ? EPLEY_DIVISOR : EPLEY_DIVISOR + reps;
  const scaledGrams = (loadGrams + bodyweightGrams) * multiplier - EPLEY_DIVISOR * bodyweightGrams;

  const steps = divideRoundingHalfAwayFromZero(scaledGrams, EPLEY_DIVISOR * GRAMS_PER_STEP);
  return (steps * GRAMS_PER_STEP) / GRAMS_PER_KG;
}

function toGrams(kg: number): number {
  return Math.round(kg * GRAMS_PER_KG);
}

function divideRoundingHalfAwayFromZero(numerator: number, denominator: number): number {
  const magnitude = Math.floor((2 * Math.abs(numerator) + denominator) / (2 * denominator));
  return numerator < 0 && magnitude !== 0 ? -magnitude : magnitude;
}
