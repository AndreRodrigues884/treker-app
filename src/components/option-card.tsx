import { Check } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Icon, type LucideIcon } from '@/components/icon';
import { accentTints, colors, iconSizes, opacity, radii, sizes, spacing } from '@/theme';

export type OptionCardTone = 'gym' | 'swim';

export type OptionCardProps = {
  title: string;
  description?: string;
  selected: boolean;
  onPress: () => void;
  // checkbox when several options can be picked, radio when only one.
  multiple?: boolean;
  tone?: OptionCardTone;
  icon?: LucideIcon;
};

// A large tappable answer for questions with a few options.
export function OptionCard({
  title,
  description,
  selected,
  onPress,
  multiple = false,
  tone = 'gym',
  icon,
}: OptionCardProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={multiple ? 'checkbox' : 'radio'}
      accessibilityLabel={description ? `${title}. ${description}` : title}
      accessibilityState={{ checked: selected }}
      style={({ pressed }) => [
        styles.card,
        selected && { borderColor: colors[tone], backgroundColor: colors[accentTints[tone]] },
        pressed && styles.pressed,
      ]}
    >
      {icon && <Icon icon={icon} size="lg" color={selected ? tone : 'textSoft'} />}
      <View style={styles.text}>
        <AppText variant="heading">{title}</AppText>
        {description !== undefined && (
          <AppText variant="caption" color="muted">
            {description}
          </AppText>
        )}
      </View>
      {/* The check shows the choice without relying on color alone. */}
      <View style={[styles.check, selected && { backgroundColor: colors[tone] }]}>
        {selected && <Icon icon={Check} size="sm" color="onAccent" />}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: sizes.minTouch + spacing[4],
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    padding: spacing[4],
    borderRadius: radii.lg,
    borderWidth: sizes.border,
    borderColor: colors.line,
    backgroundColor: colors.card,
  },
  pressed: {
    opacity: opacity.pressed,
  },
  text: {
    flex: 1,
    gap: spacing[1],
  },
  check: {
    width: iconSizes.lg,
    height: iconSizes.lg,
    borderRadius: radii.pill,
    borderWidth: sizes.border,
    borderColor: colors.lineStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
