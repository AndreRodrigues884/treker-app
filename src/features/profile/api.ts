// Server calls for the account. Training data and profile edits go through the local repositories
// (src/features/*/repository.ts); only these account operations talk to Supabase directly.
import type { OnboardingChoices } from '@/core/onboarding';
import type { ProfileRow } from '@/features/profile/repository';
import { deleteLocalStore } from '@/lib/local-db';
import { supabase } from '@/lib/supabase/client';
import type { Tables } from '@/lib/supabase/database.types';

export type Profile = ProfileRow;

// The whole profile row, to store in the local database at sign-in.
export async function fetchProfile(userId: string): Promise<Tables<'profiles'> | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// Deletes the signed-in user's account and all their data (Postgres delete_my_account, which
// only ever deletes auth.uid()), forgets the session on this phone and deletes the local
// database file.
export async function deleteMyAccount(userId: string): Promise<void> {
  const { error } = await supabase.rpc('delete_my_account');
  if (error) throw error;
  await supabase.auth.signOut({ scope: 'local' });
  deleteLocalStore(userId);
}

// The onboarding choices of a saved profile, or null before onboarding.
export function profileChoices(profile: Profile): OnboardingChoices | null {
  if (profile.onboarded_at === null || profile.sports === null || profile.weekly_target === null) {
    return null;
  }
  return {
    displayName: profile.display_name ?? '',
    sports: profile.sports,
    gymFocus: profile.gym_focus,
    swimStyle: profile.swim_style,
    poolLength: profile.default_pool_length,
    weeklyTarget: profile.weekly_target,
    weightUnit: profile.weight_unit,
    bodyweightKg: profile.bodyweight_kg,
  };
}
