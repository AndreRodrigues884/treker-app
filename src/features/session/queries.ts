import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  addExercises,
  moveExercise,
  removeExercise,
  reorderExercises,
  saveEditedSet,
  saveSet,
  setExercisePlan,
  setSessionTitle,
  setSessionWhen,
  startSession,
  type GymSession,
  type SaveSessionPayload,
  type SetValues,
  type UpdateSessionPayload,
} from '@/core/session';
import { useAuth, useDataContext } from '@/features/auth/auth-provider';
import { listExercises, type ExerciseRow } from '@/features/exercises/repository';
import type { TemplateWithExercises } from '@/features/templates/repository';
import { queryKeys } from '@/lib/data/query-keys';
import { getDeviceTimezone } from '@/lib/device';

import { deleteActivity } from '@/features/activities/repository';
import { invalidateWorkoutChange } from '@/features/records/queries';

import {
  discardEditSession,
  getEditSession,
  setEditSession,
  updateEditSession,
} from './edit-store';
import { exerciseInfo } from './exercise-info';
import {
  getCurrentGymRecords,
  getLastPerformance,
  saveGymSession,
  updateGymSession,
} from './repository';
import { setActiveSession, updateActiveSession } from './session-store';

export { exerciseInfo };

// The best estimated 1RM per exercise, for the live PR seal.
export function useCurrentGymRecords() {
  const ctx = useDataContext();
  return useQuery({
    queryKey: queryKeys.currentGymRecords(ctx.userId),
    queryFn: () => getCurrentGymRecords(ctx),
  });
}

// "Last time" for some exercises, through the cache (refreshed by every training write).
function useFetchLastPerformance() {
  const ctx = useDataContext();
  const queryClient = useQueryClient();
  return (exerciseIds: readonly string[]) =>
    queryClient.fetchQuery({
      queryKey: queryKeys.lastPerformance(ctx.userId, exerciseIds),
      queryFn: () => getLastPerformance(ctx, exerciseIds),
    });
}

/**
 * Starts a gym session, empty or from a saved workout: reads the exercises and "last time" for
 * them, fills the sets in and keeps the draft on the phone. Fails (with the error to show) when
 * that cannot be read, for example without a connection.
 */
export function useStartGymSession() {
  const ctx = useDataContext();
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const fetchLast = useFetchLastPerformance();
  return useMutation({
    mutationFn: async (template: TemplateWithExercises | null) => {
      const rows = await queryClient.fetchQuery({
        queryKey: queryKeys.exercises(ctx.userId),
        queryFn: () => listExercises(ctx),
      });
      const exercises = Object.fromEntries(rows.map((row) => [row.id, exerciseInfo(row)]));
      const ids = template?.exercises.map((item) => item.exercise_id) ?? [];
      const last = await fetchLast(ids);
      const session = startSession({
        id: ctx.newId(),
        userId: ctx.userId,
        now: ctx.now(),
        timezone: getDeviceTimezone(),
        weightUnit: profile?.weight_unit ?? 'kg',
        bodyweightKg: profile?.bodyweight_kg ?? null,
        template: template && {
          id: template.template.id,
          name: template.template.name,
          items: template.exercises.map((item) => ({
            exerciseId: item.exercise_id,
            targetSets: item.target_sets ?? 3,
            targetReps: item.target_reps_max ?? item.target_reps_min,
            targetSeconds: item.target_seconds,
          })),
        },
        exercises,
        last,
        newId: ctx.newId,
      });
      await setActiveSession(ctx.userId, session);
      return session;
    },
  });
}

/**
 * Everything the session screen does to the draft. Each change is written to the phone at once.
 */
export function useSessionActions() {
  const ctx = useDataContext();
  const records = useCurrentGymRecords();
  const fetchLast = useFetchLastPerformance();
  const change = (fn: (session: GymSession) => GymSession) => updateActiveSession(ctx.userId, fn);

  return {
    setPlan: (
      key: string,
      plan: { setCount: number; reps: number | null; seconds: number | null },
    ) => change((session) => setExercisePlan(session, key, plan, ctx.newId)),
    removeExercise: (key: string) => change((session) => removeExercise(session, key)),
    moveExercise: (key: string, offset: -1 | 1) =>
      change((session) => moveExercise(session, key, offset)),
    reorderExercises: (keys: readonly string[]) =>
      change((session) => reorderExercises(session, keys)),
    addExercises: async (rows: readonly ExerciseRow[]) => {
      const last = await fetchLast(rows.map((row) => row.id)).catch(() => ({}));
      await change((session) => addExercises(session, rows.map(exerciseInfo), last, ctx.newId));
    },
    // "OK" on a set: its values and difficulty, done.
    saveSet: (key: string, setId: string, values: SetValues) =>
      change((session) => saveSet(session, key, setId, values, records.data ?? {})),
    // Written to the phone at each keystroke, so the title survives the app closing.
    setTitle: (title: string) => change((session) => setSessionTitle(session, title)),
    discard: () => setActiveSession(ctx.userId, null),
  };
}

/**
 * Saves the finished workout in one request. Only on success is the draft deleted (and the rest
 * alert cancelled); on failure it stays on the phone for "Try again". Refreshes everything the
 * workout changes: Today's count, the Profile's list, "last time" and the records.
 */
export function useSaveGymSession() {
  const ctx = useDataContext();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: SaveSessionPayload) => saveGymSession(ctx, payload),
    onSuccess: async (_records, payload) => {
      await setActiveSession(ctx.userId, null);
      await invalidateWorkoutChange(
        queryClient,
        ctx.userId,
        payload.sets.map((set) => set.exercise_id),
      );
    },
  });
}

// Editing a saved workout --------------------------------------------------------------------------

/**
 * Opens a saved workout for editing: loads it into the edit store as a session (every set done, no
 * rest timer). Does nothing when it is already open, so going to the library and back keeps the
 * changes.
 */
export function startEditing(session: GymSession): void {
  if (!getEditSession(session.id)) setEditSession(session.id, session);
}

/**
 * What the edit screen does to the workout: the same as the session screen (plan, sets, exercises,
 * order, title), plus the date and start time, without the rest timer or the live PR seal.
 */
export function useEditActions(activityId: string) {
  const ctx = useDataContext();
  const change = (fn: (session: GymSession) => GymSession) => {
    updateEditSession(activityId, fn);
    return Promise.resolve();
  };
  return {
    setPlan: (
      key: string,
      plan: { setCount: number; reps: number | null; seconds: number | null },
    ) => change((session) => setExercisePlan(session, key, plan, ctx.newId)),
    removeExercise: (key: string) => change((session) => removeExercise(session, key)),
    moveExercise: (key: string, offset: -1 | 1) =>
      change((session) => moveExercise(session, key, offset)),
    reorderExercises: (keys: readonly string[]) =>
      change((session) => reorderExercises(session, keys)),
    saveSet: (key: string, setId: string, values: SetValues) =>
      change((session) => saveEditedSet(session, key, setId, values)),
    setTitle: (title: string) => change((session) => setSessionTitle(session, title)),
    setWhen: (when: { localDate: string; startedAt: string }) =>
      change((session) => setSessionWhen(session, when)),
    discard: () => discardEditSession(activityId),
  };
}

/**
 * Saves the edited workout in one request (update_gym_session). On success the edit is closed and
 * everything it touched is refreshed: the workout, the lists, the records, and the screens of the
 * exercises before and after (an exercise taken out changes too). On failure the edit stays.
 */
export function useUpdateGymSession(previousExerciseIds: readonly string[]) {
  const ctx = useDataContext();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateSessionPayload) => updateGymSession(ctx, payload),
    onSuccess: async (_records, payload) => {
      discardEditSession(payload.id);
      await invalidateWorkoutChange(queryClient, ctx.userId, [
        ...previousExerciseIds,
        ...payload.sets.map((set) => set.exercise_id),
      ]);
    },
  });
}

/**
 * Deletes a saved workout (delete_activity: the workout and its sets in one transaction, records
 * rebuilt once). `exerciseIds` are its exercises, whose screens change.
 */
export function useDeleteWorkout() {
  const ctx = useDataContext();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ activityId }: { activityId: string; exerciseIds: readonly string[] }) =>
      deleteActivity(ctx, activityId),
    onSuccess: (_result, { exerciseIds }) =>
      invalidateWorkoutChange(queryClient, ctx.userId, exerciseIds),
  });
}
