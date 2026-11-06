import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText, Badge, Button, Card, ErrorNotice, PrBadge, Screen } from '@/components';
import {
  durationSeconds,
  groupSetsByExercise,
  gymTotals,
  swimTotals,
  type ActivityType,
} from '@/core/activities';
import { localDateOf } from '@/core/dates';
import { classifyRequestError } from '@/core/errors';
import { exerciseName } from '@/core/exercises';
import { formatDuration, formatLocalDate, formatWeight } from '@/core/format';
import { interpolate } from '@/core/i18n';
import { fromKilograms } from '@/core/units';
import {
  setText,
  swimEventText,
  swimTimeText,
  workoutAmount,
  workoutTitle,
  type DisplayUnits,
} from '@/features/activities/labels';
import { useActivity, useActivityRecords } from '@/features/activities/queries';
import type {
  ActivityWithEntries,
  GymSetRow,
  PersonalRecordRow,
  SwimEntryRow,
} from '@/features/activities/repository';
import { useAuth } from '@/features/auth/auth-provider';
import { useExercises } from '@/features/exercises/queries';
import { sportLabel } from '@/features/onboarding/labels';
import { getDeviceTimezone } from '@/lib/device';
import { useI18n } from '@/lib/i18n';
import { colors, sizes, spacing } from '@/theme';

/**
 * One workout, read only: its date, duration and totals, the exercises with their sets (or the
 * swim times), and the records it set, marked next to the set or time that beat the previous best.
 * Editing and deleting arrive in phase 1c.
 */
export default function WorkoutScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useI18n();
  const workout = useActivity(id);
  const records = useActivityRecords(id);
  const failure = workout.error ?? records.error;

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

        {failure && (
          <ErrorNotice
            message={t.common.errors[classifyRequestError(failure)]}
            network={classifyRequestError(failure) === 'network'}
            onRetry={() => {
              void workout.refetch();
              void records.refetch();
            }}
            retryLabel={t.common.retry}
            retrying={workout.isFetching || records.isFetching}
          />
        )}
        {(workout.isPending || records.isPending) && !failure && (
          <AppText color="muted">{t.common.loading}</AppText>
        )}
        {workout.isSuccess && workout.data === null && (
          <AppText color="muted">{t.workout.notFound}</AppText>
        )}
        {workout.data && records.data && (
          <WorkoutDetail workout={workout.data} records={records.data} />
        )}
      </View>
    </Screen>
  );
}

function WorkoutDetail({
  workout,
  records,
}: {
  workout: ActivityWithEntries;
  records: PersonalRecordRow[];
}) {
  const { t, language } = useI18n();
  const { profile } = useAuth();
  const { activity, gymSets, swimEntries } = workout;
  const units: DisplayUnits = {
    weight: profile?.weight_unit ?? 'kg',
    distance: profile?.pool_unit ?? 'm',
    language,
  };
  const type: ActivityType = activity.type;
  const today = localDateOf(new Date(), getDeviceTimezone());
  const duration = durationSeconds(activity.started_at, activity.ended_at);
  const totals =
    type === 'gym'
      ? { ...gymTotals(gymSets), distanceM: null }
      : { ...swimTotals(swimEntries), volumeKg: null };
  const amount = workoutAmount({ type, ...totals }, units);

  return (
    <>
      <View style={styles.header}>
        <AppText variant="title" accessibilityRole="header">
          {workoutTitle(t, type, activity.title)}
        </AppText>
        <AppText color="muted">
          {`${sportLabel(t, type)} · ${formatLocalDate(activity.local_date, language, today)}`}
        </AppText>
      </View>

      <Card>
        <View style={styles.stats}>
          {duration !== null && (
            <Stat label={t.workout.duration} value={formatDuration(duration)} />
          )}
          <Stat
            label={type === 'gym' ? t.workout.sets : t.workout.times}
            value={String(totals.setCount)}
          />
          {amount !== null && (
            <Stat label={type === 'gym' ? t.workout.volume : t.workout.distance} value={amount} />
          )}
        </View>
      </Card>

      {type === 'gym' ? (
        <GymSets sets={gymSets} records={records} units={units} />
      ) : (
        <SwimTimes entries={swimEntries} records={records} />
      )}

      <Records records={records} units={units} />
    </>
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

function GymSets({
  sets,
  records,
  units,
}: {
  sets: GymSetRow[];
  records: PersonalRecordRow[];
  units: DisplayUnits;
}) {
  const { t, language } = useI18n();
  const exercises = useExercises();
  const byId = useMemo(
    () => new Map((exercises.data ?? []).map((exercise) => [exercise.id, exercise])),
    [exercises.data],
  );
  const recordSets = new Set(records.map((record) => record.gym_set_id));
  const groups = groupSetsByExercise(sets);

  return (
    <View style={styles.section}>
      <AppText variant="heading" accessibilityRole="header">
        {t.workout.exercises}
      </AppText>
      {groups.length === 0 && <AppText color="muted">{t.workout.noEntries}</AppText>}
      {groups.map((group) => {
        const exercise = byId.get(group.exerciseId);
        return (
          <Card key={group.position}>
            <AppText variant="heading">
              {exercise ? exerciseName(exercise, language) : t.templateEditor.unknownExercise}
            </AppText>
            {group.sets.map((set) => (
              <View
                key={set.id}
                style={styles.line}
                accessible
                accessibilityLabel={[
                  interpolate(t.workout.setNumber, { number: set.set_number }),
                  setText(set, units),
                  set.is_warmup ? t.workout.warmup : null,
                  recordSets.has(set.id) ? t.records.prLabel : null,
                ]
                  .filter(Boolean)
                  .join(', ')}
              >
                <AppText variant="numeric" color="muted" style={styles.number}>
                  {set.set_number}
                </AppText>
                <AppText variant="numeric" style={styles.value}>
                  {setText(set, units)}
                </AppText>
                {set.is_warmup && <Badge label={t.workout.warmup} />}
                {recordSets.has(set.id) && <PrBadge />}
              </View>
            ))}
          </Card>
        );
      })}
    </View>
  );
}

function SwimTimes({
  entries,
  records,
}: {
  entries: SwimEntryRow[];
  records: PersonalRecordRow[];
}) {
  const { t, language } = useI18n();
  const recordEntries = new Set(records.map((record) => record.swim_entry_id));

  return (
    <View style={styles.section}>
      <AppText variant="heading" accessibilityRole="header">
        {t.workout.times}
      </AppText>
      {entries.length === 0 && <AppText color="muted">{t.workout.noEntries}</AppText>}
      <Card>
        {entries.map((entry) => {
          const event = swimEventText(t, entry, language);
          const time = swimTimeText(entry.time_cs, language);
          return (
            <View
              key={entry.id}
              style={styles.line}
              accessible
              accessibilityLabel={[
                event,
                time,
                recordEntries.has(entry.id) ? t.records.prLabel : null,
              ]
                .filter(Boolean)
                .join(', ')}
            >
              <AppText style={styles.value}>{event}</AppText>
              <AppText variant="numeric">{time}</AppText>
              {recordEntries.has(entry.id) && <PrBadge />}
            </View>
          );
        })}
      </Card>
    </View>
  );
}

// What this workout beat: the estimated 1RM per exercise, or the time per swim event.
function Records({ records, units }: { records: PersonalRecordRow[]; units: DisplayUnits }) {
  const { t, language } = useI18n();
  const exercises = useExercises();
  const byId = new Map((exercises.data ?? []).map((exercise) => [exercise.id, exercise]));

  return (
    <View style={styles.section}>
      <AppText variant="heading" accessibilityRole="header">
        {t.workout.records}
      </AppText>
      {records.length === 0 ? (
        <AppText color="muted">{t.workout.noRecords}</AppText>
      ) : (
        <Card>
          {records.map((record) => {
            const exercise = record.exercise_id ? byId.get(record.exercise_id) : undefined;
            const what =
              record.type === 'gym'
                ? exercise
                  ? exerciseName(exercise, language)
                  : t.templateEditor.unknownExercise
                : record.stroke && record.distance !== null && record.pool_length
                  ? swimEventText(
                      t,
                      {
                        stroke: record.stroke,
                        distance: record.distance,
                        pool_length: record.pool_length,
                      },
                      language,
                    )
                  : '';
            const value =
              record.type === 'gym'
                ? interpolate(t.workout.oneRepMax, {
                    value: formatWeight(
                      fromKilograms(record.value, units.weight),
                      units.weight,
                      language,
                    ),
                  })
                : swimTimeText(record.value, language);
            return (
              <View
                key={record.id}
                style={styles.line}
                accessible
                accessibilityLabel={`${t.records.prLabel}: ${what}, ${value}`}
              >
                <PrBadge />
                <AppText style={styles.value}>{what}</AppText>
                <AppText variant="numeric">{value}</AppText>
              </View>
            );
          })}
        </Card>
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
  header: {
    gap: spacing[1],
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
    gap: spacing[3],
  },
  line: {
    minHeight: sizes.minTouch,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    borderTopWidth: sizes.border,
    borderTopColor: colors.divider,
  },
  number: {
    minWidth: spacing[6],
  },
  value: {
    flex: 1,
  },
});
