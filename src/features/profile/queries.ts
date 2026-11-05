import { useMutation, useQueryClient } from '@tanstack/react-query';

import type { OnboardingProfileUpdate } from '@/core/onboarding';
import { useDataContext } from '@/features/auth/auth-provider';
import { queryKeys } from '@/lib/data/query-keys';

import {
  completeOnboarding,
  updateProfile,
  type ProfileChanges,
  type ProfileRow,
} from './repository';

// After a profile write, the cached profile is replaced by the row the server returned, so every
// screen (and the route guards) sees it straight away.
function useStoreProfile() {
  const queryClient = useQueryClient();
  return (userId: string, profile: ProfileRow) => {
    queryClient.setQueryData(queryKeys.profile(userId), profile);
    void queryClient.invalidateQueries({ queryKey: queryKeys.profile(userId) });
  };
}

export function useUpdateProfile() {
  const ctx = useDataContext();
  const storeProfile = useStoreProfile();
  return useMutation({
    mutationFn: (changes: ProfileChanges) => updateProfile(ctx, changes),
    onSuccess: (profile) => storeProfile(ctx.userId, profile),
  });
}

export function useCompleteOnboarding() {
  const ctx = useDataContext();
  const storeProfile = useStoreProfile();
  return useMutation({
    mutationFn: (answers: OnboardingProfileUpdate) => completeOnboarding(ctx, answers),
    onSuccess: (profile) => storeProfile(ctx.userId, profile),
  });
}
