import { Minus, Plus } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Icon } from '@/components/icon';
import { colors, opacity, radii, sizes, spacing, typography } from '@/theme';

export type StepperProps = {
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  // Read by screen readers, e.g. "Workouts per week".
  label: string;
  // Spoken and shown under the number, e.g. "4 a week".
  valueText: string;
  decreaseLabel: string;
  increaseLabel: string;
};

// A large number with - and + buttons. Screen readers treat it as one adjustable control.
export function Stepper({
  value,
  min,
  max,
  onChange,
  label,
  valueText,
  decreaseLabel,
  increaseLabel,
}: StepperProps) {
  const decrease = () => onChange(Math.max(min, value - 1));
  const increase = () => onChange(Math.min(max, value + 1));

  return (
    <View
      style={styles.container}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{ min, max, now: value, text: valueText }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(event) =>
        event.nativeEvent.actionName === 'increment' ? increase() : decrease()
      }
    >
      <StepButton icon={Minus} label={decreaseLabel} onPress={decrease} disabled={value <= min} />
      <View style={styles.value}>
        <AppText style={styles.number}>{value}</AppText>
        <AppText variant="caption" color="muted">
          {valueText}
        </AppText>
      </View>
      <StepButton icon={Plus} label={increaseLabel} onPress={increase} disabled={value >= max} />
    </View>
  );
}

function StepButton({
  icon,
  label,
  onPress,
  disabled,
}: {
  icon: typeof Plus;
  label: string;
  onPress: () => void;
  disabled: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        styles.button,
        disabled && styles.disabled,
        pressed && styles.pressed,
      ]}
    >
      <Icon icon={icon} size="lg" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[4],
  },
  value: {
    flex: 1,
    alignItems: 'center',
  },
  number: {
    ...typography.display,
    fontFamily: typography.numeric.fontFamily,
    fontVariant: typography.numeric.fontVariant,
  },
  button: {
    width: sizes.minTouch + spacing[4],
    height: sizes.minTouch + spacing[4],
    borderRadius: radii.pill,
    borderWidth: sizes.border,
    borderColor: colors.lineStrong,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: {
    opacity: opacity.disabled,
  },
  pressed: {
    opacity: opacity.pressed,
  },
});
