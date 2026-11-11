import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Check, Plus } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedRef } from 'react-native-reanimated';
import Sortable from 'react-native-sortables';

import { AppText, Button, ErrorNotice, Screen, TextField } from '@/components';
import { instantOf, isLocalDate, parseTimeOfDay, timeOfDayIn } from '@/core/dates';
import { classifyRequestError } from '@/core/errors';
import { exerciseName } from '@/core/exercises';
import {
  hasDoneSets,
  sessionFromWorkout,
  toUpdatePayload,
  type GymSession,
  type SessionExercise,
} from '@/core/session';
import { useActivity } from '@/features/activities/queries';
import { useAuth, useDataContext } from '@/features/auth/auth-provider';
import { useExercises } from '@/features/exercises/queries';
import { discardEditSession, getEditSession, useEditSession } from '@/features/session/edit-store';
import { SessionExerciseCard } from '@/features/session/exercise-card';
import { exerciseInfo } from '@/features/session/exercise-info';
import { editPick } from '@/features/session/pick';
import { startEditing, useEditActions, useUpdateGymSession } from '@/features/session/queries';
import { useI18n } from '@/lib/i18n';
import { spacing } from '@/theme';

/**
 * Editing a saved gym workout, with the session's cards (sets, plan, exercises, order) but no rest
 * timer, plus its title, date and start time. "Save changes" replaces the workout in one request
 * (update_gym_session) and goes back to where the workout was opened; leaving without saving
 * discards the changes.
 */
export default function EditWorkoutScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useI18n();
  const ctx = useDataContext();
  const { profile } = useAuth();
  const workout = useActivity(id);
  const exercises = useExercises();
  const session = useEditSession(id);

  // Loads the saved workout once (going to the library and back keeps the changes).
  useEffect(() => {
    if (getEditSession(id) || !workout.data || !exercises.data) return;
    startEditing(
      sessionFromWorkout({
        activity: workout.data.activity,
        sets: workout.data.gymSets,
        exercises: Object.fromEntries(exercises.data.map((row) => [row.id, exerciseInfo(row)])),
        weightUnit: profile?.weight_unit ?? 'kg',
        bodyweightKg: workout.data.activity.bodyweight_kg,
        newId: ctx.newId,
      }),
    );
  }, [id, workout.data, exercises.data, profile?.weight_unit, ctx.newId]);

  // Leaving the screen discards what was not saved.
  useEffect(() => () => discardEditSession(id), [id]);

  if (!session || !workout.data) {
    const failure = workout.error ?? exercises.error;
    return (
      <Screen>
        <View style={styles.content}>
          <Button
            label={t.common.back}
            variant="ghost"
            icon={ArrowLeft}
            onPress={() => router.back()}
          />
          {failure ? (
            <ErrorNotice
              message={t.common.errors[classifyRequestError(failure)]}
              network={classifyRequestError(failure) === 'network'}
              onRetry={() => {
                void workout.refetch();
                void exercises.refetch();
              }}
              retryLabel={t.common.retry}
              retrying={workout.isFetching || exercises.isFetching}
            />
          ) : (
            <AppText color="muted">
              {workout.isSuccess && workout.data === null ? t.workout.notFound : t.common.loading}
            </AppText>
          )}
        </View>
      </Screen>
    );
  }

  return (
    <Editor
      session={session}
      previousExerciseIds={[...new Set(workout.data.gymSets.map((set) => set.exercise_id))]}
    />
  );
}

function Editor({
  session,
  previousExerciseIds,
}: {
  session: GymSession;
  previousExerciseIds: string[];
}) {
  const { t, language } = useI18n();
  const actions = useEditActions(session.id);
  const update = useUpdateGymSession(previousExerciseIds);
  const exercises = useExercises();
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const [dateText, setDateText] = useState(session.localDate);
  const [timeText, setTimeText] = useState(() =>
    timeOfDayIn(new Date(session.startedAt), session.timezone),
  );
  const [showErrors, setShowErrors] = useState(false);
  const byId = useMemo(
    () => new Map((exercises.data ?? []).map((exercise) => [exercise.id, exercise])),
    [exercises.data],
  );

  const dateValid = isLocalDate(dateText.trim());
  const minutes = parseTimeOfDay(timeText);
  const canSave = hasDoneSets(session);

  // The date and time typed, kept in the edit as soon as both are valid.
  const changeWhen = (date: string, time: string) => {
    const day = date.trim();
    const at = parseTimeOfDay(time);
    if (isLocalDate(day) && at !== null) {
      void actions.setWhen({
        localDate: day,
        startedAt: instantOf(day, at, session.timezone).toISOString(),
      });
    }
  };

  const save = () => {
    if (!dateValid || minutes === null) {
      setShowErrors(true);
      return;
    }
    // Saved: this screen and the workout's detail close, back to where the workout was opened
    // (the Profile, a record, an exercise), which shows the updated data.
    update.mutate(toUpdatePayload(session), { onSuccess: () => router.dismiss(2) });
  };

  const renderExercise = ({ item, index }: { item: SessionExercise; index: number }) => {
    const row = byId.get(item.id);
    return (
      <SessionExerciseCard
        session={session}
        exercise={item}
        index={index}
        name={row ? exerciseName(row, language) : t.templateEditor.unknownExercise}
        actions={actions}
      />
    );
  };

  return (
    <Screen>
      <Animated.ScrollView
        ref={scrollRef}
        keyboardShouldPersistTaps="handled"
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
      >
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
            {t.editWorkout.title}
          </AppText>

          <TextField
            label={t.editWorkout.name}
            placeholder={t.session.titlePlaceholder}
            value={session.title}
            onChangeText={(title) => void actions.setTitle(title)}
            maxLength={100}
          />
          <View style={styles.when}>
            <View style={styles.flex}>
              <TextField
                label={t.editWorkout.date}
                value={dateText}
                onChangeText={(text) => {
                  setDateText(text);
                  changeWhen(text, timeText);
                }}
                autoCorrect={false}
                error={showErrors && !dateValid ? t.editWorkout.invalidDate : undefined}
              />
            </View>
            <View style={styles.flex}>
              <TextField
                label={t.editWorkout.time}
                value={timeText}
                onChangeText={(text) => {
                  setTimeText(text);
                  changeWhen(dateText, text);
                }}
                autoCorrect={false}
                error={showErrors && minutes === null ? t.editWorkout.invalidTime : undefined}
              />
            </View>
          </View>

          <Sortable.Grid
            columns={1}
            rowGap={spacing[3]}
            data={session.exercises}
            keyExtractor={(item) => item.key}
            renderItem={renderExercise}
            customHandle
            scrollableRef={scrollRef}
            onDragEnd={({ data }) => void actions.reorderExercises(data.map((item) => item.key))}
          />

          <Button
            label={t.session.addExercise}
            icon={Plus}
            variant="secondary"
            fullWidth
            onPress={() =>
              router.push({ pathname: '/exercises', params: { pick: editPick(session.id) } })
            }
          />

          {!canSave && (
            <AppText color="danger" accessibilityRole="alert">
              {t.editWorkout.noSets}
            </AppText>
          )}
          {update.error && (
            <ErrorNotice
              message={t.editWorkout.errors[classifyRequestError(update.error)]}
              network={classifyRequestError(update.error) === 'network'}
              onRetry={save}
              retryLabel={t.common.retry}
              retrying={update.isPending}
            />
          )}
          <Button
            label={t.editWorkout.save}
            icon={Check}
            fullWidth
            disabled={!canSave}
            loading={update.isPending}
            onPress={save}
          />
        </View>
      </Animated.ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: spacing[8],
  },
  content: {
    gap: spacing[4],
  },
  top: {
    alignItems: 'flex-start',
  },
  when: {
    flexDirection: 'row',
    gap: spacing[3],
  },
  flex: {
    flex: 1,
  },
});
