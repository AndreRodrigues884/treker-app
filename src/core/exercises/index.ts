// The exercise library: names in the app language, search that ignores accents and case, filters,
// and the validation of the athlete's own (custom) exercises. Pure TypeScript.
import { z } from 'zod';

import type { Validation } from '../auth';
import type { Language } from '../i18n';

// Match the Postgres enums public.muscle_group, public.equipment and public.exercise_unit.
export const MUSCLE_GROUPS = [
  'chest',
  'back',
  'shoulders',
  'biceps',
  'triceps',
  'forearms',
  'core',
  'quads',
  'hamstrings',
  'glutes',
  'calves',
  'full_body',
] as const;
export type MuscleGroup = (typeof MUSCLE_GROUPS)[number];

export const EQUIPMENT = [
  'barbell',
  'dumbbell',
  'kettlebell',
  'machine',
  'cable',
  'smith_machine',
  'ez_bar',
  'bodyweight',
  'band',
  'other',
] as const;
export type Equipment = (typeof EQUIPMENT)[number];

export const EXERCISE_UNITS = ['reps', 'seconds'] as const;
export type ExerciseUnit = (typeof EXERCISE_UNITS)[number];

// Matches the length check on exercises.name_en and name_pt.
export const EXERCISE_NAME_MAX_LENGTH = 80;

// The columns of an exercise row the library needs (a subset of the database row).
export type LibraryExercise = {
  id: string;
  owner_id: string | null;
  name_en: string;
  name_pt: string;
  muscle_group: MuscleGroup;
  equipment: Equipment;
  unit: ExerciseUnit;
  tracks_load: boolean;
  adds_bodyweight: boolean;
  archived: boolean;
  deleted_at: string | null;
};

// Custom exercises (owner_id set) keep the athlete's name in both columns.
export function exerciseName(
  exercise: Pick<LibraryExercise, 'name_en' | 'name_pt'>,
  language: Language,
): string {
  return language === 'pt' ? exercise.name_pt : exercise.name_en;
}

export function isCustomExercise(exercise: Pick<LibraryExercise, 'owner_id'>): boolean {
  return exercise.owner_id !== null;
}

// Lower case, without accents and with single spaces: "  Supíno  PLANO" -> "supino plano".
export function normalizeSearch(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

export type ExerciseFilters = {
  query: string;
  // null: every muscle group (or every equipment).
  muscleGroup: MuscleGroup | null;
  equipment: Equipment | null;
};

export const NO_FILTERS: ExerciseFilters = { query: '', muscleGroup: null, equipment: null };

// Every word of the query must appear in the name, in any order: "press bench" finds
// "Barbell Bench Press".
function matchesQuery(name: string, query: string): boolean {
  const words = normalizeSearch(query).split(' ').filter(Boolean);
  if (words.length === 0) return true;
  const normalized = normalizeSearch(name);
  return words.every((word) => normalized.includes(word));
}

/**
 * The exercises the library shows: not archived or deleted, matching the search and filters, with
 * the athlete's own exercises first, then by name in the app language (ignoring accents and case).
 */
export function searchExercises<T extends LibraryExercise>(
  exercises: readonly T[],
  filters: ExerciseFilters,
  language: Language,
): T[] {
  return exercises
    .filter(
      (exercise) =>
        !exercise.archived &&
        exercise.deleted_at === null &&
        (filters.muscleGroup === null || exercise.muscle_group === filters.muscleGroup) &&
        (filters.equipment === null || exercise.equipment === filters.equipment) &&
        matchesQuery(exerciseName(exercise, language), filters.query),
    )
    .map((exercise) => ({ exercise, key: normalizeSearch(exerciseName(exercise, language)) }))
    .sort((a, b) => {
      const custom = Number(isCustomExercise(b.exercise)) - Number(isCustomExercise(a.exercise));
      if (custom !== 0) return custom;
      return a.key < b.key ? -1 : a.key > b.key ? 1 : 0;
    })
    .map(({ exercise }) => exercise);
}

// Custom exercises ---------------------------------------------------------------------------------

export type CustomExerciseInput = {
  name: string;
  muscleGroup: MuscleGroup | null;
  equipment: Equipment | null;
  unit: ExerciseUnit;
  tracksLoad: boolean;
  addsBodyweight: boolean;
};

export type CustomExerciseValues = {
  name: string;
  muscleGroup: MuscleGroup;
  equipment: Equipment;
  unit: ExerciseUnit;
  tracksLoad: boolean;
  addsBodyweight: boolean;
};

export type CustomExerciseField = 'name' | 'muscleGroup' | 'equipment';
export type CustomExerciseError = 'nameRequired' | 'nameTooLong' | 'required';
export type CustomExerciseErrors = Partial<Record<CustomExerciseField, CustomExerciseError>>;

export const EMPTY_CUSTOM_EXERCISE: CustomExerciseInput = {
  name: '',
  muscleGroup: null,
  equipment: null,
  unit: 'reps',
  tracksLoad: true,
  addsBodyweight: false,
};

/**
 * "Adds bodyweight" only makes sense for a bodyweight exercise counted in reps that can take
 * extra load (pull-ups, dips): the 1RM is then worked out on bodyweight + added weight. The form
 * hides the option otherwise, and it is saved as false.
 */
export function canAddBodyweight(
  input: Pick<CustomExerciseInput, 'equipment' | 'unit' | 'tracksLoad'>,
): boolean {
  return input.equipment === 'bodyweight' && input.unit === 'reps' && input.tracksLoad;
}

const customExerciseSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, { error: 'nameRequired' })
    .max(EXERCISE_NAME_MAX_LENGTH, { error: 'nameTooLong' }),
  muscleGroup: z.enum(MUSCLE_GROUPS, { error: 'required' }),
  equipment: z.enum(EQUIPMENT, { error: 'required' }),
  unit: z.enum(EXERCISE_UNITS),
  tracksLoad: z.boolean(),
  addsBodyweight: z.boolean(),
});

// Checks a custom exercise before saving. The same rules are enforced by Postgres (name length,
// enums); this is for quick feedback in the form.
export function validateCustomExercise(
  input: CustomExerciseInput,
): Validation<CustomExerciseValues, CustomExerciseErrors> {
  const result = customExerciseSchema.safeParse(input);
  if (!result.success) {
    const errors: CustomExerciseErrors = {};
    for (const issue of result.error.issues) {
      const field = issue.path[0] as CustomExerciseField;
      errors[field] ??= issue.message as CustomExerciseError;
    }
    return { ok: false, error: errors };
  }
  const values = result.data;
  return {
    ok: true,
    value: { ...values, addsBodyweight: values.addsBodyweight && canAddBodyweight(values) },
  };
}

// The form's starting values for an existing exercise.
export function customExerciseInputOf(exercise: LibraryExercise): CustomExerciseInput {
  return {
    name: exercise.name_en,
    muscleGroup: exercise.muscle_group,
    equipment: exercise.equipment,
    unit: exercise.unit,
    tracksLoad: exercise.tracks_load,
    addsBodyweight: exercise.adds_bodyweight,
  };
}
