import { ChevronRight, ExternalLink } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Icon, type LucideIcon } from '@/components/icon';
import { colors, opacity, sizes, spacing } from '@/theme';

export type ListRowProps = {
  label: string;
  value?: string;
  onPress: () => void;
  icon?: LucideIcon;
  // link: opens outside the app (shows an external icon). danger: destructive actions.
  kind?: 'navigate' | 'link' | 'danger';
};

// A tappable settings row: label on the left, current value and a chevron on the right.
export function ListRow({ label, value, onPress, icon, kind = 'navigate' }: ListRowProps) {
  const danger = kind === 'danger';
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={kind === 'link' ? 'link' : 'button'}
      accessibilityLabel={value ? `${label}, ${value}` : label}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      {icon && <Icon icon={icon} color={danger ? 'danger' : 'textSoft'} />}
      <AppText color={danger ? 'danger' : 'text'} style={styles.label}>
        {label}
      </AppText>
      {value !== undefined && (
        <AppText color="muted" numberOfLines={1} style={styles.value}>
          {value}
        </AppText>
      )}
      <View>
        <Icon
          icon={kind === 'link' ? ExternalLink : ChevronRight}
          size="sm"
          color={danger ? 'danger' : 'dim'}
        />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: sizes.control,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingVertical: spacing[3],
    borderBottomWidth: sizes.border,
    borderBottomColor: colors.divider,
  },
  pressed: {
    opacity: opacity.pressed,
  },
  label: {
    flexShrink: 0,
  },
  value: {
    flex: 1,
    textAlign: 'right',
  },
});
