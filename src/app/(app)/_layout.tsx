import { Stack } from 'expo-router';

import { colors } from '@/theme';

// The signed-in app: the side-menu screens, plus screens that open on top of them. Every screen
// is always registered; the profile only changes what they show.
export default function AppLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
      <Stack.Screen name="(drawer)" />
      <Stack.Screen name="start" options={{ presentation: 'modal' }} />
    </Stack>
  );
}
