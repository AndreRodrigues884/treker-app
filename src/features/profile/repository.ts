// The athlete's profile and account. Postgres checks the onboarding answers are complete
// (profiles_onboarding_complete) and that each user only changes their own row.
import type { OnboardingChoices, OnboardingProfileUpdate } from '@/core/onboarding';
import type { DataContext } from '@/lib/data/context';
import { throwIfError, unwrap, unwrapMaybe } from '@/lib/data/result';
import { supabase } from '@/lib/supabase/client';
import type { Tables } from '@/lib/supabase/database.types';

export type ProfileRow = Tables<'profiles'>;

export async function getProfile(ctx: DataContext): Promise<ProfileRow | null> {
  return unwrapMaybe(
    await supabase.from('profiles').select('*').eq('id', ctx.userId).maybeSingle(),
  );
}

export type ProfileChanges = Partial<Omit<ProfileRow, 'id' | 'created_at' | 'updated_at'>>;

// Edits the profile (onboarding answers, units, bodyweight...). Repeating it is harmless.
export async function updateProfile(
  ctx: DataContext,
  changes: ProfileChanges,
): Promise<ProfileRow> {
  return unwrap(
    await supabase.from('profiles').update(changes).eq('id', ctx.userId).select().single(),
  );
}

// Saves every onboarding answer and marks onboarding as done in one update, so the profile is
// never half filled.
export function completeOnboarding(
  ctx: DataContext,
  answers: OnboardingProfileUpdate,
): Promise<ProfileRow> {
  return updateProfile(ctx, { ...answers, onboarded_at: ctx.now().toISOString() });
}

// Deletes the account and all its data (Postgres delete_my_account, which only ever deletes
// auth.uid()), then forgets the session on this phone.
export async function deleteAccount(): Promise<void> {
  throwIfError(await supabase.rpc('delete_my_account'));
  await supabase.auth.signOut({ scope: 'local' });
}

// The onboarding choices of a saved profile, or null before onboarding.
export function profileChoices(profile: ProfileRow): OnboardingChoices | null {
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
