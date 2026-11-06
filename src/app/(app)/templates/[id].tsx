import { router, useLocalSearchParams, usePreventRemove } from 'expo-router';
import { ArrowLeft, Plus } from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedRef } from 'react-native-reanimated';
import Sortable from 'react-native-sortables';

import { AppText, Button, ErrorNotice, Screen, TextField } from '@/components';
import { classifyRequestError } from '@/core/errors';
import { exerciseName } from '@/core/exercises';
import {
  draftOf,
  emptyTemplate,
  moveItemBy,
  removeItem,
  TEMPLATE_NAME_MAX_LENGTH,
  updateItem,
  validateTemplate,
  type TemplateDraft,
  type TemplateError,
  type TemplateItem,
} from '@/core/templates';
import { equipmentLabel } from '@/features/exercises/labels';
import { useExercises } from '@/features/exercises/queries';
import {
  discardTemplateDraft,
  getTemplateDraft,
  setTemplateDraft,
  startTemplateDraft,
  useTemplateDraft,
  useTemplateHasChanges,
} from '@/features/templates/draft-store';
import { useSaveTemplate, useTemplate } from '@/features/templates/queries';
import { TemplateItemCard } from '@/features/templates/template-item-card';
import { useI18n } from '@/lib/i18n';
import { sizes, spacing } from '@/theme';

/**
 * Create (?new=1) or edit a saved workout: its name, its exercises in order (drag the handle, or
 * use the up/down buttons) and the target sets and reps or seconds of each. The draft lives in the
 * draft store while the screen is open, so picking exercises or a failed save loses nothing.
 * Saving sends the template and its whole list in one request. Leaving with unsaved changes (the
 * back button, the back gesture or Android's back) asks first; without changes it just leaves.
 */
export default function TemplateEditorScreen() {
  const { id, new: isNewParam } = useLocalSearchParams<{ id: string; new?: string }>();
  const isNew = isNewParam === '1';
  const { t } = useI18n();
  const exercises = useExercises();
  const stored = useTemplate(id, { enabled: !isNew });
  const draft = useTemplateDraft(id);

  // Starts the draft once: empty for a new template, from the server for an existing one.
  useEffect(() => {
    if (getTemplateDraft(id)) return;
    if (isNew) {
      startTemplateDraft(id, emptyTemplate(id));
    } else if (stored.data && exercises.data) {
      const units = new Map(exercises.data.map((exercise) => [exercise.id, exercise.unit]));
      startTemplateDraft(
        id,
        draftOf(
          stored.data.template,
          stored.data.exercises,
          (exerciseId) => units.get(exerciseId) ?? 'reps',
        ),
      );
    }
  }, [id, isNew, stored.data, exercises.data]);

  // Leaving the editor discards what was not saved.
  useEffect(() => () => discardTemplateDraft(id), [id]);

  if (!draft) {
    const failure = stored.error ?? exercises.error;
    const missing = !isNew && stored.isSuccess && stored.data === null;
    return (
      <Screen>
        <View style={styles.content}>
          <BackButton />
          {failure ? (
            <ErrorNotice
              message={t.common.errors[classifyRequestError(failure)]}
              network={classifyRequestError(failure) === 'network'}
              onRetry={() => {
                void stored.refetch();
                void exercises.refetch();
              }}
              retryLabel={t.common.retry}
              retrying={stored.isFetching || exercises.isFetching}
            />
          ) : (
            <AppText color="muted">
              {missing ? t.templateEditor.notFound : t.common.loading}
            </AppText>
          )}
        </View>
      </Screen>
    );
  }

  return <Editor draft={draft} isNew={isNew} />;
}

function Editor({ draft, isNew }: { draft: TemplateDraft; isNew: boolean }) {
  const { t, language } = useI18n();
  const exercises = useExercises();
  const save = useSaveTemplate();
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const [errors, setErrors] = useState<Partial<Record<'name' | 'items', TemplateError>>>({});
  const hasChanges = useTemplateHasChanges(draft.id);

  // Lets the screen go once the athlete chose to discard, or after saving.
  const allowLeavingRef = useRef(() => {});

  // Every way of leaving the screen goes through here while there are unsaved changes.
  const allowLeaving = usePreventRemove(hasChanges, ({ repeat }) => {
    Alert.alert(t.templateEditor.discardTitle, t.templateEditor.discardBody, [
      { text: t.templateEditor.keepEditing, style: 'cancel' },
      {
        text: t.templateEditor.discard,
        style: 'destructive',
        onPress: () => {
          allowLeavingRef.current();
          repeat();
        },
      },
    ]);
  });

  useEffect(() => {
    allowLeavingRef.current = allowLeaving;
  }, [allowLeaving]);

  const byId = useMemo(
    () => new Map((exercises.data ?? []).map((exercise) => [exercise.id, exercise])),
    [exercises.data],
  );
  const update = (change: (current: TemplateDraft) => TemplateDraft) => {
    setTemplateDraft(draft.id, change);
    setErrors({});
  };

  const onSave = () => {
    const result = validateTemplate(draft);
    if (!result.ok) {
      setErrors(result.error);
      return;
    }
    // Going back unmounts the editor, which discards the draft.
    save.mutate(result.value, {
      onSuccess: () => {
        allowLeaving();
        router.back();
      },
    });
  };

  const renderItem = ({ item, index }: { item: TemplateItem; index: number }) => {
    const exercise = byId.get(item.exerciseId);
    const name = exercise ? exerciseName(exercise, language) : t.templateEditor.unknownExercise;
    return (
      <TemplateItemCard
        item={item}
        name={name}
        equipment={exercise ? equipmentLabel(t, exercise.equipment) : ''}
        index={index}
        total={draft.items.length}
        onChange={(changes) => update((current) => updateItem(current, item.id, changes))}
        onMove={(offset) => update((current) => moveItemBy(current, item.id, offset))}
        onRemove={() => update((current) => removeItem(current, item.id))}
      />
    );
  };

  return (
    <Screen>
      <Animated.ScrollView
        ref={scrollRef}
        keyboardShouldPersistTaps="handled"
        style={styles.scrollView}
        contentContainerStyle={styles.scroll}
      >
        <View style={styles.content}>
          <BackButton />
          <AppText variant="title" accessibilityRole="header">
            {isNew ? t.templateEditor.newTitle : t.templateEditor.editTitle}
          </AppText>

          <TextField
            label={t.templateEditor.name}
            placeholder={t.templateEditor.namePlaceholder}
            value={draft.name}
            maxLength={TEMPLATE_NAME_MAX_LENGTH}
            onChangeText={(name) => update((current) => ({ ...current, name }))}
            error={errors.name ? t.templateEditor.errors[errors.name] : undefined}
            autoCapitalize="sentences"
          />

          <View style={styles.section}>
            <AppText variant="heading" accessibilityRole="header">
              {t.templateEditor.exercises}
            </AppText>
            {draft.items.length > 1 && (
              <AppText variant="caption" color="muted">
                {t.templateEditor.reorderHint}
              </AppText>
            )}
          </View>

          <Sortable.Grid
            columns={1}
            rowGap={spacing[3]}
            data={draft.items}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            customHandle
            scrollableRef={scrollRef}
            onDragEnd={({ data }) => update((current) => ({ ...current, items: data }))}
          />

          {errors.items && (
            <AppText
              variant="caption"
              color="danger"
              accessibilityRole="alert"
              accessibilityLiveRegion="polite"
            >
              {t.templateEditor.errors[errors.items]}
            </AppText>
          )}

          <Button
            label={t.templateEditor.addExercises}
            icon={Plus}
            variant="secondary"
            fullWidth
            onPress={() => router.push({ pathname: '/exercises', params: { pick: draft.id } })}
          />

          {save.error && (
            <ErrorNotice
              message={t.templateEditor.errors[classifyRequestError(save.error)]}
              network={classifyRequestError(save.error) === 'network'}
              // The draft as it is now: its ids have not changed, so nothing is duplicated.
              onRetry={onSave}
              retryLabel={t.common.retry}
              retrying={save.isPending}
            />
          )}

          <Button label={t.common.save} fullWidth loading={save.isPending} onPress={onSave} />
        </View>
      </Animated.ScrollView>
    </Screen>
  );
}

function BackButton() {
  const { t } = useI18n();
  return (
    <View style={styles.top}>
      <Button
        label={t.common.back}
        variant="ghost"
        icon={ArrowLeft}
        onPress={() => router.back()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
  },
  content: {
    gap: spacing[4],
    width: '100%',
    maxWidth: sizes.maxContentWidth,
    alignSelf: 'center',
  },
  section: {
    gap: spacing[1],
  },
  top: {
    alignItems: 'flex-start',
  },
});
