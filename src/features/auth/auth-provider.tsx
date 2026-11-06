import type { Session } from '@supabase/supabase-js';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { getProfile, type ProfileRow } from '@/features/profile/repository';
import { createDataContext, type DataContext } from '@/lib/data/context';
import { queryKeys } from '@/lib/data/query-keys';
import { startAutoRefreshWhileActive, supabase } from '@/lib/supabase/client';

export type AuthState = {
  // True until the stored session (and, when signed in, the profile) has been read.
  isLoading: boolean;
  session: Session | null;
  // What the repositories need for the signed-in athlete (null when signed out).
  data: DataContext | null;
  // From the server, cached by TanStack Query. Null when signed out, or when it could not be
  // loaded (for example without a connection).
  profile: ProfileRow | null;
  needsOnboarding: boolean;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function useAuth(): AuthState {
  const auth = use(AuthContext);
  if (!auth) throw new Error('useAuth must be used inside <AuthProvider>');
  return auth;
}

// The signed-in athlete, for the data hooks. Only for screens inside (app) and (onboarding).
export function useDataContext(): DataContext {
  const { data } = useAuth();
  if (!data) throw new Error('Nobody is signed in');
  return data;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [sessionLoaded, setSessionLoaded] = useState(false);

  const userId = session?.user.id ?? null;
  const data = useMemo(() => (userId ? createDataContext(userId) : null), [userId]);

  useEffect(() => {
    const stopAutoRefresh = startAutoRefreshWhileActive();
    // Fires INITIAL_SESSION with the stored session right away, then every sign-in, sign-out
    // and token refresh. Keep this callback synchronous: Supabase calls inside it can deadlock.
    const { data: listener } = supabase.auth.onAuthStateChange((event, nextSession) => {
      // Signing out (or deleting the account, or the session expiring) forgets every cached
      // answer, so the next account on this phone never sees the previous one's data.
      if (event === 'SIGNED_OUT') queryClient.clear();
      setSession(nextSession);
      setSessionLoaded(true);
    });
    return () => {
      listener.subscription.unsubscribe();
      stopAutoRefresh();
    };
  }, [queryClient]);

  const profileQuery = useQuery({
    queryKey: queryKeys.profile(userId ?? 'signed-out'),
    queryFn: () => getProfile(data!),
    enabled: data !== null,
  });

  const signOut = useCallback(async () => {
    // 'local' signs out this device even without a connection.
    await supabase.auth.signOut({ scope: 'local' });
    queryClient.clear();
  }, [queryClient]);

  // The server answered that this user has no profile. Postgres creates it together with the
  // account, so the account no longer exists (deleted on another phone, or a local database
  // reset) while this phone still holds a valid token. Sign out instead of opening an empty app.
  const accountGone = data !== null && profileQuery.isSuccess && profileQuery.data === null;
  useEffect(() => {
    if (accountGone) void supabase.auth.signOut({ scope: 'local' });
  }, [accountGone]);

  // A failed profile load (offline) still lets the athlete in; it is fetched again when the
  // connection comes back. A missing account keeps loading until the sign-out lands.
  const profileSettled = profileQuery.isSuccess || profileQuery.isError;
  const isLoading = !sessionLoaded || (userId !== null && !profileSettled) || accountGone;
  const profile = userId !== null ? (profileQuery.data ?? null) : null;

  const value: AuthState = {
    isLoading,
    session,
    data,
    profile,
    needsOnboarding: session !== null && profile !== null && profile.onboarded_at === null,
    signOut,
  };

  return <AuthContext value={value}>{children}</AuthContext>;
}
