import { Fragment } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText, Card, Divider } from '@/components';
import { formatWeight } from '@/core/format';
import { interpolate } from '@/core/i18n';
import type { OnboardingChoices } from '@/core/onboarding';
import { fromKilograms } from '@/core/units';
import {
  gymFocusLabels,
  poolLengthLabels,
  sportLabel,
  swimStyleLabels,
} from '@/features/onboarding/labels';
import { useI18n } from '@/lib/i18n';
import { spacing } from '@/theme';

// The onboarding answers as label/value rows: on the last onboarding step and on the home screen.
export function ChoicesSummary({ choices }: { choices: OnboardingChoices }) {
  const { t, language } = useI18n();
  const labels = t.onboarding.summary;

  const rows: { label: string; value: string }[] = [
    { label: labels.sports, value: choices.sports.map((sport) => sportLabel(t, sport)).join(', ') },
  ];
  if (choices.gymFocus) {
    rows.push({ label: labels.gymFocus, value: gymFocusLabels(t)[choices.gymFocus].title });
  }
  if (choices.swimStyle) {
    rows.push({ label: labels.swimStyle, value: swimStyleLabels(t)[choices.swimStyle].title });
  }
  if (choices.poolLength) {
    const pool = poolLengthLabels(t)[choices.poolLength];
    rows.push({ label: labels.pool, value: `${pool.title} · ${pool.hint}` });
  }
  rows.push(
    {
      label: labels.weeklyTarget,
      value: interpolate(t.onboarding.weeklyTarget.value, { count: choices.weeklyTarget }),
    },
    { label: labels.weightUnit, value: choices.weightUnit },
    {
      label: labels.bodyweight,
      value:
        choices.bodyweightKg === null
          ? labels.notSet
          : formatWeight(
              fromKilograms(choices.bodyweightKg, choices.weightUnit),
              choices.weightUnit,
              language,
            ),
    },
  );

  return (
    <Card>
      {rows.map((row, index) => (
        <Fragment key={row.label}>
          {index > 0 && <Divider />}
          <View style={styles.row} accessible accessibilityLabel={`${row.label}: ${row.value}`}>
            <AppText variant="caption" color="muted" style={styles.label}>
              {row.label}
            </AppText>
            <AppText style={styles.value}>{row.value}</AppText>
          </View>
        </Fragment>
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing[3],
  },
  label: {
    flex: 1,
  },
  value: {
    flex: 1,
    textAlign: 'right',
  },
});
