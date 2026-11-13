import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components';
import { useI18n } from '@/lib/i18n';
import { supabaseTarget } from '@/lib/supabase/target';
import { colors, radii, sizes, spacing } from '@/theme';

// A small "LOCAL" tag in the top-right corner while the app talks to the local Supabase, so a
// test against local data is never mistaken for the real account. Only in development builds;
// touches go through it.
export function EnvironmentBadge() {
  const { t } = useI18n();
  const insets = useSafeAreaInsets();

  if (!__DEV__ || supabaseTarget !== 'local') return null;

  return (
    <View
      pointerEvents="none"
      style={[styles.badge, { top: insets.top + spacing[1] }]}
      accessible
      accessibilityLabel={t.common.localBadgeLabel}
    >
      <AppText variant="caption" color="warning" style={styles.text}>
        {t.common.localBadge}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    right: spacing[2],
    paddingHorizontal: spacing[2],
    borderRadius: radii.pill,
    borderWidth: sizes.border,
    borderColor: colors.warning,
    backgroundColor: colors.warningTint,
  },
  text: {
    letterSpacing: 1,
  },
});
