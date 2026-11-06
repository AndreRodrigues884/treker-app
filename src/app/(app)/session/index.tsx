import { useKeepAwake } from 'expo-keep-awake';
import { router } from 'expo-router';
import { ArrowLeft, Dumbbell, Plus } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedRef } from 'react-native-reanimated';
import Sortable from 'react-native-sortables';

import { AppText, Button, ConfirmDialog, EmptyState, Screen } from '@/components';
import { exerciseName } from '@/core/exercises';
import { restRemainingS, type SessionExercise } from '@/core/session';
import { useDataContext } from '@/features/auth/auth-provider';
import { useExercises } from '@/features/exercises/queries';
import { SessionExerciseCard } from '@/features/session/exercise-card';
import { GYM_SESSION_PICK } from '@/features/session/pick';
import { useSessionActions } from '@/features/session/queries';
import { REST_SHEET_HEIGHT, RestTimer } from '@/features/session/rest-timer';
import {
  configureRestNotifications,
  getNotificationPermission,
  requestNotificationPermission,
} from '@/features/session/rest-notifications';
import { useActiveSession } from '@/features/session/session-store';
import { useI18n } from '@/lib/i18n';
import { readJson, storageKeys, writeJson } from '@/lib/storage';
import { useNow } from '@/lib/use-now';
import { spacing } from '@/theme';

/**
 * The gym session in progress: the workout's name with "Finish" (how long it takes is not
 * recorded), one card per exercise (drag its handle to change the order; tap a set to fill it in),
 * and, while resting, the rest timer in a sheet that slides up from the bottom. Everything is kept
 * on the phone
 * as it changes; nothing is sent until "Finish" → "Save". The screen stays on while it is open.
 */
export default function SessionScreen() {
  useKeepAwake();
  const { t, language } = useI18n();
  const ctx = useDataContext();
  const session = useActiveSession(ctx.userId);
  const actions = useSessionActions();
  const exercises = useExercises();
  const now = useNow();
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const [askPermission, setAskPermission] = useState(false);

  // The rest alert: a notification channel, and the permission asked once, with a reason.
  useEffect(() => {
    void configureRestNotifications(t.session.restChannel);
    void (async () => {
      const asked = await readJson(storageKeys.restNotificationsAsked);
      if (!asked && (await getNotificationPermission()) === 'undetermined') setAskPermission(true);
    })();
  }, [t.session.restChannel]);

  const byId = useMemo(
    () => new Map((exercises.data ?? []).map((exercise) => [exercise.id, exercise])),
    [exercises.data],
  );

  const answerPermission = async (allow: boolean) => {
    setAskPermission(false);
    await writeJson(storageKeys.restNotificationsAsked, true);
    if (allow) await requestNotificationPermission();
  };

  if (session === undefined) {
    return (
      <Screen>
        <AppText color="muted">{t.common.loading}</AppText>
      </Screen>
    );
  }
  if (session === null) {
    return (
      <Screen>
        <View style={styles.content}>
          <Button
            label={t.common.back}
            variant="ghost"
            icon={ArrowLeft}
            onPress={() => router.back()}
          />
          <EmptyState icon={Dumbbell} title={t.today.emptyTitle} body={t.today.emptyBody} />
        </View>
      </Screen>
    );
  }

  const title = session.templateName ?? t.session.emptyWorkout;
  const remaining = restRemainingS(session.rest, now);

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
    <Screen
      floating={
        remaining > 0 ? (
          <RestTimer
            remainingS={remaining}
            durationS={session.rest?.durationS ?? remaining}
            onLess={() => void actions.adjustRest(-15)}
            onMore={() => void actions.adjustRest(15)}
            onSkip={() => void actions.skipRest()}
          />
        ) : undefined
      }
    >
      <Animated.ScrollView
        ref={scrollRef}
        keyboardShouldPersistTaps="handled"
        style={styles.scroll}
        // While resting, room at the bottom for the rest sheet.
        contentContainerStyle={[
          styles.scrollContent,
          remaining > 0 && { paddingBottom: REST_SHEET_HEIGHT + spacing[4] },
        ]}
      >
        <View style={styles.content}>
          <View style={styles.header}>
            <Button
              label={t.common.back}
              variant="ghost"
              icon={ArrowLeft}
              onPress={() => router.back()}
            />
            <Button label={t.session.finish} onPress={() => router.push('/session/finish')} />
          </View>
          <AppText variant="title" accessibilityRole="header">
            {title}
          </AppText>

          {session.exercises.length === 0 && (
            <EmptyState icon={Dumbbell} title={t.session.emptyTitle} body={t.session.emptyBody} />
          )}

          {/* Drag a card by its handle to change the order. */}
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
              router.push({ pathname: '/exercises', params: { pick: GYM_SESSION_PICK } })
            }
          />
        </View>
      </Animated.ScrollView>

      <ConfirmDialog
        visible={askPermission}
        title={t.session.permissionTitle}
        body={t.session.permissionBody}
        confirmLabel={t.session.allow}
        cancelLabel={t.session.notNow}
        onConfirm={() => void answerPermission(true)}
        onCancel={() => void answerPermission(false)}
      />
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});
