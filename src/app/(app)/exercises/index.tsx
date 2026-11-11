import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Plus } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { AppText, Button, Screen } from '@/components';
import { addExercises } from '@/core/templates';
import { interpolate } from '@/core/i18n';
import { useDataContext } from '@/features/auth/auth-provider';
import { ExerciseLibrary } from '@/features/exercises/exercise-library';
import { useExercises } from '@/features/exercises/queries';
import { addExercisesToEdit } from '@/features/session/edit-store';
import { editedActivity, GYM_SESSION_PICK } from '@/features/session/pick';
import { useSessionActions } from '@/features/session/queries';
import {
  clearPickedExercises,
  setTemplateDraft,
  togglePickedExercise,
  usePickedExercises,
} from '@/features/templates/draft-store';
import { useI18n } from '@/lib/i18n';
import { colors, sizes, spacing } from '@/theme';

// The exercise library. Without params it is for consulting (each exercise opens its progress
// screen, where own exercises can be edited).
// ?pick=gym-session adds the ticked exercises to the workout in progress instead.
// Both modes have "New exercise"; in a multiple choice the new exercise comes back ticked.
// With ?pick=<template id> it is a multiple choice: the ticked exercises are added, in the order
// they were ticked, to the template being edited.
export default function ExercisesScreen() {
  const { pick } = useLocalSearchParams<{ pick?: string }>();
  return pick ? <PickExercises session={pick} /> : <BrowseExercises />;
}

function BrowseExercises() {
  const { t } = useI18n();
  return (
    <Screen scroll>
      <View style={styles.content}>
        <Header title={t.exercises.title} />
        <Button
          label={t.exercises.create}
          icon={Plus}
          variant="secondary"
          onPress={() => router.push('/exercises/new')}
        />
        <ExerciseLibrary
          mode="browse"
          onOpen={(exercise) =>
            router.push({ pathname: '/exercise/[id]', params: { id: exercise.id } })
          }
          onCreate={(name) => router.push({ pathname: '/exercises/new', params: { name } })}
        />
      </View>
    </Screen>
  );
}

function PickExercises({ session }: { session: string }) {
  const { t } = useI18n();
  const ctx = useDataContext();
  const picked = usePickedExercises(session);
  const exercises = useExercises();
  const sessionActions = useSessionActions();

  const add = async () => {
    const byId = new Map((exercises.data ?? []).map((exercise) => [exercise.id, exercise]));
    const rows = picked.flatMap((id) => {
      const exercise = byId.get(id);
      return exercise ? [exercise] : [];
    });
    const edited = editedActivity(session);
    if (session === GYM_SESSION_PICK) {
      // Into the workout in progress, each with "last time".
      await sessionActions.addExercises(rows);
    } else if (edited) {
      // Into a saved workout being edited.
      addExercisesToEdit(edited, rows, ctx.newId);
    } else {
      const chosen = rows.map((exercise) => ({ id: exercise.id, unit: exercise.unit }));
      setTemplateDraft(session, (draft) => addExercises(draft, chosen, ctx.newId));
    }
    clearPickedExercises(session);
    router.back();
  };

  const cancel = () => {
    clearPickedExercises(session);
    router.back();
  };

  return (
    <Screen
      scroll
      floating={
        <View style={styles.footer}>
          <AppText variant="caption" color="muted" accessibilityLiveRegion="polite">
            {interpolate(t.exercises.selected, { count: picked.length })}
          </AppText>
          <Button
            label={interpolate(t.exercises.add, { count: picked.length })}
            disabled={picked.length === 0}
            onPress={() => void add()}
          />
        </View>
      }
    >
      <View style={styles.content}>
        <Header title={t.exercises.pickTitle} onBack={cancel} />
        {/* Creating one here comes back ticked, so the workout being edited is never left. */}
        <Button
          label={t.exercises.create}
          icon={Plus}
          variant="secondary"
          onPress={() => router.push({ pathname: '/exercises/new', params: { pick: session } })}
        />
        <ExerciseLibrary
          mode="pick"
          picked={picked}
          onToggle={(exercise) => togglePickedExercise(session, exercise.id)}
          onCreate={(name) =>
            router.push({ pathname: '/exercises/new', params: { name, pick: session } })
          }
        />
      </View>
    </Screen>
  );
}

function Header({ title, onBack = () => router.back() }: { title: string; onBack?: () => void }) {
  const { t } = useI18n();
  return (
    <>
      <View style={styles.top}>
        <Button label={t.common.back} variant="ghost" icon={ArrowLeft} onPress={onBack} />
      </View>
      <AppText variant="title" accessibilityRole="header">
        {title}
      </AppText>
    </>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing[4],
  },
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
