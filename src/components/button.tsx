import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Icon, type LucideIcon } from '@/components/icon';
import { colors, fontFamilies, opacity, radii, sizes, spacing, type ColorToken } from '@/theme';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost';

export type ButtonProps = {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  icon?: LucideIcon;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  accessibilityHint?: string;
  testID?: string;
};

const contentColor: Record<ButtonVariant, ColorToken> = {
  primary: 'onAccent',
  secondary: 'text',
  ghost: 'gym',
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  icon,
  loading = false,
  disabled = false,
  fullWidth = false,
  accessibilityHint,
  testID,
}: ButtonProps) {
  const inactive = disabled || loading;
  const color = contentColor[variant];

  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: inactive, busy: loading }}
      style={({ pressed }) => [
        styles.base,
        styles[variant],
        fullWidth && styles.fullWidth,
        disabled && styles.disabled,
        pressed && styles.pressed,
      ]}
    >
      {/* Content stays laid out while loading so the button keeps its size. */}
      <View style={[styles.content, loading && styles.hidden]}>
        {icon && <Icon icon={icon} color={color} />}
        <AppText style={styles.label} color={color} numberOfLines={1}>
          {label}
        </AppText>
      </View>
      {loading && <ActivityIndicator style={StyleSheet.absoluteFill} color={colors[color]} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: sizes.control,
    minWidth: sizes.minTouch,
    paddingHorizontal: spacing[5],
    borderRadius: radii.md,
    borderWidth: sizes.border,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  primary: {
    backgroundColor: colors.gym,
  },
  secondary: {
    backgroundColor: colors.surface,
    borderColor: colors.lineStrong,
  },
  ghost: {
    backgroundColor: 'transparent',
    paddingHorizontal: spacing[3],
  },
  fullWidth: {
    alignSelf: 'stretch',
  },
  disabled: {
    opacity: opacity.disabled,
  },
  pressed: {
    opacity: opacity.pressed,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  hidden: {
    opacity: 0,
  },
  label: {
    fontFamily: fontFamilies.semiBold,
  },
});
