import { router } from 'expo-router';
import { ArrowLeft, Check } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText, Button, Screen } from '@/components';
import { interpolate } from '@/core/i18n';
import { defaultStrengthExercises, toggleStrengthExercise } from '@/core/progress';
import { useDataContext } from '@/features/auth/auth-provider';
import { ExerciseLibrary } from '@/features/exercises/exercise-library';
import { useExerciseUsage } from '@/features/stats/queries';
import { setStrengthChoice, useStrengthChoice } from '@/features/stats/strength-choice';
import { useI18n } from '@/lib/i18n';
import { colors, sizes, spacing } from '@/theme';

/**
 * Choosing the exercises of the strength chart (Statistics), with the library's search and
 * filters: up to 5, starting from the current choice (or the exercises done most). Each tick is kept
 * on the phone at once; a sixth is refused with a message.
 */
export default function StrengthExercisesScreen() {
  const { t } = useI18n();
  const ctx = useDataContext();
  const stored = useStrengthChoice(ctx.userId);
  const usage = useExerciseUsage();
  const [limited, setLimited] = useState(false);
  const picked =
    stored.choice ??
    defaultStrengthExercises(
      (usage.data ?? []).map((row) => ({
        exerciseId: row.exerciseId,
        setCount: row.setCount,
        lastLocalDate: row.lastLocalDate,
        hasOneRepMax: row.bestOneRepMaxKg !== null,
      })),
    );

  return (
    <Screen
      floating={
        <View style={styles.footer}>
          <AppText variant="caption" color="muted" accessibilityLiveRegion="polite">
            {interpolate(t.strengthPicker.count, { count: picked.length })}
          </AppText>
          <Button label={t.strengthPicker.done} icon={Check} onPress={() => router.back()} />
        </View>
      }
    >
      <ExerciseLibrary
        mode="pick"
        header={
          <>
            <View style={styles.top}>
              <Button
                label={t.common.back}
                variant="ghost"
                icon={ArrowLeft}
                onPress={() => router.back()}
              />
            </View>
            <AppText variant="title" accessibilityRole="header">
              {t.strengthPicker.title}
            </AppText>
            <AppText color="muted">{t.strengthPicker.hint}</AppText>
            {limited && (
              <AppText color="danger" accessibilityRole="alert">
                {t.strengthPicker.limit}
              </AppText>
            )}
          </>
        }
        picked={picked}
        onToggle={(exercise) => {
          const next = toggleStrengthExercise(picked, exercise.id);
          setLimited(next.limited);
          if (!next.limited) void setStrengthChoice(ctx.userId, next.selected);
        }}
        onCreate={(name) => router.push({ pathname: '/exercises/new', params: { name } })}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: {
    alignItems: 'flex-start',
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[3],
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    minHeight: sizes.fab + spacing[6],
    backgroundColor: colors.surface,
    borderTopWidth: sizes.border,
    borderTopColor: colors.line,
  },
});
