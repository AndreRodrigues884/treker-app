import { StyleSheet, View } from 'react-native';

import { colors, radii, sizes, type AccentTone } from '@/theme';

export type ProgressBarProps = {
  // Between 0 and 1; values outside are clamped.
  value: number;
  accessibilityLabel: string;
  tone?: AccentTone;
};

export function ProgressBar({ value, accessibilityLabel, tone = 'gym' }: ProgressBarProps) {
  const clamped = Math.min(Math.max(value, 0), 1);
  const percent = Math.round(clamped * 100);

  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: percent }}
      style={styles.track}
    >
      <View style={[styles.fill, { width: `${percent}%`, backgroundColor: colors[tone] }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: sizes.progressBar,
    borderRadius: radii.pill,
    backgroundColor: colors.line,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: radii.pill,
  },
});
