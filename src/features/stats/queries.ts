import { useQuery } from '@tanstack/react-query';

import { useDataContext } from '@/features/auth/auth-provider';
import { queryKeys } from '@/lib/data/query-keys';

import {
  getOneRepMaxSeries,
  getTemplateProgress,
  getTemplateUsage,
  getVolumeByMuscleGroup,
  getWeeklySummary,
  getWorkoutProgress,
  listExerciseUsage,
} from './repository';

// How many workouts the saved workout screen charts.
export const TEMPLATE_PROGRESS_LIMIT = 8;

// Every query here is under ['user', id, 'stats']: saving, editing or deleting a workout
// invalidates them all (invalidateWorkoutChange in src/features/records/queries.ts).

// The progress of each exercise of a saved gym workout (detail and "Workout saved").
export function useWorkoutProgress(activityId: string, options: { enabled?: boolean } = {}) {
  const ctx = useDataContext();
  return useQuery({
    queryKey: queryKeys.workoutProgress(ctx.userId, activityId),
    queryFn: () => getWorkoutProgress(ctx, activityId),
    enabled: options.enabled ?? true,
  });
}

export function useTemplateProgress(templateId: string) {
  const ctx = useDataContext();
  return useQuery({
    queryKey: queryKeys.templateProgress(ctx.userId, templateId),
    queryFn: () => getTemplateProgress(ctx, templateId, TEMPLATE_PROGRESS_LIMIT),
  });
}

export function useOneRepMaxSeries(exerciseIds: readonly string[], from: string | null) {
  const ctx = useDataContext();
  return useQuery({
    queryKey: queryKeys.oneRepMaxSeries(ctx.userId, exerciseIds, from),
    queryFn: () => getOneRepMaxSeries(ctx, exerciseIds, from),
  });
}

export function useWeeklySummary(from: string | null, to: string) {
  const ctx = useDataContext();
  return useQuery({
    queryKey: queryKeys.weeklySummary(ctx.userId, from, to),
    queryFn: () => getWeeklySummary(ctx, from, to),
  });
}

export function useVolumeByMuscleGroup(from: string | null, to: string) {
  const ctx = useDataContext();
  return useQuery({
    queryKey: queryKeys.muscleGroupVolume(ctx.userId, from, to),
    queryFn: () => getVolumeByMuscleGroup(ctx, from, to),
  });
}

export function useTemplateUsage(from: string | null, to: string) {
  const ctx = useDataContext();
  return useQuery({
    queryKey: queryKeys.templateUsage(ctx.userId, from, to),
    queryFn: () => getTemplateUsage(ctx, from, to),
  });
}

// The exercises the athlete has done, for the strength chart's default choice.
export function useExerciseUsage() {
  const ctx = useDataContext();
  return useQuery({
    queryKey: queryKeys.exerciseUsage(ctx.userId),
    queryFn: () => listExerciseUsage(ctx),
  });
}
