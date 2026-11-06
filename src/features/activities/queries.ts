import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { nextCursor, type ActivityCursor } from '@/core/activities';
import { localDateOf, weekRange } from '@/core/dates';
import { useDataContext } from '@/features/auth/auth-provider';
import type { DataContext } from '@/lib/data/context';
import { queryKeys } from '@/lib/data/query-keys';
import { getDeviceTimezone } from '@/lib/device';

import {
  countActivities,
  getActivityWithEntries,
  listActivities,
  listActivityRecords,
  listActivitySummaries,
  type DateRange,
} from './repository';

// The current week, Monday to Sunday, in the phone's local date.
export function currentWeek(now = new Date()): DateRange {
  return weekRange(localDateOf(now, getDeviceTimezone()));
}

// Workouts (not deleted) whose local date is in the current week.
export function useWorkoutsThisWeek() {
  const ctx = useDataContext();
  const week = currentWeek();
  return useQuery({
    queryKey: queryKeys.activityCount(ctx.userId, week),
    queryFn: () => countActivities(ctx, week),
  });
}

export function useActivities(range: DateRange) {
  const ctx = useDataContext();
  return useQuery({
    queryKey: queryKeys.activityList(ctx.userId, range),
    queryFn: () => listActivities(ctx, range),
  });
}

export const SUMMARY_PAGE_SIZE = 10;

/**
 * The athlete's workouts with their totals, newest first, one page at a time (the profile's
 * list): `fetchNextPage` loads the next page by cursor; `hasNextPage` is false after the last.
 * Every training write (useTrainingMutation) refreshes it, saving a session included.
 */
export function useActivitySummaries() {
  const ctx = useDataContext();
  return useInfiniteQuery({
    queryKey: queryKeys.activitySummaries(ctx.userId),
    queryFn: ({ pageParam }) =>
      listActivitySummaries(ctx, { before: pageParam, limit: SUMMARY_PAGE_SIZE }),
    initialPageParam: undefined as ActivityCursor | undefined,
    getNextPageParam: (lastPage) => nextCursor(lastPage, SUMMARY_PAGE_SIZE),
  });
}

// The records a workout set, for the workout screen.
export function useActivityRecords(activityId: string) {
  const ctx = useDataContext();
  return useQuery({
    queryKey: queryKeys.activityRecords(ctx.userId, activityId),
    queryFn: () => listActivityRecords(ctx, activityId),
  });
}

export function useActivity(activityId: string) {
  const ctx = useDataContext();
  return useQuery({
    queryKey: queryKeys.activity(ctx.userId, activityId),
    queryFn: () => getActivityWithEntries(ctx, activityId),
  });
}

/**
 * Wraps any training write (activities, gym sets, swim times) from the repositories. On success it
 * refreshes every activity query of the athlete: lists, counts (the Today screen) and details.
 *
 * To make a retry safe, put the new row's id in the variables (e.g. `{ id: ctx.newId(), ... }`)
 * and call `mutate` again with the same variables: the repository upserts by that id.
 */
export function useTrainingMutation<Input, Result>(
  write: (ctx: DataContext, input: Input) => Promise<Result>,
) {
  const ctx = useDataContext();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Input) => write(ctx, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.activities(ctx.userId) }),
  });
}
