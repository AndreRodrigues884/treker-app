import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText, Button, Divider, Stepper } from '@/components';
import { interpolate } from '@/core/i18n';
import {
  DEFAULT_REPS,
  DEFAULT_SECONDS,
  minPlanSets,
  PLAN_REPS,
  PLAN_SECONDS,
  PLAN_SETS,
  planOf,
  type SessionExercise,
} from '@/core/session';
import { useI18n } from '@/lib/i18n';
import { spacing } from '@/theme';

export type PlanPanelProps = {
  exercise: SessionExercise;
  onCancel: () => void;
  onSave: (plan: { setCount: number; reps: number | null; seconds: number | null }) => void;
};

// The pencil: how many sets this exercise has in this workout, and the target reps (or seconds)
// per set. Never fewer sets than are already done.
export function PlanPanel({ exercise, onCancel, onSave }: PlanPanelProps) {
  const { t } = useI18n();
  const editor = t.templateEditor;
  const initial = planOf(exercise);
  const [setCount, setSetCount] = useState(initial.setCount);
  const [reps, setReps] = useState(initial.reps ?? DEFAULT_REPS);
  const [seconds, setSeconds] = useState(initial.seconds ?? DEFAULT_SECONDS);
  const isReps = exercise.unit === 'reps';

  return (
    <View style={styles.panel}>
      <Divider />
      <AppText variant="heading" accessibilityRole="header">
        {t.session.planTitle}
      </AppText>
      <View style={styles.row}>
        <View style={styles.field}>
          <AppText variant="caption" color="textSoft">
            {t.session.planSets}
          </AppText>
          <Stepper
            size="compact"
            value={setCount}
            min={minPlanSets(exercise)}
            max={PLAN_SETS.max}
            onChange={setSetCount}
            label={t.session.planSets}
            valueText={interpolate(t.session.planSetsValue, { count: setCount })}
            decreaseLabel={editor.fewerSets}
            increaseLabel={editor.moreSets}
          />
        </View>
        <View style={styles.field}>
          <AppText variant="caption" color="textSoft">
            {isReps ? t.session.planReps1 : t.session.planSeconds1}
          </AppText>
          {isReps ? (
            <Stepper
              size="compact"
              value={reps}
              min={PLAN_REPS.min}
              max={PLAN_REPS.max}
              onChange={setReps}
              label={t.session.planReps1}
              valueText={interpolate(editor.repsValue, { count: reps })}
              decreaseLabel={editor.fewerReps}
              increaseLabel={editor.moreReps}
            />
          ) : (
            <Stepper
              size="compact"
              step={PLAN_SECONDS.step}
              value={seconds}
              min={PLAN_SECONDS.min}
              max={PLAN_SECONDS.max}
              onChange={setSeconds}
              label={t.session.planSeconds1}
              valueText={interpolate(editor.secondsValue, { count: seconds })}
              decreaseLabel={editor.fewerSeconds}
              increaseLabel={editor.moreSeconds}
            />
          )}
        </View>
      </View>
      <View style={styles.row}>
        <View style={styles.flex}>
          <Button label={t.common.cancel} variant="secondary" fullWidth onPress={onCancel} />
        </View>
        <View style={styles.flex}>
          <Button
            label={t.session.ok}
            fullWidth
            onPress={() =>
              onSave({
                setCount: Math.max(PLAN_SETS.min, setCount),
                reps: isReps ? reps : null,
                seconds: isReps ? null : seconds,
              })
            }
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    gap: spacing[3],
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[3],
  },
  field: {
    flexGrow: 1,
    flexBasis: spacing[16] * 2,
    gap: spacing[1],
  },
  flex: {
    flex: 1,
  },
});
