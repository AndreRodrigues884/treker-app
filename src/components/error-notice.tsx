import { RefreshCw, WifiOff, CircleAlert } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { Icon } from '@/components/icon';
import { colors, radii, sizes, spacing } from '@/theme';

export type ErrorNoticeProps = {
  message: string;
  // Shows "Try again" when given; whatever the athlete typed stays in the form.
  onRetry?: () => void;
  retryLabel?: string;
  retrying?: boolean;
  // Network errors get the no-connection icon.
  network?: boolean;
};

// A failed request: what happened and a way to try again. Announced to screen readers.
export function ErrorNotice({
  message,
  onRetry,
  retryLabel,
  retrying = false,
  network = false,
}: ErrorNoticeProps) {
  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <Icon icon={network ? WifiOff : CircleAlert} color="danger" />
        <AppText
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
          color="text"
          style={styles.message}
        >
          {message}
        </AppText>
      </View>
      {onRetry && retryLabel !== undefined && (
        <Button
          label={retryLabel}
          variant="secondary"
          icon={RefreshCw}
          onPress={onRetry}
          loading={retrying}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing[3],
    padding: spacing[4],
    borderRadius: radii.lg,
    borderWidth: sizes.border,
    borderColor: colors.danger,
    backgroundColor: colors.dangerTint,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  message: {
    flex: 1,
  },
});
