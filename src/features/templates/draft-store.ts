import { useSyncExternalStore } from 'react';

import { hasTemplateChanges, type TemplateDraft } from '@/core/templates';

// In-memory state shared by screens on the stack:
// - the template being edited, by template id. It outlives the editor screen while the athlete
//   picks exercises, and stays until it is saved or discarded, so a failed save loses nothing;
// - the exercises ticked in the library's multiple choice, by pick session (the template id).
// Nothing here is saved on the phone: closing the app discards an unsaved template.

const drafts = new Map<string, TemplateDraft>();
// What each editor started with, to know whether there is anything unsaved.
const baselines = new Map<string, TemplateDraft>();
const picks = new Map<string, readonly string[]>();
const listeners = new Set<() => void>();

const NO_PICKS: readonly string[] = [];

function emit() {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// Templates being edited ---------------------------------------------------------------------------

export function useTemplateDraft(templateId: string): TemplateDraft | undefined {
  return useSyncExternalStore(subscribe, () => drafts.get(templateId));
}

// Opens a template for editing: the draft and the baseline its changes are measured against.
export function startTemplateDraft(templateId: string, draft: TemplateDraft): void {
  drafts.set(templateId, draft);
  baselines.set(templateId, draft);
  emit();
}

// True when the draft differs from what the editor started with.
export function useTemplateHasChanges(templateId: string): boolean {
  return useSyncExternalStore(subscribe, () => {
    const draft = drafts.get(templateId);
    const baseline = baselines.get(templateId);
    return draft !== undefined && baseline !== undefined && hasTemplateChanges(baseline, draft);
  });
}

export function getTemplateDraft(templateId: string): TemplateDraft | undefined {
  return drafts.get(templateId);
}

export function setTemplateDraft(
  templateId: string,
  next: TemplateDraft | ((current: TemplateDraft) => TemplateDraft),
): void {
  const current = drafts.get(templateId);
  const value = typeof next === 'function' ? (current ? next(current) : undefined) : next;
  if (value === undefined) return;
  drafts.set(templateId, value);
  emit();
}

export function discardTemplateDraft(templateId: string): void {
  drafts.delete(templateId);
  baselines.delete(templateId);
  picks.delete(templateId);
  emit();
}

// Multiple choice in the library -------------------------------------------------------------------

export function usePickedExercises(session: string): readonly string[] {
  return useSyncExternalStore(subscribe, () => picks.get(session) ?? NO_PICKS);
}

export function togglePickedExercise(session: string, exerciseId: string): void {
  const current = picks.get(session) ?? NO_PICKS;
  picks.set(
    session,
    current.includes(exerciseId)
      ? current.filter((id) => id !== exerciseId)
      : [...current, exerciseId],
  );
  emit();
}

// A new exercise created from the library during a pick session starts ticked.
export function pickExercise(session: string, exerciseId: string): void {
  const current = picks.get(session) ?? NO_PICKS;
  if (current.includes(exerciseId)) return;
  picks.set(session, [...current, exerciseId]);
  emit();
}

export function clearPickedExercises(session: string): void {
  picks.delete(session);
  emit();
}

// For tests: forget everything between tests.
export function resetDraftStore(): void {
  drafts.clear();
  baselines.clear();
  picks.clear();
  emit();
}
