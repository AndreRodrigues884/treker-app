export {
  estimateOneRepMax,
  MAX_REPS_FOR_ONE_REP_MAX,
  type ExerciseUnit,
  type OneRepMaxInput,
} from './one-rep-max';

// Same rules as the Postgres rebuild: a record must strictly beat the current best.

// Gym: a higher estimated 1RM. Sets that do not count (null) never beat anything.
export function beatsGymRecord(oneRepMaxKg: number | null, currentBestKg: number | null): boolean {
  if (oneRepMaxKg === null) return false;
  return currentBestKg === null || oneRepMaxKg > currentBestKg;
}

// Swim: a lower time, compared only within the same stroke, distance and pool length.
export function beatsSwimRecord(timeCs: number, currentBestCs: number | null): boolean {
  return currentBestCs === null || timeCs < currentBestCs;
}
