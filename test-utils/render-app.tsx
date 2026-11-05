// Renders the real intro, auth, onboarding and app routes with the real providers and route
// guards. The Supabase client must be mocked (see supabase-mock.ts); AsyncStorage is mocked in
// jest.setup.ts.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { renderRouter } from 'expo-router/testing-library';

import DrawerLayout from '@/app/(app)/(drawer)/_layout';
import CalendarScreen from '@/app/(app)/(drawer)/calendar';
import TodayScreen from '@/app/(app)/(drawer)/index';
import ProfileScreen from '@/app/(app)/(drawer)/profile';
import RecordsScreen from '@/app/(app)/(drawer)/records';
import AppLayout from '@/app/(app)/_layout';
import LocalDatabaseRoute from '@/app/(app)/dev/local-db';
import DeleteAccountScreen from '@/app/(app)/settings/delete-account';
import EditAnswerScreen from '@/app/(app)/settings/edit';
import LanguageScreen from '@/app/(app)/settings/language';
import StartWorkoutScreen from '@/app/(app)/start';
import AuthLayout from '@/app/(auth)/_layout';
import SignInScreen from '@/app/(auth)/sign-in';
import VerifyCodeScreen from '@/app/(auth)/verify';
import WelcomeScreen from '@/app/(auth)/welcome';
import OnboardingLayout from '@/app/(onboarding)/_layout';
import OnboardingScreen from '@/app/(onboarding)/onboarding';
import { AuthProvider } from '@/features/auth/auth-provider';
import { RootNavigator } from '@/features/auth/root-navigator';
import { IntroProvider } from '@/features/intro/intro-state';
import { LanguageProvider } from '@/lib/i18n';
import { storageKeys } from '@/lib/storage';

import { resetLocalDatabases } from './local-store';

function RootLayout() {
  return (
    <LanguageProvider>
      <IntroProvider>
        <AuthProvider>
          <RootNavigator />
        </AuthProvider>
      </IntroProvider>
    </LanguageProvider>
  );
}

// Clears the phone storage and local databases; by default the intro counts as already seen.
export async function resetStorage(options: { introSeen?: boolean } = {}) {
  resetLocalDatabases();
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
      // In file order (alphabetical), as on the phone; the drawer declares its own order.
      '(app)/(drawer)/_layout': DrawerLayout,
      '(app)/(drawer)/calendar': CalendarScreen,
      '(app)/(drawer)/index': TodayScreen,
      '(app)/(drawer)/profile': ProfileScreen,
      '(app)/(drawer)/records': RecordsScreen,
      '(app)/start': StartWorkoutScreen,
      '(app)/settings/edit': EditAnswerScreen,
      '(app)/settings/language': LanguageScreen,
      '(app)/dev/local-db': LocalDatabaseRoute,
      '(app)/settings/delete-account': DeleteAccountScreen,
    },
    { initialUrl },
  );
}
