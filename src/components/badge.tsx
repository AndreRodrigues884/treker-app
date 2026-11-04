import { Trophy } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Icon, type LucideIcon } from '@/components/icon';
import { useI18n } from '@/lib/i18n';
import { accentTints, colors, radii, sizes, spacing, type AccentTone } from '@/theme';

export type BadgeTone = AccentTone | 'neutral';

export type BadgeProps = {
  label: string;
  tone?: BadgeTone;
  // solid: filled with the accent; soft: tinted background with accent text.
  emphasis?: 'soft' | 'solid';
  icon?: LucideIcon;
  accessibilityLabel?: string;
};

export function Badge({
  label,
  tone = 'neutral',
  emphasis = 'soft',
  icon,
  accessibilityLabel,
}: BadgeProps) {
  const solid = emphasis === 'solid' && tone !== 'neutral';
  const textColor = solid ? 'onAccent' : tone === 'neutral' ? 'textSoft' : tone;
  const backgroundColor =
    tone === 'neutral' ? colors.surface : solid ? colors[tone] : colors[accentTints[tone]];

  return (
    <View
      accessible
      accessibilityRole="text"
      accessibilityLabel={accessibilityLabel ?? label}
      style={[styles.badge, { backgroundColor }, tone === 'neutral' && styles.neutral]}
    >
      {icon && <Icon icon={icon} size="sm" color={textColor} />}
      <AppText variant="caption" color={textColor}>
        {label}
      </AppText>
    </View>
  );
}

// The personal record seal used next to sets and times that beat the previous best.
export function PrBadge() {
  const { t } = useI18n();
  return (
    <Badge
      label={t.records.prShort}
      accessibilityLabel={t.records.prLabel}
      tone="record"
      emphasis="solid"
      icon={Trophy}
    />
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing[1],
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
    borderRadius: radii.pill,
  },
  neutral: {
    borderWidth: sizes.border,
    borderColor: colors.line,
  },
});
