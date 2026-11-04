import { StyleSheet, View } from 'react-native';

import { colors, sizes } from '@/theme';

export function Divider() {
  return (
    <View
      style={styles.divider}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    />
  );
}

const styles = StyleSheet.create({
  divider: {
    height: sizes.border,
    alignSelf: 'stretch',
    backgroundColor: colors.divider,
  },
});
