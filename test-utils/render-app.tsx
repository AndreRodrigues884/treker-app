// Renders the real intro, auth, onboarding and app routes with the real providers and route
// guards. The Supabase client must be mocked (see supabase-mock.ts); AsyncStorage and NetInfo are
// mocked in jest.setup.ts.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { renderRouter } from 'expo-router/testing-library';

import DrawerLayout from '@/app/(app)/(drawer)/_layout';
import CalendarScreen from '@/app/(app)/(drawer)/calendar';
import TodayScreen from '@/app/(app)/(drawer)/index';
import ProfileScreen from '@/app/(app)/(drawer)/profile';
import RecordsScreen from '@/app/(app)/(drawer)/records';
import StatsScreen from '@/app/(app)/(drawer)/stats';
import WorkoutsScreen from '@/app/(app)/(drawer)/workouts';
import AppLayout from '@/app/(app)/_layout';
import WorkoutScreen from '@/app/(app)/activities/[id]';
import EditWorkoutScreen from '@/app/(app)/activities/edit/[id]';
import ExerciseScreen from '@/app/(app)/exercise/[id]';
import EditExerciseScreen from '@/app/(app)/exercises/[id]';
import ExercisesScreen from '@/app/(app)/exercises/index';
import NewExerciseScreen from '@/app/(app)/exercises/new';
import FinishScreen from '@/app/(app)/session/finish';
import SessionScreen from '@/app/(app)/session/index';
import DeleteAccountScreen from '@/app/(app)/settings/delete-account';
import EditAnswerScreen from '@/app/(app)/settings/edit';
import SettingsScreen from '@/app/(app)/settings/index';
import LanguageScreen from '@/app/(app)/settings/language';
import EditProfileScreen from '@/app/(app)/settings/profile';
import StartWorkoutScreen from '@/app/(app)/start';
import StrengthExercisesScreen from '@/app/(app)/stats/exercises';
import SavedWorkoutScreen from '@/app/(app)/template/[id]';
import TemplateEditorScreen from '@/app/(app)/templates/[id]';
import AuthLayout from '@/app/(auth)/_layout';
import SignInScreen from '@/app/(auth)/sign-in';
import VerifyCodeScreen from '@/app/(auth)/verify';
import WelcomeScreen from '@/app/(auth)/welcome';
import OnboardingLayout from '@/app/(onboarding)/_layout';
import OnboardingScreen from '@/app/(onboarding)/onboarding';
import { AuthProvider } from '@/features/auth/auth-provider';
import { RootNavigator } from '@/features/auth/root-navigator';
import { IntroProvider } from '@/features/intro/intro-state';
import { OfflineBanner } from '@/features/network/offline-banner';
import { createQueryClient } from '@/lib/data/query-client';
import { LanguageProvider } from '@/lib/i18n';
import { storageKeys } from '@/lib/storage';

// A fresh cache for every render, without automatic retries so errors show straight away.
let queryClient: QueryClient = createQueryClient({ retry: false });

// The cache of the app rendered last, for assertions.
export function currentQueryClient(): QueryClient {
  return queryClient;
}

function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <IntroProvider>
          <AuthProvider>
            <RootNavigator />
            <OfflineBanner />
          </AuthProvider>
        </IntroProvider>
      </LanguageProvider>
    </QueryClientProvider>
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
  queryClient = createQueryClient({ retry: false });
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
      '(app)/(drawer)/stats': StatsScreen,
      '(app)/(drawer)/workouts': WorkoutsScreen,
      '(app)/activities/[id]': WorkoutScreen,
      '(app)/activities/edit/[id]': EditWorkoutScreen,
      '(app)/exercise/[id]': ExerciseScreen,
      '(app)/exercises/[id]': EditExerciseScreen,
      '(app)/exercises/index': ExercisesScreen,
      '(app)/exercises/new': NewExerciseScreen,
      '(app)/session/finish': FinishScreen,
      '(app)/session/index': SessionScreen,
      '(app)/start': StartWorkoutScreen,
      '(app)/stats/exercises': StrengthExercisesScreen,
      '(app)/template/[id]': SavedWorkoutScreen,
      '(app)/templates/[id]': TemplateEditorScreen,
      '(app)/settings/edit': EditAnswerScreen,
      '(app)/settings/index': SettingsScreen,
      '(app)/settings/language': LanguageScreen,
      '(app)/settings/profile': EditProfileScreen,
      '(app)/settings/delete-account': DeleteAccountScreen,
    },
    { initialUrl },
  );
}
