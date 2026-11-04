// Renders the real intro, auth, onboarding and app routes with the real providers and route
// guards. The Supabase client must be mocked (see supabase-mock.ts); AsyncStorage is mocked in
// jest.setup.ts.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { renderRouter } from 'expo-router/testing-library';

import AppLayout from '@/app/(app)/_layout';
import HomeScreen from '@/app/(app)/index';
import AuthLayout from '@/app/(auth)/_layout';
import SignInScreen from '@/app/(auth)/sign-in';
import VerifyCodeScreen from '@/app/(auth)/verify';
import WelcomeScreen from '@/app/(auth)/welcome';
import OnboardingLayout from '@/app/(onboarding)/_layout';
import OnboardingScreen from '@/app/(onboarding)/onboarding';
import { AuthProvider } from '@/features/auth/auth-provider';
import { RootNavigator } from '@/features/auth/root-navigator';
import { IntroProvider } from '@/features/intro/intro-state';
import { storageKeys } from '@/lib/storage';

function RootLayout() {
  return (
    <IntroProvider>
      <AuthProvider>
        <RootNavigator />
      </AuthProvider>
    </IntroProvider>
  );
}

// Clears the phone storage; by default the intro counts as already seen.
export async function resetStorage(options: { introSeen?: boolean } = {}) {
  await AsyncStorage.clear();
  if (options.introSeen ?? true) {
    await AsyncStorage.setItem(storageKeys.introSeen, 'true');
  }
}

export function renderApp(initialUrl = '/') {
  return renderRouter(
    {
      _layout: RootLayout,
      '(auth)/_layout': AuthLayout,
      '(auth)/welcome': WelcomeScreen,
      '(auth)/sign-in': SignInScreen,
      '(auth)/verify': VerifyCodeScreen,
      '(onboarding)/_layout': OnboardingLayout,
      '(onboarding)/onboarding': OnboardingScreen,
      '(app)/_layout': AppLayout,
      '(app)/index': HomeScreen,
    },
    { initialUrl },
  );
}
