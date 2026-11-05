import { WifiOff } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText, Icon } from '@/components';
import { useI18n } from '@/lib/i18n';
import { useIsOffline } from '@/lib/network';
import { colors, radii, spacing } from '@/theme';

// A discreet "No connection" pill at the top while the phone has no network. It floats over the
// screen (touches go through) and is announced once by screen readers.
export function OfflineBanner() {
  const { t } = useI18n();
  const offline = useIsOffline();
  const insets = useSafeAreaInsets();

  if (!offline) return null;

  return (
    <View pointerEvents="none" style={[styles.wrapper, { top: insets.top + spacing[1] }]}>
      <View
        style={styles.pill}
        accessible
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
        accessibilityLabel={t.common.offline}
      >
        <Icon icon={WifiOff} size="sm" color="onAccent" />
        <AppText variant="caption" color="onAccent">
          {t.common.offline}
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1],
    borderRadius: radii.pill,
    backgroundColor: colors.record,
  },
});
