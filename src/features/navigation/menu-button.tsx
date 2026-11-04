import { Menu } from 'lucide-react-native';
import { Pressable, StyleSheet } from 'react-native';

import { Icon } from '@/components';
import { useI18n } from '@/lib/i18n';
import { opacity, sizes, spacing } from '@/theme';

// The header button that opens the side menu (it also opens by swiping from the left edge).
export function MenuButton({ onPress }: { onPress: () => void }) {
  const { t } = useI18n();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={t.nav.openMenu}
      hitSlop={spacing[1]}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
    >
      <Icon icon={Menu} size="lg" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: sizes.minTouch,
    height: sizes.minTouch,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing[2],
  },
  pressed: {
    opacity: opacity.pressed,
  },
});
