import type { Session } from '@supabase/supabase-js';
import {
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { fetchProfile } from '@/features/profile/api';
import { getProfile, saveProfileFromServer, type ProfileRow } from '@/features/profile/repository';
import { deleteLocalStore, openLocalStore, useLocalQuery, type LocalStore } from '@/lib/local-db';
import { startAutoRefreshWhileActive, supabase } from '@/lib/supabase/client';

export type AuthState = {
  // True until the stored session (and, when signed in, the local profile) has been read.
  isLoading: boolean;
  session: Session | null;
  // The signed-in athlete's local database (null when signed out).
  store: LocalStore | null;
  // Read from the local database. Null when signed out, or when it was never downloaded
  // (first sign-in without a connection).
  profile: ProfileRow | null;
  needsOnboarding: boolean;
  signOut: () => Promise<void>;
  // Dev tool: deletes the local database and starts again from the server's profile.
  resetLocalData: () => void;
};

const AuthContext = createContext<AuthState | null>(null);

export function useAuth(): AuthState {
  const auth = use(AuthContext);
  if (!auth) throw new Error('useAuth must be used inside <AuthProvider>');
  return auth;
}

// The signed-in athlete's local database. Only for screens inside (app) and (onboarding).
export function useLocalStore(): LocalStore {
  const { store } = useAuth();
  if (!store) throw new Error('No local database: nobody is signed in');
  return store;
}

// Downloads the profile into the local database once per sign-in (full sync comes in step 6b).
// Without a connection the phone keeps using what it already has.
async function importServerProfile(store: LocalStore): Promise<void> {
  try {
    const row = await fetchProfile(store.userId);
    if (row) saveProfileFromServer(store, row);
  } catch {
    // Offline or server error: keep the local copy.
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [sessionLoaded, setSessionLoaded] = useState(false);
  // Bumped when the local database is deleted, to open a fresh one.
  const [generation, setGeneration] = useState(0);
  // The user whose profile was imported at least once (loading only counts the first time).
  const [importedFor, setImportedFor] = useState<string | null>(null);

  const userId = session?.user.id ?? null;
  // openLocalStore returns the already open database for a user, so this is safe to repeat.
  const store = useMemo(
    () => (userId ? openLocalStore(userId) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [userId, generation],
  );
  const importKey = userId ? `${userId}:${generation}` : null;

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
    if (!store || !importKey) return;
    let current = true;
    const importingFor = store.userId;
    void importServerProfile(store).then(() => {
      if (current) setImportedFor(importingFor);
    });
    return () => {
      current = false;
    };
  }, [store, importKey]);

  const profile = useLocalQuery(store, getProfile, ['profiles']);

  const signOut = useCallback(async () => {
    // 'local' signs out this device even without a connection. The local database stays on the
    // phone for the next sign-in.
    await supabase.auth.signOut({ scope: 'local' });
  }, []);

  const resetLocalData = useCallback(() => {
    if (!userId) return;
    deleteLocalStore(userId);
    setGeneration((value) => value + 1);
  }, [userId]);

  // After the dev reset, the screens stay and the profile reappears when imported again.
  const profileReady = userId !== null && importedFor === userId && profile !== undefined;
  const isLoading = !sessionLoaded || (userId !== null && !profileReady);
  const currentProfile = profileReady ? (profile ?? null) : null;

  const value: AuthState = {
    isLoading,
    session,
    store,
    profile: currentProfile,
    needsOnboarding:
      session !== null && currentProfile !== null && currentProfile.onboarded_at === null,
    signOut,
    resetLocalData,
  };

  return <AuthContext value={value}>{children}</AuthContext>;
}
