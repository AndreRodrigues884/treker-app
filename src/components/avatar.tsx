import { User } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Icon } from '@/components/icon';
import { initialsOf } from '@/core/format';
import { accentTints, colors, radii, sizes, spacing, typography } from '@/theme';

export type AvatarProps = {
  name: string | null;
};

const SIZE = sizes.minTouch * 2;

// The profile picture. For now the athlete's initials (a person icon without a name), in the
// circle where the photo will go. Decorative: the name is always shown next to it.
export function Avatar({ name }: AvatarProps) {
  const initials = initialsOf(name);
  return (
    <View
      style={styles.circle}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {initials ? (
        <AppText style={styles.initials} color="gym" maxFontSizeMultiplier={1}>
          {initials}
        </AppText>
      ) : (
        <Icon icon={User} size="lg" color="gym" />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  circle: {
    width: SIZE,
    height: SIZE,
    borderRadius: radii.pill,
    borderWidth: sizes.border,
    borderColor: colors.gym,
    backgroundColor: colors[accentTints.gym],
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[1],
  },
  initials: {
    ...typography.title,
  },
});
