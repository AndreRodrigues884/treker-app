import { Check } from 'lucide-react-native';
import { Pressable, StyleSheet } from 'react-native';

import { AppText } from '@/components/app-text';
import { Icon, type LucideIcon } from '@/components/icon';
import { accentTints, colors, opacity, radii, sizes, spacing } from '@/theme';

export type ChipTone = 'gym' | 'swim';

export type ChipProps = {
  label: string;
  selected: boolean;
  onPress: () => void;
  tone?: ChipTone;
  icon?: LucideIcon;
  disabled?: boolean;
};

// Extends the 36 pt chip to a 44 pt touch target.
const hitSlop = (sizes.minTouch - sizes.chip) / 2;

export function Chip({
  label,
  selected,
  onPress,
  tone = 'gym',
  icon,
  disabled = false,
}: ChipProps) {
  const color = selected ? tone : 'textSoft';

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={hitSlop}
      accessibilityRole="togglebutton"
      accessibilityLabel={label}
      accessibilityState={{ checked: selected, disabled }}
      style={({ pressed }) => [
        styles.chip,
        selected && {
          backgroundColor: colors[accentTints[tone]],
          borderColor: colors[tone],
        },
        disabled && styles.disabled,
        pressed && styles.pressed,
      ]}
    >
      {/* The check mark shows selection without relying on color alone. */}
      {selected ? (
        <Icon icon={Check} size="sm" color={color} />
      ) : (
        icon && <Icon icon={icon} size="sm" color={color} />
      )}
      <AppText variant="caption" color={color}>
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: sizes.chip,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
    paddingHorizontal: spacing[3],
    borderRadius: radii.pill,
    borderWidth: sizes.border,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  disabled: {
    opacity: opacity.disabled,
  },
  pressed: {
    opacity: opacity.pressed,
  },
});
