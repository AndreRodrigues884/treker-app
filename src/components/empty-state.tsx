import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Icon, type LucideIcon } from '@/components/icon';
import { colors, radii, sizes, spacing, type AccentTone } from '@/theme';

export type EmptyStateProps = {
  icon: LucideIcon;
  title: string;
  body: string;
  tone?: AccentTone;
};

// What a screen shows before it has content: never a blank screen.
export function EmptyState({ icon, title, body, tone = 'gym' }: EmptyStateProps) {
  return (
    <View style={styles.container} accessible accessibilityLabel={`${title}. ${body}`}>
      <View style={styles.badge}>
        <Icon icon={icon} size="lg" color={tone} />
      </View>
      <AppText variant="heading" align="center">
        {title}
      </AppText>
      <AppText color="muted" align="center">
        {body}
      </AppText>
    </View>
  );
}

const BADGE_SIZE = sizes.minTouch + spacing[4];

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: spacing[2],
    paddingVertical: spacing[10],
    paddingHorizontal: spacing[6],
    borderRadius: radii.lg,
    borderWidth: sizes.border,
    borderColor: colors.divider,
    borderStyle: 'dashed',
  },
  badge: {
    width: BADGE_SIZE,
    height: BADGE_SIZE,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[2],
  },
});
