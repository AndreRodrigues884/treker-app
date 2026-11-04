import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';

import { AuthProvider } from '@/features/auth/auth-provider';
import { RootNavigator } from '@/features/auth/root-navigator';
import { SplashController } from '@/features/auth/splash-controller';
import { fontAssets } from '@/theme';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts(fontAssets);
  // On a font error, fall back to system fonts rather than staying on the splash screen.
  const fontsReady = fontsLoaded || fontError !== null;

  return (
    <AuthProvider>
      <StatusBar style="light" />
      <SplashController fontsReady={fontsReady} />
      {fontsReady && <RootNavigator />}
    </AuthProvider>
  );
}
