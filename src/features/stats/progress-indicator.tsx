import {
  ArrowDown,
  ArrowUp,
  Equal,
  Sparkles,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { AppText, Card, Icon } from '@/components';
import type { ProgressMeasure, ProgressResult, ProgressSummary as Summary } from '@/core/progress';
import { useI18n } from '@/lib/i18n';
import { spacing } from '@/theme';

import {
  progressLabel,
  progressSummaryText,
  progressValueText,
  resultColor,
  type ProgressUnits,
} from './labels';

export const resultIcon: Record<ProgressResult, LucideIcon> = {
  up: ArrowUp,
  same: Equal,
  down: ArrowDown,
  first: Sparkles,
};

export type ProgressIndicatorProps = {
  // The exercise's name, for the screen reader.
  name: string;
  progress: {
    measure: ProgressMeasure;
    current: number;
    previous: number | null;
    result: ProgressResult;
  };
  units: ProgressUnits;
};

/**
 * One exercise against the last time: an arrow (↑, = or ↓) with the previous value and today's,
 * in green, grey or red. The arrow and the words carry the meaning, never the colour alone, and it
 * sits beside the exercise, never on the set squares (which use colour for the difficulty).
 */
export function ProgressIndicator({ name, progress, units }: ProgressIndicatorProps) {
  const { t } = useI18n();
  const color = resultColor[progress.result];
  const value = (amount: number) => progressValueText(t, progress.measure, amount, units);
  const values =
    progress.previous === null
      ? value(progress.current)
      : progress.result === 'same'
        ? value(progress.current)
        : `${value(progress.previous)} → ${value(progress.current)}`;

  return (
    <View
      style={styles.row}
      accessible
      accessibilityLabel={progressLabel(t, name, progress, units)}
    >
      <Icon icon={resultIcon[progress.result]} size="sm" color={color} />
      <AppText variant="caption" color={color}>
        {t.progress.results[progress.result]}
      </AppText>
      <AppText variant="caption" color="muted">
        {t.progress.measures[progress.measure]}
      </AppText>
      <AppText variant="numeric" color={color} style={styles.values}>
        {values}
      </AppText>
    </View>
  );
}

/** "4 of 6 exercises progressed", with how they are compared. */
export function ProgressSummaryCard({ summary, hint }: { summary: Summary; hint: string }) {
  const { t } = useI18n();
  const text = progressSummaryText(t, summary);
  return (
    <Card>
      <View style={styles.summary} accessible accessibilityLabel={text ?? t.progress.allFirst}>
        <View style={styles.title}>
          <Icon icon={TrendingUp} color={summary.up > 0 ? 'positive' : 'muted'} />
          <AppText variant="heading" accessibilityRole="header">
            {text ?? t.progress.title}
          </AppText>
        </View>
        <AppText color="muted">{text ? hint : t.progress.allFirst}</AppText>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    columnGap: spacing[2],
    rowGap: spacing[1],
  },
  values: {
    flexShrink: 1,
  },
  summary: {
    gap: spacing[1],
  },
  title: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
});
