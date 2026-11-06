import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText, Badge, Button, Divider, PrBadge, TextField } from '@/components';
import { formatInputNumber, formatWeight } from '@/core/format';
import { interpolate, type Language } from '@/core/i18n';
import {
  DIFFICULTIES,
  setProblem,
  type Difficulty,
  type LastSet,
  type SessionExercise,
  type SessionSet,
  type SetValues,
} from '@/core/session';
import { fromKilograms, parseDecimal, parseSignedDecimal, type WeightUnit } from '@/core/units';
import { useI18n } from '@/lib/i18n';
import { accentTints, colors, opacity, radii, sizes, spacing } from '@/theme';

import { difficultyLabel, difficultyTone } from './difficulty';

export type SetPanelProps = {
  exercise: SessionExercise;
  set: SessionSet;
  index: number;
  unit: WeightUnit;
  last: LastSet | undefined;
  onCancel: () => void;
  onSave: (values: SetValues) => void;
};

/**
 * The open set: "last time" for it, the weight (in the athlete's unit) and reps or seconds on the
 * number pad, how hard it felt, and Cancel / OK. Nothing changes until "OK".
 */
export function SetPanel({ exercise, set, index, unit, last, onCancel, onSave }: SetPanelProps) {
  const { t, language } = useI18n();
  const isReps = exercise.unit === 'reps';
  // What the athlete typed, kept as text so "97," is not lost while typing.
  const [weightText, setWeightText] = useState(() => formatInputNumber(set.weight, language));
  const [countText, setCountText] = useState(() =>
    formatInputNumber(isReps ? set.reps : set.seconds, language),
  );
  const [difficulty, setDifficulty] = useState<Difficulty | null>(set.difficulty);
  const [showProblem, setShowProblem] = useState(false);

  const values = (): SetValues => {
    const weight =
      !exercise.tracksLoad || weightText.trim() === ''
        ? null
        : exercise.addsBodyweight
          ? parseSignedDecimal(weightText)
          : parseDecimal(weightText);
    const count = countText.trim() === '' ? null : parseDecimal(countText);
    return {
      weight,
      reps: isReps ? count : null,
      seconds: isReps ? null : count,
      difficulty,
    };
  };
  const problem = setProblem(exercise, values(), unit);

  const save = () => {
    if (problem) {
      setShowProblem(true);
      return;
    }
    onSave(values());
  };

  return (
    <View style={styles.panel}>
      <Divider />
      <View style={styles.header}>
        <AppText color="muted">{interpolate(t.session.setNumber, { number: index + 1 })}</AppText>
        <View style={styles.last}>
          {last && (
            <AppText variant="caption" color="gym">
              {interpolate(t.session.lastTime, {
                value: describeLast(last, exercise, unit, language),
              })}
            </AppText>
          )}
          {last?.difficulty && (
            <Badge
              label={difficultyLabel(t, last.difficulty)}
              tone={difficultyTone[last.difficulty]}
            />
          )}
          {set.pr && <PrBadge />}
        </View>
      </View>

      <View style={styles.inputs}>
        {exercise.tracksLoad && (
          <View style={styles.flex}>
            <TextField
              label={interpolate(t.session.weight, { unit })}
              kind="decimal"
              value={weightText}
              onChangeText={setWeightText}
              selectTextOnFocus
            />
          </View>
        )}
        <View style={styles.flex}>
          <TextField
            label={isReps ? t.session.repsDone : t.session.secondsDone}
            kind="integer"
            value={countText}
            onChangeText={setCountText}
            selectTextOnFocus
            error={showProblem && problem ? t.session.problems[problem] : undefined}
          />
        </View>
      </View>

      <View
        style={styles.difficulties}
        accessibilityRole="radiogroup"
        accessibilityLabel={t.session.difficultyLabel}
      >
        {DIFFICULTIES.map((option) => {
          const selected = difficulty === option;
          const tone = difficultyTone[option];
          return (
            <Pressable
              key={option}
              onPress={() => setDifficulty(selected ? null : option)}
              accessibilityRole="radio"
              accessibilityLabel={difficultyLabel(t, option)}
              accessibilityState={{ checked: selected }}
              style={({ pressed }) => [
                styles.difficulty,
                selected && {
                  borderColor: colors[tone],
                  backgroundColor: colors[accentTints[tone]],
                },
                pressed && styles.pressed,
              ]}
            >
              <AppText color={selected ? tone : 'textSoft'}>{difficultyLabel(t, option)}</AppText>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.actions}>
        <View style={styles.flex}>
          <Button label={t.common.cancel} variant="secondary" fullWidth onPress={onCancel} />
        </View>
        <View style={styles.flex}>
          <Button label={t.session.ok} fullWidth onPress={save} />
        </View>
      </View>
    </View>
  );
}

// "10 kg · 5 reps", "5 reps", "60 s".
function describeLast(
  last: LastSet,
  exercise: SessionExercise,
  unit: WeightUnit,
  language: Language,
): string {
  const weight =
    exercise.tracksLoad && last.weightKg !== null
      ? formatWeight(fromKilograms(last.weightKg, unit), unit, language)
      : null;
  const count =
    exercise.unit === 'reps' ? `${last.reps ?? '?'} reps` : `${last.durationS ?? '?'} s`;
  return [weight, count].filter(Boolean).join(' · ');
}

const styles = StyleSheet.create({
  panel: {
    gap: spacing[3],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[2],
  },
  last: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: spacing[2],
    flexShrink: 1,
  },
  inputs: {
    flexDirection: 'row',
    gap: spacing[3],
  },
  flex: {
    flex: 1,
  },
  difficulties: {
    flexDirection: 'row',
    gap: spacing[2],
  },
  difficulty: {
    flex: 1,
    minHeight: sizes.control,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.md,
    borderWidth: sizes.border,
    borderColor: colors.lineStrong,
    backgroundColor: colors.surface,
  },
  pressed: {
    opacity: opacity.pressed,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing[3],
  },
});
