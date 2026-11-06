import { router } from 'expo-router';
import { ClipboardList, Library, Plus, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText, Button, Card, EmptyState, ErrorNotice, Icon, Screen } from '@/components';
import { classifyRequestError } from '@/core/errors';
import { interpolate } from '@/core/i18n';
import { useDataContext } from '@/features/auth/auth-provider';
import { StartWorkoutButton } from '@/features/navigation/start-workout-button';
import { useDeleteTemplate, useTemplates } from '@/features/templates/queries';
import { useI18n } from '@/lib/i18n';
import { fontFamilies, opacity, sizes, spacing } from '@/theme';

// "Workouts": the saved workouts, one line each with the name and how many exercises. Tap one to
// edit it; the red bin deletes it (after a confirmation). The exercise library opens from here.
export default function WorkoutsScreen() {
  const { t } = useI18n();
  const ctx = useDataContext();
  const templates = useTemplates();
  const remove = useDeleteTemplate();
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null);

  return (
    <Screen scroll belowHeader floating={<StartWorkoutButton />}>
      <View style={styles.content}>
        <View style={styles.actions}>
          <Button
            label={t.workouts.new}
            icon={Plus}
            onPress={() =>
              router.push({ pathname: '/templates/[id]', params: { id: ctx.newId(), new: '1' } })
            }
          />
          <Button
            label={t.workouts.library}
            icon={Library}
            variant="secondary"
            onPress={() => router.push('/exercises')}
          />
        </View>

        {remove.error && (
          <ErrorNotice
            message={t.workouts.errors[classifyRequestError(remove.error)]}
            network={classifyRequestError(remove.error) === 'network'}
            onRetry={() => remove.variables && remove.mutate(remove.variables)}
            retryLabel={t.common.retry}
            retrying={remove.isPending}
          />
        )}

        {templates.isError && (
          <ErrorNotice
            message={t.common.errors[classifyRequestError(templates.error)]}
            network={classifyRequestError(templates.error) === 'network'}
            onRetry={() => templates.refetch()}
            retryLabel={t.common.retry}
            retrying={templates.isFetching}
          />
        )}

        {templates.isPending && <AppText color="muted">{t.common.loading}</AppText>}

        {templates.data?.length === 0 && (
          <EmptyState
            icon={ClipboardList}
            title={t.workouts.emptyTitle}
            body={t.workouts.emptyBody}
          />
        )}

        {templates.data?.map(({ template, exercises }) => (
          <TemplateCard
            key={template.id}
            name={template.name}
            exerciseCount={exercises.length}
            confirmingDelete={confirmingDelete === template.id}
            onOpen={() => router.push({ pathname: '/templates/[id]', params: { id: template.id } })}
            onAskDelete={() => setConfirmingDelete(template.id)}
            onCancelDelete={() => setConfirmingDelete(null)}
            onDelete={() =>
              remove.mutate(template.id, { onSuccess: () => setConfirmingDelete(null) })
            }
            deleting={remove.isPending}
          />
        ))}
      </View>
    </Screen>
  );
}

// One line: "Back - 3 exercises" on the left (the count in a light weight), the red bin on the
// right. Deleting asks first, under the line.
function TemplateCard({
  name,
  exerciseCount,
  confirmingDelete,
  deleting,
  onOpen,
  onAskDelete,
  onCancelDelete,
  onDelete,
}: {
  name: string;
  exerciseCount: number;
  confirmingDelete: boolean;
  deleting: boolean;
  onOpen: () => void;
  onAskDelete: () => void;
  onCancelDelete: () => void;
  onDelete: () => void;
}) {
  const { t } = useI18n();
  const count =
    exerciseCount === 1
      ? t.workouts.exerciseCountOne
      : interpolate(t.workouts.exerciseCount, { count: exerciseCount });

  return (
    <Card>
      <View style={styles.row}>
        <Pressable
          onPress={onOpen}
          accessibilityRole="button"
          accessibilityLabel={`${interpolate(t.workouts.edit, { name })}, ${count}`}
          style={({ pressed }) => [styles.summary, pressed && styles.pressed]}
        >
          <AppText variant="heading" numberOfLines={2}>
            {name}
            <AppText variant="body" color="muted" style={styles.count}>
              {` - ${count}`}
            </AppText>
          </AppText>
        </Pressable>
        <Pressable
          onPress={onAskDelete}
          disabled={deleting}
          accessibilityRole="button"
          accessibilityLabel={interpolate(t.workouts.deleteNamed, { name })}
          accessibilityState={{ disabled: deleting }}
          style={({ pressed }) => [styles.bin, pressed && styles.pressed]}
        >
          <Icon icon={Trash2} color="danger" />
        </Pressable>
      </View>

      {confirmingDelete && (
        <View style={styles.confirm}>
          <AppText accessibilityRole="alert" accessibilityLiveRegion="polite">
            {interpolate(t.workouts.deleteQuestion, { name })}
          </AppText>
          <View style={styles.confirmActions}>
            <Button
              label={t.workouts.deleteConfirm}
              icon={Trash2}
              variant="danger"
              onPress={onDelete}
              loading={deleting}
            />
            <Button label={t.common.cancel} variant="ghost" onPress={onCancelDelete} />
          </View>
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing[4],
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[3],
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  summary: {
    flex: 1,
    minHeight: sizes.minTouch,
    justifyContent: 'center',
  },
  count: {
    fontFamily: fontFamilies.light,
  },
  bin: {
    width: sizes.minTouch,
    height: sizes.minTouch,
    alignItems: 'center',
    justifyContent: 'center',
    // Lines the icon up with the card's right edge while keeping the 44 pt target.
    marginRight: -spacing[3],
  },
  pressed: {
    opacity: opacity.pressed,
  },
  confirm: {
    gap: spacing[3],
  },
  confirmActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
  },
});
