import { useKeepAwake } from 'expo-keep-awake';
import { router } from 'expo-router';
import { ArrowLeft, Dumbbell, Plus } from 'lucide-react-native';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedRef } from 'react-native-reanimated';
import Sortable from 'react-native-sortables';

import { AppText, Button, EmptyState, Screen } from '@/components';
import { exerciseName } from '@/core/exercises';
import type { SessionExercise } from '@/core/session';
import { useDataContext } from '@/features/auth/auth-provider';
import { useExercises } from '@/features/exercises/queries';
import { SessionExerciseCard } from '@/features/session/exercise-card';
import { GYM_SESSION_PICK } from '@/features/session/pick';
import { useSessionActions } from '@/features/session/queries';
import { useActiveSession } from '@/features/session/session-store';
import { useI18n } from '@/lib/i18n';
import { colors, sizes, spacing } from '@/theme';

/**
 * The gym session in progress: the workout's name, one card per exercise (drag its handle to change
 * the order; tap a set to fill it in), and "Finish" across the bottom of the screen (how long it
 * takes is not recorded; there is no rest timer for now). Everything is kept on the phone as it
 * changes; nothing is sent until "Finish" → "Save". The screen stays on while it is open.
 */
export default function SessionScreen() {
  useKeepAwake();
  const { t, language } = useI18n();
  const ctx = useDataContext();
  const session = useActiveSession(ctx.userId);
  const actions = useSessionActions();
  const exercises = useExercises();
  const scrollRef = useAnimatedRef<Animated.ScrollView>();

  const byId = useMemo(
    () => new Map((exercises.data ?? []).map((exercise) => [exercise.id, exercise])),
    [exercises.data],
  );

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
        <View style={styles.footer}>
          <Button
            label={t.session.finish}
            fullWidth
            onPress={() => router.push('/session/finish')}
          />
        </View>
      }
    >
      <Animated.ScrollView
        ref={scrollRef}
        keyboardShouldPersistTaps="handled"
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.content}>
          <View style={styles.header}>
            <Button
              label={t.common.back}
              variant="ghost"
              icon={ArrowLeft}
              onPress={() => router.back()}
            />
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
    alignItems: 'flex-start',
  },
  // "Finish" across the bottom, above the safe area.
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    backgroundColor: colors.bg,
    borderTopWidth: sizes.border,
    borderTopColor: colors.line,
  },
});
