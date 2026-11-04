import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';

import { useAuth } from '@/features/auth/auth-provider';
import { useIntro } from '@/features/intro/intro-state';

// Keeps the native splash screen up until fonts, the stored session and the intro flag are
// ready, so the user never sees the wrong screen flash before being sent to the right one.
export function SplashController({ fontsReady }: { fontsReady: boolean }) {
  const { isLoading } = useAuth();
  const { introSeen } = useIntro();
  const ready = fontsReady && !isLoading && introSeen !== null;

  useEffect(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);

  return null;
}
