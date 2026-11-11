import { useSyncExternalStore } from 'react';

import { addExercises, type GymSession } from '@/core/session';
import type { ExerciseRow } from '@/features/exercises/repository';

import { exerciseInfo } from './exercise-info';

// A saved workout being edited, by activity id. In memory only, and separate from the workout in
// progress (session-store), so editing an old workout never touches a live one. Leaving the edit
// screen discards it.

const edits = new Map<string, GymSession>();
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useEditSession(activityId: string): GymSession | undefined {
  return useSyncExternalStore(subscribe, () => edits.get(activityId));
}

export function getEditSession(activityId: string): GymSession | undefined {
  return edits.get(activityId);
}

export function setEditSession(activityId: string, session: GymSession): void {
  edits.set(activityId, session);
  emit();
}

export function updateEditSession(
  activityId: string,
  change: (session: GymSession) => GymSession,
): void {
  const current = edits.get(activityId);
  if (!current) return;
  edits.set(activityId, change(current));
  emit();
}

export function discardEditSession(activityId: string): void {
  edits.delete(activityId);
  emit();
}

// Exercises picked in the library while editing (no "last time": the workout is in the past).
export function addExercisesToEdit(
  activityId: string,
  rows: readonly ExerciseRow[],
  newId: () => string,
): void {
  updateEditSession(activityId, (session) =>
    addExercises(session, rows.map(exerciseInfo), {}, newId),
  );
}

// For tests: forget everything between tests.
export function resetEditStore(): void {
  edits.clear();
  emit();
}
