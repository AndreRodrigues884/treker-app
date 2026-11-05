import NetInfo from '@react-native-community/netinfo';
import { focusManager, onlineManager, QueryClient } from '@tanstack/react-query';
import { AppState, Platform, type AppStateStatus } from 'react-native';

import { isNetworkError } from '@/core/errors';

// The app works online only: requests run (and fail fast with a clear error) even when the phone
// reports no connection, instead of waiting silently. Screens show the error with "Try again".
export function createQueryClient(options: { retry?: boolean } = {}): QueryClient {
  const retry = options.retry ?? true;
  return new QueryClient({
    defaultOptions: {
      queries: {
        networkMode: 'always',
        // One quick retry for network blips; server errors (RLS, checks) are not retried.
        retry: retry ? (failureCount, error) => failureCount < 1 && isNetworkError(error) : false,
        staleTime: 30_000,
      },
      mutations: {
        networkMode: 'always',
        // Writes are retried by the athlete ("Try again"), with the same ids.
        retry: false,
      },
    },
  });
}

let managersReady = false;

// React Native glue from the TanStack Query docs: online state from NetInfo (refetch when the
// connection comes back) and focus from AppState (refetch stale data when the app comes back).
export function setUpQueryManagers(): void {
  if (managersReady) return;
  managersReady = true;

  onlineManager.setEventListener((setOnline) =>
    NetInfo.addEventListener((state) => {
      setOnline(state.isConnected !== false);
    }),
  );

  if (Platform.OS !== 'web') {
    focusManager.setEventListener((setFocused) => {
      const subscription = AppState.addEventListener('change', (status: AppStateStatus) =>
        setFocused(status === 'active'),
      );
      return () => subscription.remove();
    });
  }
}
