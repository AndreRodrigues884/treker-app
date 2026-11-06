import type { Equipment, ExerciseUnit, MuscleGroup } from '@/core/exercises';
import type { Messages } from '@/core/i18n';

// Translated names of the exercise attributes.

export function muscleGroupLabel(t: Messages, group: MuscleGroup): string {
  return t.exercises.muscleGroups[group];
}

export function equipmentLabel(t: Messages, equipment: Equipment): string {
  return t.exercises.equipmentTypes[equipment];
}

export function unitLabel(t: Messages, unit: ExerciseUnit): string {
  return t.exercises.units[unit];
}

// "Chest · Barbell", under the exercise name.
export function exerciseMeta(
  t: Messages,
  exercise: { muscle_group: MuscleGroup; equipment: Equipment },
): string {
  return `${muscleGroupLabel(t, exercise.muscle_group)} · ${equipmentLabel(t, exercise.equipment)}`;
}
