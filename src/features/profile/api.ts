import type { OnboardingChoices, OnboardingProfileUpdate } from '@/core/onboarding';
import { supabase } from '@/lib/supabase/client';
import type { Tables } from '@/lib/supabase/database.types';

const PROFILE_COLUMNS =
  'id, display_name, weight_unit, pool_unit, bodyweight_kg, onboarded_at, sports, gym_focus, swim_style, default_pool_length, weekly_target';

export type Profile = Pick<
  Tables<'profiles'>,
  | 'id'
  | 'display_name'
  | 'weight_unit'
  | 'pool_unit'
  | 'bodyweight_kg'
  | 'onboarded_at'
  | 'sports'
  | 'gym_focus'
  | 'swim_style'
  | 'default_pool_length'
  | 'weekly_target'
>;

export async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select(PROFILE_COLUMNS)
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// Saves every answer and marks onboarding as done in one update, so the profile is never half
// filled. Postgres checks the answers are complete (profiles_onboarding_complete).
export async function completeOnboarding(
  userId: string,
  update: OnboardingProfileUpdate,
): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ ...update, onboarded_at: new Date().toISOString() })
    .eq('id', userId);
  if (error) throw error;
}

// Saves answers edited in the profile. buildProfileUpdate already checked they are complete for
// the chosen sports; Postgres checks again (profiles_onboarding_complete).
export async function updateProfileAnswers(
  userId: string,
  update: OnboardingProfileUpdate,
): Promise<void> {
  const { error } = await supabase.from('profiles').update(update).eq('id', userId);
  if (error) throw error;
}

// Deletes the signed-in user's account and all their data (Postgres delete_my_account, which
// only ever deletes auth.uid()), then forgets the session on this phone.
export async function deleteMyAccount(): Promise<void> {
  const { error } = await supabase.rpc('delete_my_account');
  if (error) throw error;
  await supabase.auth.signOut({ scope: 'local' });
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
