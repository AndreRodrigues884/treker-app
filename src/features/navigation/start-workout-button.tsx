import { router } from 'expo-router';
import { Plus } from 'lucide-react-native';
import { Pressable, StyleSheet } from 'react-native';

import { Icon } from '@/components';
import { useDataContext } from '@/features/auth/auth-provider';
import { useActiveSession } from '@/features/session/session-store';
import { useI18n } from '@/lib/i18n';
import { colors, opacity, radii, sizes, spacing } from '@/theme';

// Floating "+" in the bottom-right corner of the main screens. Opens /start (a modal with only
// the sports chosen in onboarding), or the workout in progress: there is only one at a time.
// Pass it to Screen's `floating` prop.
export function StartWorkoutButton() {
  const { t } = useI18n();
  const ctx = useDataContext();
  const session = useActiveSession(ctx.userId);
  return (
    <Pressable
      onPress={() => router.push(session ? '/session' : '/start')}
      accessibilityRole="button"
      accessibilityLabel={t.nav.start}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
    >
      <Icon icon={Plus} size="lg" color="onAccent" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    position: 'absolute',
    right: spacing[5],
    bottom: spacing[5],
    // At least 56 pt to touch.
    width: sizes.fab,
    height: sizes.fab,
    borderRadius: radii.pill,
    backgroundColor: colors.gym,
    alignItems: 'center',
    justifyContent: 'center',
    // Lifts it above the content.
    elevation: spacing[2],
    shadowColor: colors.bg,
    shadowOpacity: opacity.disabled,
    shadowRadius: spacing[2],
    shadowOffset: { width: 0, height: spacing[1] },
  },
  pressed: {
    opacity: opacity.pressed,
  },
});
