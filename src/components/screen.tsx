import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, sizes, spacing } from '@/theme';

export type ScreenProps = {
  children: ReactNode;
  scroll?: boolean;
  centered?: boolean;
  // Under a navigation header, which already covers the top safe area.
  belowHeader?: boolean;
  // A floating button over the content (bottom right); the content leaves room for it.
  floating?: ReactNode;
};

export function Screen({
  children,
  scroll = false,
  centered = false,
  belowHeader = false,
  floating,
}: ScreenProps) {
  const content = (
    <View
      style={[
        styles.content,
        centered && styles.centered,
        floating !== undefined && styles.roomForFab,
      ]}
    >
      {children}
    </View>
  );

  return (
    <SafeAreaView
      style={styles.safeArea}
      edges={belowHeader ? ['bottom', 'left', 'right'] : ['top', 'bottom', 'left', 'right']}
    >
      {scroll ? (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {content}
        </ScrollView>
      ) : (
        content
      )}
      {floating}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flexGrow: 1,
    width: '100%',
    maxWidth: sizes.maxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[4],
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  roomForFab: {
    paddingBottom: sizes.fab + spacing[8],
  },
});
