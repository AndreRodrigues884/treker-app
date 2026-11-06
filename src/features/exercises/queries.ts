import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { CustomExerciseValues } from '@/core/exercises';
import { useDataContext } from '@/features/auth/auth-provider';
import { queryKeys } from '@/lib/data/query-keys';

import {
  createCustomExercise,
  deleteCustomExercise,
  listExercises,
  updateCustomExercise,
} from './repository';

// The library and the athlete's own exercises (archived and deleted ones included, for the names in
// logged workouts; the library hides them).
// They change rarely, so they stay fresh for 5 minutes.
export function useExercises() {
  const ctx = useDataContext();
  return useQuery({
    queryKey: queryKeys.exercises(ctx.userId),
    queryFn: () => listExercises(ctx),
    staleTime: 5 * 60_000,
  });
}

export type SaveCustomExerciseInput = {
  // The exercise to change, or the id made on the phone for a new one (kept for "Try again").
  id: string;
  isNew: boolean;
  values: CustomExerciseValues;
};

// Creates or changes a custom exercise. A change can rebuild records and rename exercises in
// templates, so every exercise and template query is refreshed.
export function useSaveCustomExercise() {
  const ctx = useDataContext();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, isNew, values }: SaveCustomExerciseInput) =>
      isNew
        ? createCustomExercise(ctx, {
            id,
            name: values.name,
            muscleGroup: values.muscleGroup,
            equipment: values.equipment,
            unit: values.unit,
            tracksLoad: values.tracksLoad,
            addsBodyweight: values.addsBodyweight,
          })
        : updateCustomExercise(ctx, id, values),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.exercises(ctx.userId) }),
  });
}

// Deleting also takes the exercise out of saved workouts, so templates are refreshed too.
export function useDeleteExercise() {
  const ctx = useDataContext();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteCustomExercise(ctx, id),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.exercises(ctx.userId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.templates(ctx.userId) }),
      ]),
  });
}
