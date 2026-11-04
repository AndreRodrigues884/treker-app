import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, radii, sizes, spacing } from '@/theme';

export type CardProps = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
};

export function Card({ children, style, accessibilityLabel }: CardProps) {
  return (
    <View
      style={[styles.card, style]}
      accessible={accessibilityLabel !== undefined}
      accessibilityLabel={accessibilityLabel}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderColor: colors.line,
    borderWidth: sizes.border,
    borderRadius: radii.lg,
    padding: spacing[4],
    gap: spacing[3],
  },
});
