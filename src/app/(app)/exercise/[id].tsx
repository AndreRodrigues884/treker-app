import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, ChevronRight, Pencil, Trophy } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import {
  AppText,
  Badge,
  Button,
  Card,
  Chip,
  ErrorNotice,
  Icon,
  Screen,
  TrendChart,
  type TrendChartPoint,
} from '@/components';
import { localDateOf } from '@/core/dates';
import { classifyRequestError } from '@/core/errors';
import { exerciseName } from '@/core/exercises';
import {
  formatCompactNumber,
  formatLocalDate,
  formatShortDate,
  formatWeight,
  labelledIndexes,
} from '@/core/format';
import { interpolate } from '@/core/i18n';
import { describeTrend, PROGRESS_RANGES, rangeStart, type ProgressRange } from '@/core/progress';
import { fromKilograms } from '@/core/units';
import { setText, workoutTitle, type DisplayUnits } from '@/features/activities/labels';
import { useAuth } from '@/features/auth/auth-provider';
import { exerciseMeta } from '@/features/exercises/labels';
import { useExercises } from '@/features/exercises/queries';
import type { HistoryEntry, ProgressPoint } from '@/features/records/repository';
import {
  useExerciseHistory,
  useExerciseProgress,
  useExerciseRecord,
  useExerciseStats,
} from '@/features/records/queries';
import { difficultyLabel, difficultyTone } from '@/features/session/difficulty';
import { getDeviceTimezone } from '@/lib/device';
import { useI18n } from '@/lib/i18n';
import { colors, opacity, sizes, spacing } from '@/theme';

/**
 * One exercise: its current record (estimated 1RM and the set that gave it), its stats, charts of
 * the best 1RM and the volume of each workout (3 months, 1 year or everything; records marked),
 * and its history by workout, one page at a time. Opened from the library, a workout, the session
 * and the records screen.
 */
export default function ExerciseScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, language } = useI18n();
  const { profile } = useAuth();
  const exercises = useExercises();
  const exercise = exercises.data?.find((row) => row.id === id);

  // An own exercise deleted from its form (opened from here): this screen closes too.
  const deleted = exercise?.deleted_at != null;
  useEffect(() => {
    if (deleted && router.canGoBack()) router.back();
  }, [deleted]);
  const today = localDateOf(new Date(), getDeviceTimezone());
  const units: DisplayUnits = {
    weight: profile?.weight_unit ?? 'kg',
    distance: profile?.pool_unit ?? 'm',
    language,
  };

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
          {exercise?.owner_id && (
            <Button
              label={t.exercise.editExercise}
              icon={Pencil}
              variant="ghost"
              onPress={() => router.push({ pathname: '/exercises/[id]', params: { id } })}
            />
          )}
        </View>
        <View style={styles.header}>
          <AppText variant="title" accessibilityRole="header">
            {exercise ? exerciseName(exercise, language) : t.templateEditor.unknownExercise}
          </AppText>
          {exercise && <AppText color="muted">{exerciseMeta(t, exercise)}</AppText>}
        </View>

        <RecordAndStats exerciseId={id} units={units} today={today} />
        <Charts
          exerciseId={id}
          units={units}
          today={today}
          showOneRepMax={exercise ? exercise.unit === 'reps' && exercise.tracks_load : true}
        />
        <History exerciseId={id} units={units} today={today} />
      </View>
    </Screen>
  );
}

function RecordAndStats({
  exerciseId,
  units,
  today,
}: {
  exerciseId: string;
  units: DisplayUnits;
  today: string;
}) {
  const { t } = useI18n();
  const record = useExerciseRecord(exerciseId);
  const stats = useExerciseStats(exerciseId);
  const weight = (kg: number) =>
    formatWeight(fromKilograms(kg, units.weight), units.weight, units.language);
  const failure = record.error ?? stats.error;

  return (
    <>
      {failure && (
        <ErrorNotice
          message={t.common.errors[classifyRequestError(failure)]}
          network={classifyRequestError(failure) === 'network'}
          onRetry={() => {
            void record.refetch();
            void stats.refetch();
          }}
          retryLabel={t.common.retry}
          retrying={record.isFetching || stats.isFetching}
        />
      )}
      <Card>
        <View style={styles.recordTitle}>
          <Icon icon={Trophy} color="record" />
          <AppText variant="caption" color="muted">
            {t.exercise.record}
          </AppText>
        </View>
        {record.data ? (
          <View
            accessible
            accessibilityLabel={`${interpolate(t.exercise.recordValue, {
              value: weight(record.data.valueKg),
            })}, ${formatLocalDate(record.data.localDate, units.language, today)}`}
          >
            <AppText variant="heading">
              {interpolate(t.exercise.recordValue, { value: weight(record.data.valueKg) })}
            </AppText>
            <AppText variant="numeric" color="muted">
              {interpolate(t.records.setOn, {
                set: setText(
                  { weight_kg: record.data.weightKg, reps: record.data.reps, duration_s: null },
                  units,
                ),
                date: formatLocalDate(record.data.localDate, units.language, today),
              })}
            </AppText>
          </View>
        ) : (
          <AppText color="muted">
            {record.isPending ? t.common.loading : t.exercise.noRecord}
          </AppText>
        )}
        {stats.data && (
          <View style={styles.stats}>
            <Stat
              label={t.exercise.totalVolume}
              value={weight(Number(stats.data.total_volume_kg))}
            />
            <Stat label={t.exercise.sets} value={String(stats.data.set_count)} />
            {stats.data.last_local_date && (
              <Stat
                label={t.exercise.lastWorkout}
                value={formatLocalDate(stats.data.last_local_date, units.language, today)}
              />
            )}
          </View>
        )}
      </Card>
    </>
  );
}

function Charts({
  exerciseId,
  units,
  today,
  showOneRepMax,
}: {
  exerciseId: string;
  units: DisplayUnits;
  today: string;
  showOneRepMax: boolean;
}) {
  const { t } = useI18n();
  const [range, setRange] = useState<ProgressRange>('3m');
  const from = rangeStart(range, today);
  const progress = useExerciseProgress(exerciseId, from);
  const points = useMemo(() => progress.data ?? [], [progress.data]);
  const weight = (kg: number) =>
    formatWeight(fromKilograms(kg, units.weight), units.weight, units.language);

  const oneRepMax = useMemo(
    () =>
      points.filter(
        (point): point is ProgressPoint & { oneRepMaxKg: number } => point.oneRepMaxKg !== null,
      ),
    [points],
  );

  const chartPoints = <T extends ProgressPoint>(
    series: readonly T[],
    value: (point: T) => number,
  ): TrendChartPoint[] => {
    const labelled = labelledIndexes(series.length);
    return series.map((point, index) => ({
      value: fromKilograms(value(point), units.weight),
      label: labelled.has(index) ? formatShortDate(point.localDate, units.language) : '',
      highlight: point.isRecord,
    }));
  };

  const summary = <T extends ProgressPoint>(
    what: string,
    series: readonly T[],
    value: (point: T) => number,
  ): string => {
    const trend = describeTrend(
      series.map((point) => ({ localDate: point.localDate, value: value(point) })),
    );
    if (!trend) return t.exercise.noData;
    const period = t.exercise.periods[range];
    const sentence =
      trend.direction === 'same'
        ? interpolate(t.exercise.trendSame, { what, value: weight(trend.last.value), period })
        : interpolate(trend.direction === 'up' ? t.exercise.trendUp : t.exercise.trendDown, {
            what,
            from: weight(trend.first.value),
            to: weight(trend.last.value),
            period,
          });
    const records = series.filter((point) => point.isRecord).length;
    return records > 0
      ? `${sentence} ${interpolate(t.exercise.recordsMarked, { count: records })}`
      : sentence;
  };

  const yLabel = (value: number) => formatCompactNumber(value, units.language);

  return (
    <View style={styles.section}>
      <View
        style={styles.ranges}
        accessibilityRole="radiogroup"
        accessibilityLabel={t.exercise.range}
      >
        {PROGRESS_RANGES.map((option) => (
          <Chip
            key={option}
            label={t.exercise.ranges[option]}
            selected={range === option}
            onPress={() => setRange(option)}
          />
        ))}
      </View>

      {progress.isError && (
        <ErrorNotice
          message={t.common.errors[classifyRequestError(progress.error)]}
          network={classifyRequestError(progress.error) === 'network'}
          onRetry={() => progress.refetch()}
          retryLabel={t.common.retry}
          retrying={progress.isFetching}
        />
      )}
      {progress.isSuccess && points.length === 0 && (
        <AppText color="muted">{t.exercise.noData}</AppText>
      )}

      {points.length > 0 && showOneRepMax && oneRepMax.length > 0 && (
        <Card>
          <AppText variant="heading" accessibilityRole="header">
            {t.exercise.oneRepMaxChart}
          </AppText>
          <TrendChart
            kind="line"
            points={chartPoints(oneRepMax, (point) => point.oneRepMaxKg)}
            summary={summary(t.exercise.oneRepMaxChart, oneRepMax, (point) => point.oneRepMaxKg)}
            formatValue={yLabel}
          />
        </Card>
      )}
      {points.length > 0 && (
        <Card>
          <AppText variant="heading" accessibilityRole="header">
            {t.exercise.volumeChart}
          </AppText>
          <TrendChart
            kind="bar"
            points={chartPoints(points, (point) => point.volumeKg)}
            summary={summary(t.exercise.volumeChart, points, (point) => point.volumeKg)}
            formatValue={yLabel}
          />
        </Card>
      )}
    </View>
  );
}

function History({
  exerciseId,
  units,
  today,
}: {
  exerciseId: string;
  units: DisplayUnits;
  today: string;
}) {
  const { t } = useI18n();
  const history = useExerciseHistory(exerciseId);
  const entries = history.data?.pages.flat() ?? [];

  return (
    <View style={styles.section}>
      <AppText variant="heading" accessibilityRole="header">
        {t.exercise.history}
      </AppText>
      {history.isError && (
        <ErrorNotice
          message={t.common.errors[classifyRequestError(history.error)]}
          network={classifyRequestError(history.error) === 'network'}
          onRetry={() => history.refetch()}
          retryLabel={t.common.retry}
          retrying={history.isFetching}
        />
      )}
      {history.isSuccess && entries.length === 0 && (
        <AppText color="muted">{t.exercise.noHistory}</AppText>
      )}
      {entries.map((entry) => (
        <HistoryRow key={entry.activityId} entry={entry} units={units} today={today} />
      ))}
      {history.hasNextPage && (
        <Button
          label={t.workout.showMore}
          variant="secondary"
          fullWidth
          loading={history.isFetchingNextPage}
          onPress={() => history.fetchNextPage()}
        />
      )}
    </View>
  );
}

function HistoryRow({
  entry,
  units,
  today,
}: {
  entry: HistoryEntry;
  units: DisplayUnits;
  today: string;
}) {
  const { t } = useI18n();
  const date = formatLocalDate(entry.localDate, units.language, today);
  const title = workoutTitle(t, 'gym', entry.title);
  const sets = entry.sets.map((set) =>
    setText({ weight_kg: set.weightKg, reps: set.reps, duration_s: set.durationS }, units),
  );

  return (
    <Pressable
      onPress={() =>
        router.push({ pathname: '/activities/[id]', params: { id: entry.activityId } })
      }
      accessibilityRole="button"
      accessibilityLabel={`${interpolate(t.exercise.openWorkout, { date })}, ${title}, ${entry.sets
        .map(
          (set, index) =>
            `${sets[index]}${set.difficulty ? ` ${difficultyLabel(t, set.difficulty)}` : ''}`,
        )
        .join(', ')}`}
      style={({ pressed }) => [styles.historyRow, pressed && styles.pressed]}
    >
      <View style={styles.historyText}>
        <AppText variant="caption" color="muted">
          {`${date} · ${title}`}
        </AppText>
        {entry.sets.map((set, index) => (
          <View key={set.id} style={styles.historySet}>
            <AppText variant="numeric">{sets[index]}</AppText>
            {set.difficulty && (
              <Badge
                label={difficultyLabel(t, set.difficulty)}
                tone={difficultyTone[set.difficulty]}
              />
            )}
          </View>
        ))}
      </View>
      <Icon icon={ChevronRight} size="sm" color="dim" />
    </Pressable>
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
    gap: spacing[5],
  },
  top: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  header: {
    gap: spacing[1],
  },
  recordTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
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
  ranges: {
    flexDirection: 'row',
    gap: spacing[2],
  },
  historyRow: {
    minHeight: sizes.control,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingVertical: spacing[3],
    borderBottomWidth: sizes.border,
    borderBottomColor: colors.divider,
  },
  pressed: {
    opacity: opacity.pressed,
  },
  historyText: {
    flex: 1,
    gap: spacing[1],
  },
  historySet: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
});
