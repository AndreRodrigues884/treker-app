import { Stack } from 'expo-router';

import { useAuth } from '@/features/auth/auth-provider';
import { useIntro } from '@/features/intro/intro-state';
import { colors } from '@/theme';

// Route protection as recommended by Expo Router: each group is only available while its guard
// is true; when a guard closes, the user goes to redirectTo.
// - signed out                -> (auth): the intro the first time (/welcome), else the email
// - signed in, not onboarded  -> (onboarding): the questionnaire
// - signed in and onboarded   -> (app)
// This only decides navigation; the data itself is protected by RLS in Postgres.
export function RootNavigator() {
  const { session, needsOnboarding, isLoading } = useAuth();
  const { introSeen } = useIntro();
  // Signed in only once the profile is known as well. Right after the code is accepted the
  // session arrives before the profile; opening (app) in that gap mounted its navigator and
  // unmounted it again a moment later (for users who still need onboarding), dropping actions
  // that navigator had queued (the "ROUTE_NAMES_CHANGED ... was not handled" error). Until the
  // profile arrives the user stays on the code screen; at launch the splash screen covers it.
  const signedIn = session !== null && !isLoading;

  // Wait for the stored intro flag: unlike the session, it does not open or close a group, so a
  // redirect decided before it is read would never be corrected. The splash screen covers this.
  if (introSeen === null) return null;

  const home = !signedIn
    ? introSeen
      ? '/sign-in'
      : '/welcome'
    : needsOnboarding
      ? '/onboarding'
      : '/';

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <Stack.Protected guard={signedIn && !needsOnboarding} redirectTo={home}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>
      <Stack.Protected guard={signedIn && needsOnboarding} redirectTo={home}>
        <Stack.Screen name="(onboarding)" />
      </Stack.Protected>
      <Stack.Protected guard={!signedIn} redirectTo={home}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
    </Stack>
  );
}
