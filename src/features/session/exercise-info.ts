import type { ExerciseInfo } from '@/core/session';
import type { ExerciseRow } from '@/features/exercises/repository';

// What the session needs from an exercise row.
export function exerciseInfo(row: ExerciseRow): ExerciseInfo {
  return {
    id: row.id,
    unit: row.unit,
    tracksLoad: row.tracks_load,
    addsBodyweight: row.adds_bodyweight,
  };
}
