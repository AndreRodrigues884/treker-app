import type { OnboardingProfile } from '@/core/profile';
import { supabase } from '@/lib/supabase/client';
import type { Tables } from '@/lib/supabase/database.types';

export type Profile = Pick<
  Tables<'profiles'>,
  'id' | 'display_name' | 'weight_unit' | 'pool_unit' | 'onboarded_at'
>;

export async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, display_name, weight_unit, pool_unit, onboarded_at')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function saveOnboarding(userId: string, profile: OnboardingProfile): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ ...profile, onboarded_at: new Date().toISOString() })
    .eq('id', userId);
  if (error) throw error;
}
