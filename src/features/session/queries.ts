import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  addExercises,
  adjustRest,
  moveExercise,
  removeExercise,
  reorderExercises,
  saveSet,
  setExercisePlan,
  setSessionTitle,
  skipRest,
  startSession,
  type ExerciseInfo,
  type GymSession,
  type SaveSessionPayload,
  type SetValues,
} from '@/core/session';
import { useAuth, useDataContext } from '@/features/auth/auth-provider';
import { listExercises, type ExerciseRow } from '@/features/exercises/repository';
import type { TemplateWithExercises } from '@/features/templates/repository';
import { queryKeys } from '@/lib/data/query-keys';
import { getDeviceTimezone } from '@/lib/device';
import { useI18n } from '@/lib/i18n';

import { getCurrentGymRecords, getLastPerformance, saveGymSession } from './repository';
import { cancelRestEnd, scheduleRestEnd } from './rest-notifications';
import { getActiveSession, setActiveSession, updateActiveSession } from './session-store';

export function exerciseInfo(row: ExerciseRow): ExerciseInfo {
  return {
    id: row.id,
    unit: row.unit,
    tracksLoad: row.tracks_load,
    addsBodyweight: row.adds_bodyweight,
  };
}

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
 * Doing a set starts the rest timer and schedules the "rest is over" alert; adjusting or skipping
 * the rest moves or cancels it.
 */
export function useSessionActions() {
  const ctx = useDataContext();
  const { t } = useI18n();
  const records = useCurrentGymRecords();
  const fetchLast = useFetchLastPerformance();
  const change = (fn: (session: GymSession) => GymSession) => updateActiveSession(ctx.userId, fn);

  // Re-schedules the alert for the session's rest (or cancels it when there is none).
  const syncRestAlert = async (previousId: string | null) => {
    await cancelRestEnd(previousId);
    const session = getActiveSession(ctx.userId);
    if (!session?.rest) return;
    const id = await scheduleRestEnd(new Date(session.rest.endsAt), {
      title: t.session.restOverTitle,
      body: t.session.restOverBody,
    });
    await change((current) => ({ ...current, restNotificationId: id }));
  };

  const restChange = async (fn: (session: GymSession) => GymSession) => {
    const previousId = getActiveSession(ctx.userId)?.restNotificationId ?? null;
    await change(fn);
    await syncRestAlert(previousId);
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
    addExercises: async (rows: readonly ExerciseRow[]) => {
      const last = await fetchLast(rows.map((row) => row.id)).catch(() => ({}));
      await change((session) => addExercises(session, rows.map(exerciseInfo), last, ctx.newId));
    },
    // "OK" on a set: its values and difficulty, done; starts the rest (and its alert) when new.
    saveSet: (key: string, setId: string, values: SetValues) =>
      restChange((session) => saveSet(session, key, setId, values, ctx.now(), records.data ?? {})),
    adjustRest: (deltaS: number) => restChange((session) => adjustRest(session, deltaS, ctx.now())),
    skipRest: () => restChange(skipRest),
    // Written to the phone at each keystroke, so the title survives the app closing.
    setTitle: (title: string) => change((session) => setSessionTitle(session, title)),
    discard: async () => {
      await cancelRestEnd(getActiveSession(ctx.userId)?.restNotificationId ?? null);
      await setActiveSession(ctx.userId, null);
    },
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
    onSuccess: async () => {
      await cancelRestEnd(getActiveSession(ctx.userId)?.restNotificationId ?? null);
      await setActiveSession(ctx.userId, null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.activities(ctx.userId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.records(ctx.userId) }),
      ]);
    },
  });
}
