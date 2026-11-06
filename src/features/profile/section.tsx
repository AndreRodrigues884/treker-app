import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components';
import { spacing } from '@/theme';

// A titled group of rows, as used by Profile, Edit profile and Settings.
export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <AppText variant="caption" color="muted" accessibilityRole="header">
        {title}
      </AppText>
      <View>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: spacing[2],
  },
});
