import { Stack } from 'expo-router';

import { useAuth } from '@/features/auth/auth-provider';
import { colors } from '@/theme';

// Route protection as recommended by Expo Router: each group is only available while its guard
// is true, and the router moves the user to the first available group when a guard changes.
// - signed out           -> (auth): email and code screens
// - signed in, new user  -> (onboarding)
// - signed in, onboarded -> (app)
// This only decides navigation; the data itself is protected by RLS in Postgres.
export function RootNavigator() {
  const { session, needsOnboarding } = useAuth();
  const signedIn = session !== null;
  // Where every closed group sends the user (redirectTo, Expo Router SDK 58+).
  const home = !signedIn ? '/sign-in' : needsOnboarding ? '/onboarding' : '/';

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
