// Saved workouts (workout templates): the draft edited on the phone, its order and targets, and
// the payload sent to Postgres save_workout_template. Pure TypeScript.
import { z } from 'zod';

import type { Validation } from '../auth';
import type { ExerciseUnit } from '../exercises';

// Match the checks on workout_templates and workout_template_exercises.
export const TEMPLATE_NAME_MAX_LENGTH = 80;
export const TARGET_SETS = { min: 1, max: 20 } as const;
// The database allows up to 1000 reps; the stepper stops at a realistic number.
export const TARGET_REPS = { min: 1, max: 100 } as const;
export const TARGET_SECONDS = { min: 5, max: 3600, step: 5 } as const;

export const DEFAULT_TARGETS = { sets: 3, reps: 10, seconds: 30 } as const;

export type TemplateItem = {
  // The row id (workout_template_exercises.id), made on the phone.
  id: string;
  exerciseId: string;
  unit: ExerciseUnit;
  targetSets: number;
  // Used when unit is reps.
  targetReps: number;
  // Used when unit is seconds.
  targetSeconds: number;
};

export type TemplateDraft = {
  id: string;
  name: string;
  items: TemplateItem[];
};

export function emptyTemplate(id: string): TemplateDraft {
  return { id, name: '', items: [] };
}

// Adds exercises at the end, each with its own new row id and the default targets.
export function addExercises(
  draft: TemplateDraft,
  exercises: readonly { id: string; unit: ExerciseUnit }[],
  newId: () => string,
): TemplateDraft {
  const added = exercises.map((exercise) => ({
    id: newId(),
    exerciseId: exercise.id,
    unit: exercise.unit,
    targetSets: DEFAULT_TARGETS.sets,
    targetReps: DEFAULT_TARGETS.reps,
    targetSeconds: DEFAULT_TARGETS.seconds,
  }));
  return { ...draft, items: [...draft.items, ...added] };
}

export function removeItem(draft: TemplateDraft, itemId: string): TemplateDraft {
  return { ...draft, items: draft.items.filter((item) => item.id !== itemId) };
}

export function updateItem(
  draft: TemplateDraft,
  itemId: string,
  changes: Partial<Pick<TemplateItem, 'targetSets' | 'targetReps' | 'targetSeconds'>>,
): TemplateDraft {
  return {
    ...draft,
    items: draft.items.map((item) => (item.id === itemId ? { ...item, ...changes } : item)),
  };
}

// Moves the item at `from` to `to` (both clamped to the list). Used by dragging.
export function moveItem<T>(items: readonly T[], from: number, to: number): T[] {
  const last = items.length - 1;
  const source = Math.max(0, Math.min(last, from));
  const target = Math.max(0, Math.min(last, to));
  const next = [...items];
  const [moved] = next.splice(source, 1);
  if (moved !== undefined) next.splice(target, 0, moved);
  return next;
}

// The "move up" / "move down" buttons, for screen reader users. At the ends nothing changes.
export function moveItemBy(draft: TemplateDraft, itemId: string, offset: -1 | 1): TemplateDraft {
  const index = draft.items.findIndex((item) => item.id === itemId);
  const target = index + offset;
  if (index < 0 || target < 0 || target >= draft.items.length) return draft;
  return { ...draft, items: moveItem(draft.items, index, target) };
}

// Whether the draft differs from what the editor started with (name, order, exercises or
// targets). Changing a value and changing it back counts as no change.
export function hasTemplateChanges(initial: TemplateDraft, current: TemplateDraft): boolean {
  if (initial.name !== current.name || initial.items.length !== current.items.length) return true;
  return current.items.some((item, index) => {
    const before = initial.items[index];
    return (
      before === undefined ||
      before.id !== item.id ||
      before.exerciseId !== item.exerciseId ||
      before.targetSets !== item.targetSets ||
      (item.unit === 'reps'
        ? before.targetReps !== item.targetReps
        : before.targetSeconds !== item.targetSeconds)
    );
  });
}

// Validation ---------------------------------------------------------------------------------------

export type TemplateError = 'nameRequired' | 'nameTooLong' | 'noExercises';

const templateSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, { error: 'nameRequired' })
    .max(TEMPLATE_NAME_MAX_LENGTH, { error: 'nameTooLong' }),
  items: z.array(z.unknown()).min(1, { error: 'noExercises' }),
});

// Quick feedback before saving; Postgres checks the name, the targets and the exercises again.
export function validateTemplate(
  draft: TemplateDraft,
): Validation<TemplateDraft, Partial<Record<'name' | 'items', TemplateError>>> {
  const result = templateSchema.safeParse(draft);
  if (result.success) return { ok: true, value: { ...draft, name: result.data.name } };
  const errors: Partial<Record<'name' | 'items', TemplateError>> = {};
  for (const issue of result.error.issues) {
    const field = issue.path[0] as 'name' | 'items';
    errors[field] ??= issue.message as TemplateError;
  }
  return { ok: false, error: errors };
}

// Saving -------------------------------------------------------------------------------------------

export type SaveTemplatePayload = {
  id: string;
  name: string;
  notes: null;
  exercises: {
    id: string;
    exercise_id: string;
    target_sets: number;
    target_reps_min: number | null;
    target_reps_max: number | null;
    target_seconds: number | null;
    notes: null;
  }[];
};

// The p_template argument of save_workout_template: the list is saved in the order of the array.
// One rep target is stored as a range with min = max.
export function toSavePayload(draft: TemplateDraft): SaveTemplatePayload {
  return {
    id: draft.id,
    name: draft.name.trim(),
    notes: null,
    exercises: draft.items.map((item) => ({
      id: item.id,
      exercise_id: item.exerciseId,
      target_sets: item.targetSets,
      target_reps_min: item.unit === 'reps' ? item.targetReps : null,
      target_reps_max: item.unit === 'reps' ? item.targetReps : null,
      target_seconds: item.unit === 'seconds' ? item.targetSeconds : null,
      notes: null,
    })),
  };
}

// The rows as stored, turned back into a draft (missing targets get the defaults).
export type StoredTemplateItem = {
  id: string;
  exercise_id: string;
  position: number;
  target_sets: number | null;
  target_reps_min: number | null;
  target_reps_max: number | null;
  target_seconds: number | null;
};

export function draftOf(
  template: { id: string; name: string },
  rows: readonly StoredTemplateItem[],
  unitOf: (exerciseId: string) => ExerciseUnit,
): TemplateDraft {
  const items = [...rows]
    .sort((a, b) => a.position - b.position || (a.id < b.id ? -1 : 1))
    .map((row) => ({
      id: row.id,
      exerciseId: row.exercise_id,
      unit: unitOf(row.exercise_id),
      targetSets: row.target_sets ?? DEFAULT_TARGETS.sets,
      targetReps: row.target_reps_max ?? row.target_reps_min ?? DEFAULT_TARGETS.reps,
      targetSeconds: row.target_seconds ?? DEFAULT_TARGETS.seconds,
    }));
  return { id: template.id, name: template.name, items };
}
