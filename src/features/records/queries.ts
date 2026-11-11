import { useInfiniteQuery, useQuery, type QueryClient } from '@tanstack/react-query';

import { nextCursor, type ActivityCursor } from '@/core/activities';
import { useDataContext } from '@/features/auth/auth-provider';
import { queryKeys } from '@/lib/data/query-keys';

import {
  getExerciseProgress,
  getExerciseStats,
  listExerciseHistory,
  listGymRecords,
} from './repository';

export const HISTORY_PAGE_SIZE = 10;

// One record per exercise (the records screen), the most recent first.
export function useGymRecords() {
  const ctx = useDataContext();
  return useQuery({
    queryKey: queryKeys.gymRecords(ctx.userId),
    queryFn: () => listGymRecords(ctx),
  });
}

// The exercise screen: its current record (null when it has none).
export function useExerciseRecord(exerciseId: string) {
  const ctx = useDataContext();
  return useQuery({
    queryKey: queryKeys.exerciseRecord(ctx.userId, exerciseId),
    queryFn: async () => (await listGymRecords(ctx, exerciseId))[0] ?? null,
  });
}

export function useExerciseStats(exerciseId: string) {
  const ctx = useDataContext();
  return useQuery({
    queryKey: queryKeys.exerciseStats(ctx.userId, exerciseId),
    queryFn: () => getExerciseStats(ctx, exerciseId),
  });
}

// The chart points from a date (null: everything).
export function useExerciseProgress(exerciseId: string, from: string | null) {
  const ctx = useDataContext();
  return useQuery({
    queryKey: queryKeys.exerciseProgress(ctx.userId, exerciseId, from),
    queryFn: () => getExerciseProgress(ctx, exerciseId, from),
  });
}

// The workouts with this exercise, newest first, one page at a time by cursor.
export function useExerciseHistory(exerciseId: string) {
  const ctx = useDataContext();
  return useInfiniteQuery({
    queryKey: queryKeys.exerciseHistory(ctx.userId, exerciseId),
    queryFn: ({ pageParam }) =>
      listExerciseHistory(ctx, exerciseId, { before: pageParam, limit: HISTORY_PAGE_SIZE }),
    initialPageParam: undefined as ActivityCursor | undefined,
    getNextPageParam: (lastPage) =>
      nextCursor(
        lastPage.map((entry) => ({
          localDate: entry.localDate,
          startedAt: entry.startedAt,
          id: entry.activityId,
        })),
        HISTORY_PAGE_SIZE,
      ),
  });
}

/**
 * After a workout is saved, edited or deleted: its detail, the workout lists and counts (Today,
 * Profile), "last time", the records, and the screens of the exercises it touched.
 */
export async function invalidateWorkoutChange(
  queryClient: QueryClient,
  userId: string,
  exerciseIds: readonly string[],
): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.activities(userId) }),
    queryClient.invalidateQueries({ queryKey: queryKeys.records(userId) }),
    ...[...new Set(exerciseIds)].map((exerciseId) =>
      queryClient.invalidateQueries({ queryKey: queryKeys.exercise(userId, exerciseId) }),
    ),
  ]);
}
