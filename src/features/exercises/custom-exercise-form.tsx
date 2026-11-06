import { router } from 'expo-router';
import { ArrowLeft, Trash2 } from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  AppText,
  Button,
  Chip,
  ConfirmDialog,
  ErrorNotice,
  OptionCard,
  Screen,
  TextField,
} from '@/components';
import { classifyRequestError } from '@/core/errors';
import {
  canAddBodyweight,
  customExerciseInputOf,
  EMPTY_CUSTOM_EXERCISE,
  EQUIPMENT,
  EXERCISE_NAME_MAX_LENGTH,
  MUSCLE_GROUPS,
  validateCustomExercise,
  type CustomExerciseErrors,
  type CustomExerciseInput,
} from '@/core/exercises';
import { interpolate } from '@/core/i18n';
import { useDataContext } from '@/features/auth/auth-provider';
import { pickExercise } from '@/features/templates/draft-store';
import { useI18n } from '@/lib/i18n';
import { spacing } from '@/theme';

import { equipmentLabel, muscleGroupLabel } from './labels';
import { useDeleteExercise, useSaveCustomExercise, type SaveCustomExerciseInput } from './queries';
import type { ExerciseRow } from './repository';

export type CustomExerciseFormProps = {
  // The exercise to edit; a new one when missing.
  exercise?: ExerciseRow;
  // A new exercise starts with this name (what the athlete searched for).
  initialName?: string;
  // When opened from a multiple choice, the new exercise is ticked in it.
  pickSession?: string;
};

// Create or edit one of the athlete's own exercises. Each option says in one line what it changes.
export function CustomExerciseForm({
  exercise,
  initialName,
  pickSession,
}: CustomExerciseFormProps) {
  const { t } = useI18n();
  const ctx = useDataContext();
  const isNew = exercise === undefined;
  // A new exercise gets its id once, so "Try again" upserts the same row.
  const [id] = useState(() => exercise?.id ?? ctx.newId());
  const [input, setInput] = useState<CustomExerciseInput>(() =>
    exercise
      ? customExerciseInputOf(exercise)
      : { ...EMPTY_CUSTOM_EXERCISE, name: initialName?.slice(0, EXERCISE_NAME_MAX_LENGTH) ?? '' },
  );
  const [errors, setErrors] = useState<CustomExerciseErrors>({});
  const save = useSaveCustomExercise();
  const remove = useDeleteExercise();
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const deleteExercise = () =>
    remove.mutate(id, {
      onSuccess: () => {
        setConfirmingDelete(false);
        router.back();
      },
      // The dialog closes so the error (with "Try again") shows on the form.
      onError: () => setConfirmingDelete(false),
    });

  const change = (changes: Partial<CustomExerciseInput>) => {
    setInput((current) => ({ ...current, ...changes }));
    setErrors({});
  };

  const submit = (variables?: SaveCustomExerciseInput) => {
    let next = variables;
    if (!next) {
      const result = validateCustomExercise(input);
      if (!result.ok) {
        setErrors(result.error);
        return;
      }
      next = { id, isNew, values: result.value };
    }
    save.mutate(next, {
      onSuccess: () => {
        if (isNew && pickSession) pickExercise(pickSession, id);
        router.back();
      },
    });
  };

  const showBodyweight = canAddBodyweight(input);

  return (
    <Screen scroll>
      <View style={styles.content}>
        <View style={styles.top}>
          <Button
            label={t.common.back}
            variant="ghost"
            icon={ArrowLeft}
            onPress={() => router.back()}
          />
        </View>
        <AppText variant="title" accessibilityRole="header">
          {isNew ? t.exerciseForm.newTitle : t.exerciseForm.editTitle}
        </AppText>

        <TextField
          label={t.exerciseForm.name}
          value={input.name}
          onChangeText={(name) => change({ name })}
          maxLength={EXERCISE_NAME_MAX_LENGTH}
          error={errors.name ? t.exerciseForm.errors[errors.name] : undefined}
          autoCapitalize="sentences"
        />

        <ChoiceGroup
          label={t.exerciseForm.muscleGroup}
          hint={t.exerciseForm.muscleGroupHint}
          error={errors.muscleGroup ? t.exerciseForm.errors[errors.muscleGroup] : undefined}
        >
          {MUSCLE_GROUPS.map((group) => (
            <Chip
              key={group}
              label={muscleGroupLabel(t, group)}
              selected={input.muscleGroup === group}
              onPress={() => change({ muscleGroup: group })}
            />
          ))}
        </ChoiceGroup>

        <ChoiceGroup
          label={t.exerciseForm.equipment}
          error={errors.equipment ? t.exerciseForm.errors[errors.equipment] : undefined}
        >
          {EQUIPMENT.map((equipment) => (
            <Chip
              key={equipment}
              label={equipmentLabel(t, equipment)}
              selected={input.equipment === equipment}
              onPress={() => change({ equipment })}
            />
          ))}
        </ChoiceGroup>

        <View style={styles.group} accessibilityRole="radiogroup">
          <AppText variant="caption" color="textSoft">
            {t.exerciseForm.unit}
          </AppText>
          <OptionCard
            title={t.exercises.units.reps}
            description={t.exerciseForm.unitRepsHint}
            selected={input.unit === 'reps'}
            onPress={() => change({ unit: 'reps' })}
          />
          <OptionCard
            title={t.exercises.units.seconds}
            description={t.exerciseForm.unitSecondsHint}
            selected={input.unit === 'seconds'}
            onPress={() => change({ unit: 'seconds' })}
          />
        </View>

        <OptionCard
          multiple
          title={t.exerciseForm.tracksLoad}
          description={t.exerciseForm.tracksLoadHint}
          selected={input.tracksLoad}
          onPress={() => change({ tracksLoad: !input.tracksLoad })}
        />

        {showBodyweight && (
          <OptionCard
            multiple
            title={t.exerciseForm.addsBodyweight}
            description={t.exerciseForm.addsBodyweightHint}
            selected={input.addsBodyweight}
            onPress={() => change({ addsBodyweight: !input.addsBodyweight })}
          />
        )}

        {!isNew && (
          <AppText variant="caption" color="muted">
            {t.exerciseForm.changesRecords}
          </AppText>
        )}

        {save.error && (
          <ErrorNotice
            message={t.exerciseForm.errors[classifyRequestError(save.error)]}
            network={classifyRequestError(save.error) === 'network'}
            onRetry={() => submit(save.variables)}
            retryLabel={t.common.retry}
            retrying={save.isPending}
          />
        )}

        {remove.error && (
          <ErrorNotice
            message={t.exerciseForm.deleteErrors[classifyRequestError(remove.error)]}
            network={classifyRequestError(remove.error) === 'network'}
            onRetry={deleteExercise}
            retryLabel={t.common.retry}
            retrying={remove.isPending}
          />
        )}

        <Button label={t.common.save} fullWidth loading={save.isPending} onPress={() => submit()} />

        {!isNew && (
          <Button
            label={t.exerciseForm.delete}
            icon={Trash2}
            variant="danger"
            fullWidth
            onPress={() => setConfirmingDelete(true)}
          />
        )}

        <ConfirmDialog
          visible={confirmingDelete}
          tone="danger"
          title={interpolate(t.exerciseForm.deleteTitle, { name: exercise?.name_en ?? '' })}
          body={t.exerciseForm.deleteBody}
          confirmLabel={t.exerciseForm.deleteConfirm}
          cancelLabel={t.common.cancel}
          loading={remove.isPending}
          onConfirm={deleteExercise}
          onCancel={() => setConfirmingDelete(false)}
        />
      </View>
    </Screen>
  );
}

function ChoiceGroup({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <View style={styles.group}>
      <AppText variant="caption" color="textSoft">
        {label}
      </AppText>
      {hint !== undefined && (
        <AppText variant="caption" color="muted">
          {hint}
        </AppText>
      )}
      <View style={styles.chips} accessibilityRole="radiogroup" accessibilityLabel={label}>
        {children}
      </View>
      {error !== undefined && (
        <AppText
          variant="caption"
          color="danger"
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
        >
          {error}
        </AppText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing[5],
  },
  top: {
    alignItems: 'flex-start',
  },
  group: {
    gap: spacing[2],
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
  },
});
