// Renders the real auth, onboarding and app routes with the real AuthProvider and route guards.
// The Supabase client must be mocked (see supabase-mock.ts).
import { renderRouter } from 'expo-router/testing-library';

import AppLayout from '@/app/(app)/_layout';
import HomeScreen from '@/app/(app)/index';
import AuthLayout from '@/app/(auth)/_layout';
import SignInScreen from '@/app/(auth)/sign-in';
import VerifyCodeScreen from '@/app/(auth)/verify';
import OnboardingLayout from '@/app/(onboarding)/_layout';
import OnboardingScreen from '@/app/(onboarding)/onboarding';
import { AuthProvider } from '@/features/auth/auth-provider';
import { RootNavigator } from '@/features/auth/root-navigator';

function RootLayout() {
  return (
    <AuthProvider>
      <RootNavigator />
    </AuthProvider>
  );
}

export function renderApp(initialUrl = '/') {
  return renderRouter(
    {
      _layout: RootLayout,
      '(auth)/_layout': AuthLayout,
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
