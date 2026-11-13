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
  // Floating over the content (the "+" button, a bottom bar); the content leaves room for it. It
  // is placed inside the safe area, so `bottom: 0` sits above the phone's own buttons (Android
  // navigation bar, iPhone home indicator).
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
      <View style={styles.body}>
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
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  // Inside the safe area's padding: absolute children are placed against this box.
  body: {
    flex: 1,
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
