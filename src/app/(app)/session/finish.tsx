import { router } from 'expo-router';
import { ArrowLeft, Check, Trash2 } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  AppText,
  Button,
  Card,
  ConfirmDialog,
  ErrorNotice,
  PrBadge,
  Screen,
  TextField,
} from '@/components';
import { classifyRequestError } from '@/core/errors';
import { exerciseName } from '@/core/exercises';
import { formatWeight } from '@/core/format';
import { interpolate } from '@/core/i18n';
import {
  hasDoneSets,
  sessionSummary,
  setOneRepMaxKg,
  toSavePayload,
  type GymSession,
} from '@/core/session';
import { fromKilograms } from '@/core/units';
import type { PersonalRecordRow } from '@/features/activities/repository';
import { useAuth, useDataContext } from '@/features/auth/auth-provider';
import type { ExerciseRow } from '@/features/exercises/repository';
import { useExercises } from '@/features/exercises/queries';
import { useSaveGymSession, useSessionActions } from '@/features/session/queries';
import { getActiveSession, useActiveSession } from '@/features/session/session-store';
import { useI18n } from '@/lib/i18n';
import { spacing } from '@/theme';

/**
 * Finishing the workout: its sets, volume, exercises and records (its duration is not recorded), a
 * title (the saved workout's name by default, kept in the draft as it is typed). "Save" sends it
 * in one request; only then
 * is the draft deleted and the official records shown. If it fails, the draft stays for
 * "Try again".
 */
export default function FinishScreen() {
  const { t } = useI18n();
  const ctx = useDataContext();
  const session = useActiveSession(ctx.userId);
  const save = useSaveGymSession();
  const exercises = useExercises();
  const byId = useMemo(
    () => new Map((exercises.data ?? []).map((exercise) => [exercise.id, exercise])),
    [exercises.data],
  );

  // Saved: the draft is gone; show what the server recorded.
  if (save.isSuccess) {
    return <Saved records={save.data} byId={byId} />;
  }
  if (!session) {
    return (
      <Screen>
        <AppText color="muted">{t.common.loading}</AppText>
      </Screen>
    );
  }
  return <FinishForm session={session} save={save} byId={byId} />;
}

function FinishForm({
  session,
  save,
  byId,
}: {
  session: GymSession;
  save: ReturnType<typeof useSaveGymSession>;
  byId: Map<string, ExerciseRow>;
}) {
  const { t, language } = useI18n();
  const ctx = useDataContext();
  const actions = useSessionActions();
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const summary = sessionSummary(session);
  const canSave = hasDoneSets(session);
  const unit = session.weightUnit;

  const nameOf = (id: string) => {
    const row = byId.get(id);
    return row ? exerciseName(row, language) : t.templateEditor.unknownExercise;
  };

  const onSave = async () => {
    // The end time is fixed at the first attempt, so "Try again" sends the same request.
    // Built from the draft alone, so "Try again" sends the very same request.
    const current = getActiveSession(ctx.userId);
    if (!current) return;
    save.mutate(toSavePayload(current));
  };

  const livePrs = session.exercises.flatMap((exercise) =>
    exercise.sets
      .filter((set) => set.done && set.pr)
      .map((set) => ({ exercise, set, kg: setOneRepMaxKg(session, exercise, set) })),
  );

  return (
    <Screen scroll>
      <View style={styles.content}>
        <View style={styles.top}>
          <Button
            label={t.session.backToWorkout}
            variant="ghost"
            icon={ArrowLeft}
            onPress={() => router.back()}
          />
        </View>
        <AppText variant="title" accessibilityRole="header">
          {t.session.finishTitle}
        </AppText>

        <Card>
          <View style={styles.stats}>
            <Stat label={t.workout.sets} value={String(summary.setCount)} />
            <Stat
              label={t.workout.volume}
              value={formatWeight(fromKilograms(summary.volumeKg, unit), unit, language)}
            />
            <Stat label={t.session.exercises} value={String(summary.exerciseCount)} />
          </View>
        </Card>

        {livePrs.length > 0 && (
          <View style={styles.section}>
            <AppText variant="heading" accessibilityRole="header">
              {t.session.liveRecords}
            </AppText>
            {livePrs.map(({ exercise, set, kg }) => (
              <RecordLine
                key={set.id}
                name={nameOf(exercise.id)}
                value={
                  kg === null
                    ? ''
                    : interpolate(t.workout.oneRepMax, {
                        value: formatWeight(fromKilograms(kg, unit), unit, language),
                      })
                }
              />
            ))}
          </View>
        )}

        {!canSave && (
          <AppText color="danger" accessibilityRole="alert">
            {t.session.noDoneSets}
          </AppText>
        )}

        <TextField
          label={t.session.title}
          placeholder={t.session.titlePlaceholder}
          value={session.title}
          onChangeText={(text) => void actions.setTitle(text)}
          maxLength={100}
        />

        {save.error && (
          <ErrorNotice
            message={t.session.errors[classifyRequestError(save.error)]}
            network={classifyRequestError(save.error) === 'network'}
            onRetry={() => void onSave()}
            retryLabel={t.common.retry}
            retrying={save.isPending}
          />
        )}

        <Button
          label={t.session.save}
          icon={Check}
          fullWidth
          disabled={!canSave}
          loading={save.isPending}
          onPress={() => void onSave()}
        />
        <Button
          label={t.session.discardWorkout}
          icon={Trash2}
          variant="danger"
          fullWidth
          onPress={() => setConfirmDiscard(true)}
        />
      </View>

      <ConfirmDialog
        visible={confirmDiscard}
        tone="danger"
        title={t.session.discardTitle}
        body={t.session.discardBody}
        confirmLabel={t.session.discardWorkout}
        cancelLabel={t.common.cancel}
        onCancel={() => setConfirmDiscard(false)}
        onConfirm={async () => {
          setConfirmDiscard(false);
          await actions.discard();
          router.dismissAll();
          router.navigate('/');
        }}
      />
    </Screen>
  );
}

// After saving: the official records the server computed, then back to Today.
function Saved({
  records,
  byId,
}: {
  records: PersonalRecordRow[];
  byId: Map<string, ExerciseRow>;
}) {
  const { t, language } = useI18n();
  const { profile } = useAuth();
  const unit = profile?.weight_unit ?? 'kg';
  return (
    <Screen scroll>
      <View style={styles.content}>
        <AppText variant="title" accessibilityRole="header">
          {t.session.savedTitle}
        </AppText>
        <View style={styles.section}>
          <AppText variant="heading" accessibilityRole="header">
            {t.session.officialRecords}
          </AppText>
          {records.length === 0 ? (
            <AppText color="muted">{t.session.noNewRecords}</AppText>
          ) : (
            records.map((record) => {
              const row = record.exercise_id ? byId.get(record.exercise_id) : undefined;
              return (
                <RecordLine
                  key={record.id}
                  name={row ? exerciseName(row, language) : t.templateEditor.unknownExercise}
                  value={interpolate(t.workout.oneRepMax, {
                    value: formatWeight(fromKilograms(record.value, unit), unit, language),
                  })}
                />
              );
            })
          )}
        </View>
        <Button
          label={t.session.close}
          fullWidth
          onPress={() => {
            router.dismissAll();
            router.navigate('/');
          }}
        />
      </View>
    </Screen>
  );
}

function RecordLine({ name, value }: { name: string; value: string }) {
  const { t } = useI18n();
  return (
    <View
      style={styles.record}
      accessible
      accessibilityLabel={`${t.records.prLabel}: ${name}, ${value}`}
    >
      <PrBadge />
      <AppText style={styles.flex}>{name}</AppText>
      <AppText variant="numeric">{value}</AppText>
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat} accessible accessibilityLabel={`${label}: ${value}`}>
      <AppText variant="caption" color="muted">
        {label}
      </AppText>
      <AppText variant="numeric">{value}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing[4],
  },
  top: {
    alignItems: 'flex-start',
  },
  stats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[6],
  },
  stat: {
    gap: spacing[1],
  },
  section: {
    gap: spacing[2],
  },
  record: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    minHeight: spacing[10],
  },
  flex: {
    flex: 1,
  },
});
