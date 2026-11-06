import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { AppText, Button, ErrorNotice, Screen } from '@/components';
import { classifyRequestError } from '@/core/errors';
import { CustomExerciseForm } from '@/features/exercises/custom-exercise-form';
import { useExercises } from '@/features/exercises/queries';
import { useI18n } from '@/lib/i18n';
import { spacing } from '@/theme';

// Edits (or deletes) one of the athlete's own exercises. Library exercises and deleted ones
// cannot be edited.
export default function EditExerciseScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useI18n();
  const exercises = useExercises();
  const exercise = exercises.data?.find(
    (row) => row.id === id && row.owner_id !== null && row.deleted_at === null,
  );

  if (exercise) return <CustomExerciseForm key={exercise.id} exercise={exercise} />;

  return (
    <Screen>
      <View style={styles.content}>
        <View style={styles.top}>
          <Button
            label={t.common.back}
            variant="ghost"
            icon={ArrowLeft}
            onPress={() => router.back()}
          />
        </View>
        {exercises.isError ? (
          <ErrorNotice
            message={t.common.errors[classifyRequestError(exercises.error)]}
            network={classifyRequestError(exercises.error) === 'network'}
            onRetry={() => exercises.refetch()}
            retryLabel={t.common.retry}
            retrying={exercises.isFetching}
          />
        ) : (
          <AppText color="muted">
            {exercises.isPending ? t.common.loading : t.common.errors.generic}
          </AppText>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing[4],
  },
  top: {
    alignItems: 'flex-start',
  },
});
