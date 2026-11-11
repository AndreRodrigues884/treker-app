import { Check, ChevronRight, Plus, SearchX } from 'lucide-react-native';
import { useMemo, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import {
  AppText,
  Badge,
  Button,
  Chip,
  EmptyState,
  ErrorNotice,
  Icon,
  TextField,
} from '@/components';
import { classifyRequestError } from '@/core/errors';
import {
  EQUIPMENT,
  exerciseName,
  isCustomExercise,
  MUSCLE_GROUPS,
  NO_FILTERS,
  searchExercises,
  type ExerciseFilters,
} from '@/core/exercises';
import { interpolate } from '@/core/i18n';
import { useI18n } from '@/lib/i18n';
import { accentTints, colors, opacity, radii, sizes, spacing } from '@/theme';

import { equipmentLabel, exerciseMeta, muscleGroupLabel } from './labels';
import { useExercises } from './queries';
import type { ExerciseRow } from './repository';

export type ExerciseLibraryProps =
  | {
      // Consulting: every exercise opens its progress screen.
      mode: 'browse';
      onOpen: (exercise: ExerciseRow) => void;
      onCreate: (name: string) => void;
    }
  | {
      // Multiple choice: every row is a checkbox.
      mode: 'pick';
      picked: readonly string[];
      onToggle: (exercise: ExerciseRow) => void;
      onCreate: (name: string) => void;
    };

/**
 * The exercise library, used to consult exercises and to pick several for a workout. Names in the
 * app language, search without accents or case, filters by muscle group and equipment, and the
 * athlete's own exercises marked and first. When nothing matches, offers to create the exercise
 * with the name typed.
 */
export function ExerciseLibrary(props: ExerciseLibraryProps) {
  const { t, language } = useI18n();
  const exercises = useExercises();
  const [filters, setFilters] = useState<ExerciseFilters>(NO_FILTERS);

  const results = useMemo(
    () => searchExercises(exercises.data ?? [], filters, language),
    [exercises.data, filters, language],
  );
  const typed = filters.query.trim();

  return (
    <View style={styles.container}>
      <TextField
        label={t.exercises.search}
        placeholder={t.exercises.searchPlaceholder}
        value={filters.query}
        onChangeText={(query) => setFilters((current) => ({ ...current, query }))}
        autoCorrect={false}
        autoCapitalize="none"
        returnKeyType="search"
      />

      <FilterRow label={t.exercises.muscleGroup}>
        <Chip
          label={t.exercises.all}
          selected={filters.muscleGroup === null}
          onPress={() => setFilters((current) => ({ ...current, muscleGroup: null }))}
        />
        {MUSCLE_GROUPS.map((group) => (
          <Chip
            key={group}
            label={muscleGroupLabel(t, group)}
            selected={filters.muscleGroup === group}
            onPress={() =>
              setFilters((current) => ({
                ...current,
                muscleGroup: current.muscleGroup === group ? null : group,
              }))
            }
          />
        ))}
      </FilterRow>

      <FilterRow label={t.exercises.equipment}>
        <Chip
          label={t.exercises.all}
          selected={filters.equipment === null}
          onPress={() => setFilters((current) => ({ ...current, equipment: null }))}
        />
        {EQUIPMENT.map((equipment) => (
          <Chip
            key={equipment}
            label={equipmentLabel(t, equipment)}
            selected={filters.equipment === equipment}
            onPress={() =>
              setFilters((current) => ({
                ...current,
                equipment: current.equipment === equipment ? null : equipment,
              }))
            }
          />
        ))}
      </FilterRow>

      {exercises.isError && (
        <ErrorNotice
          message={t.common.errors[classifyRequestError(exercises.error)]}
          network={classifyRequestError(exercises.error) === 'network'}
          onRetry={() => exercises.refetch()}
          retryLabel={t.common.retry}
          retrying={exercises.isFetching}
        />
      )}

      {exercises.isPending && (
        <AppText color="muted" accessibilityLiveRegion="polite">
          {t.common.loading}
        </AppText>
      )}

      {exercises.isSuccess && (
        <AppText variant="caption" color="muted" accessibilityLiveRegion="polite">
          {interpolate(t.exercises.results, { count: results.length })}
        </AppText>
      )}

      {exercises.isSuccess && results.length === 0 && (
        <View style={styles.empty}>
          <EmptyState icon={SearchX} title={t.exercises.emptyTitle} body={t.exercises.emptyBody} />
          <Button
            label={
              typed ? interpolate(t.exercises.createNamed, { name: typed }) : t.exercises.create
            }
            icon={Plus}
            variant="secondary"
            fullWidth
            onPress={() => props.onCreate(typed)}
          />
        </View>
      )}

      <View>
        {results.map((exercise) => (
          <ExerciseItem
            key={exercise.id}
            exercise={exercise}
            name={exerciseName(exercise, language)}
            meta={exerciseMeta(t, exercise)}
            yoursLabel={t.exercises.yours}
            {...(props.mode === 'pick'
              ? {
                  kind: 'checkbox' as const,
                  checked: props.picked.includes(exercise.id),
                  onPress: () => props.onToggle(exercise),
                }
              : { kind: 'open' as const, onPress: () => props.onOpen(exercise) })}
          />
        ))}
      </View>
    </View>
  );
}

function FilterRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={styles.filter}>
      <AppText variant="caption" color="textSoft">
        {label}
      </AppText>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}
        accessibilityLabel={label}
      >
        {children}
      </ScrollView>
    </View>
  );
}

type ExerciseItemProps = {
  exercise: ExerciseRow;
  name: string;
  meta: string;
  yoursLabel: string;
} & (
  | { kind: 'checkbox'; checked: boolean; onPress: () => void }
  | { kind: 'open'; onPress: () => void }
  | { kind: 'info' }
);

function ExerciseItem(props: ExerciseItemProps) {
  const custom = isCustomExercise(props.exercise);
  const label = [props.name, custom ? props.yoursLabel : null, props.meta]
    .filter(Boolean)
    .join(', ');

  const content = (
    <>
      <View style={styles.itemText}>
        <View style={styles.itemTitle}>
          <AppText style={styles.itemName}>{props.name}</AppText>
          {custom && <Badge label={props.yoursLabel} tone="gym" />}
        </View>
        <AppText variant="caption" color="muted">
          {props.meta}
        </AppText>
      </View>
      {props.kind === 'checkbox' && (
        <View style={[styles.box, props.checked && styles.boxChecked]}>
          {props.checked && <Icon icon={Check} size="sm" color="onAccent" />}
        </View>
      )}
      {props.kind === 'open' && <Icon icon={ChevronRight} size="sm" color="dim" />}
    </>
  );

  if (props.kind === 'info') {
    return (
      <View style={styles.item} accessible accessibilityLabel={label}>
        {content}
      </View>
    );
  }

  return (
    <Pressable
      onPress={props.onPress}
      accessibilityRole={props.kind === 'checkbox' ? 'checkbox' : 'button'}
      accessibilityLabel={label}
      accessibilityState={props.kind === 'checkbox' ? { checked: props.checked } : undefined}
      style={({ pressed }) => [
        styles.item,
        props.kind === 'checkbox' && props.checked && styles.itemChecked,
        pressed && styles.pressed,
      ]}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing[4],
  },
  filter: {
    gap: spacing[2],
  },
  chips: {
    gap: spacing[2],
    // Room for the chips' larger touch area.
    paddingVertical: (sizes.minTouch - sizes.chip) / 2,
  },
  empty: {
    gap: spacing[3],
  },
  item: {
    minHeight: sizes.control,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[2],
    borderBottomWidth: sizes.border,
    borderBottomColor: colors.divider,
  },
  itemChecked: {
    backgroundColor: colors[accentTints.gym],
  },
  pressed: {
    opacity: opacity.pressed,
  },
  itemText: {
    flex: 1,
    gap: spacing[1],
  },
  itemTitle: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing[2],
  },
  itemName: {
    flexShrink: 1,
  },
  box: {
    width: spacing[6],
    height: spacing[6],
    borderRadius: radii.sm,
    borderWidth: sizes.border,
    borderColor: colors.lineStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxChecked: {
    backgroundColor: colors.gym,
    borderColor: colors.gym,
  },
});
