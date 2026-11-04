import type { Session } from '@supabase/supabase-js';
import { createContext, use, useCallback, useEffect, useState, type ReactNode } from 'react';

import { fetchProfile, type Profile } from '@/features/profile/api';
import { startAutoRefreshWhileActive, supabase } from '@/lib/supabase/client';

export type AuthState = {
  // True until the stored session (and, when signed in, the profile) has been read.
  isLoading: boolean;
  session: Session | null;
  // Null when signed out, or when the profile could not be loaded (for example offline).
  profile: Profile | null;
  needsOnboarding: boolean;
  reloadProfile: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function useAuth(): AuthState {
  const auth = use(AuthContext);
  if (!auth) throw new Error('useAuth must be used inside <AuthProvider>');
  return auth;
}

// The profile as loaded for one user, so a stale result never shows for another account.
type LoadedProfile = { userId: string; profile: Profile | null };

// Offline or server error: let the user in; onboarding is checked again on the next load.
// Proper offline support comes with the local database (step 6).
function loadProfile(userId: string): Promise<LoadedProfile> {
  return fetchProfile(userId).then(
    (profile) => ({ userId, profile }),
    () => ({ userId, profile: null }),
  );
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [sessionLoaded, setSessionLoaded] = useState(false);
  const [loaded, setLoaded] = useState<LoadedProfile | null>(null);

  const userId = session?.user.id ?? null;
  const profileReady = userId !== null && loaded?.userId === userId;
  const profile = profileReady ? loaded.profile : null;

  useEffect(() => {
    const stopAutoRefresh = startAutoRefreshWhileActive();
    // Fires INITIAL_SESSION with the stored session right away, then every sign-in, sign-out
    // and token refresh. Keep this callback synchronous: Supabase calls inside it can deadlock.
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setSessionLoaded(true);
    });
    return () => {
      data.subscription.unsubscribe();
      stopAutoRefresh();
    };
  }, []);

  useEffect(() => {
    if (!userId) return;
    let current = true;
    void loadProfile(userId).then((result) => {
      if (current) setLoaded(result);
    });
    return () => {
      current = false;
    };
  }, [userId]);

  const reloadProfile = useCallback(async () => {
    if (userId) setLoaded(await loadProfile(userId));
  }, [userId]);

  const signOut = useCallback(async () => {
    // 'local' signs out this device even without a connection.
    await supabase.auth.signOut({ scope: 'local' });
  }, []);

  const isLoading = !sessionLoaded || (userId !== null && !profileReady);

  const value: AuthState = {
    isLoading,
    session,
    profile,
    needsOnboarding: session !== null && profile !== null && profile.onboarded_at === null,
    reloadProfile,
    signOut,
  };

  return <AuthContext value={value}>{children}</AuthContext>;
}
