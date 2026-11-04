import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';

import { useAuth } from '@/features/auth/auth-provider';

// Keeps the native splash screen up until fonts and the stored session are ready, so the user
// never sees the sign-in screen flash before being sent to the app.
export function SplashController({ fontsReady }: { fontsReady: boolean }) {
  const { isLoading } = useAuth();
  const ready = fontsReady && !isLoading;

  useEffect(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);

  return null;
}
