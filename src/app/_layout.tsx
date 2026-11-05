import { QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { AuthProvider } from '@/features/auth/auth-provider';
import { RootNavigator } from '@/features/auth/root-navigator';
import { SplashController } from '@/features/auth/splash-controller';
import { IntroProvider } from '@/features/intro/intro-state';
import { OfflineBanner } from '@/features/network/offline-banner';
import { createQueryClient, setUpQueryManagers } from '@/lib/data/query-client';
import { LanguageProvider } from '@/lib/i18n';
import { colors, fontAssets } from '@/theme';

SplashScreen.preventAutoHideAsync();
setUpQueryManagers();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts(fontAssets);
  // On a font error, fall back to system fonts rather than staying on the splash screen.
  const fontsReady = fontsLoaded || fontError !== null;
  const [queryClient] = useState(() => createQueryClient());

  return (
    // Needed by the side menu's swipe gesture (react-native-gesture-handler).
    <GestureHandlerRootView style={styles.root}>
      <QueryClientProvider client={queryClient}>
        <LanguageProvider>
          <IntroProvider>
            <AuthProvider>
              <StatusBar style="light" />
              <SplashController fontsReady={fontsReady} />
              {fontsReady && <RootNavigator />}
              <OfflineBanner />
            </AuthProvider>
          </IntroProvider>
        </LanguageProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
});
