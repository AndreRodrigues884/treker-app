import { router } from 'expo-router';
import { ListChecks } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  AppText,
  Button,
  Card,
  Chip,
  ErrorNotice,
  ProgressBar,
  Screen,
  TrendChart,
  type TrendChartPoint,
} from '@/components';
import { localDateOf, type LocalDate } from '@/core/dates';
import { classifyRequestError } from '@/core/errors';
import { exerciseName } from '@/core/exercises';
import { formatCompactNumber, formatShortDate, formatWeight, labelledIndexes } from '@/core/format';
import { interpolate } from '@/core/i18n';
import {
  averagePerWeek,
  defaultStrengthExercises,
  describeTrend,
  STATS_RANGES,
  statsRangeStart,
  type StatsRange,
} from '@/core/progress';
import { fromKilograms } from '@/core/units';
import { useAuth, useDataContext } from '@/features/auth/auth-provider';
import { muscleGroupLabel } from '@/features/exercises/labels';
import { useExercises } from '@/features/exercises/queries';
import { StartWorkoutButton } from '@/features/navigation/start-workout-button';
import {
  useExerciseUsage,
  useOneRepMaxSeries,
  useVolumeByMuscleGroup,
  useWeeklySummary,
} from '@/features/stats/queries';
import { muscleGroupColor, type ProgressUnits } from '@/features/stats/labels';
import { useStrengthChoice } from '@/features/stats/strength-choice';
import { getDeviceTimezone } from '@/lib/device';
import { useI18n } from '@/lib/i18n';
import { chartPalette, colors, radii, sizes, spacing, typography, type ColorToken } from '@/theme';

type Units = ProgressUnits;

/**
 * Statistics, for a period (4 weeks, 3 months, 1 year or everything): workouts per week against the
 * weekly goal, one chart of the estimated 1RM with chips to switch between up to 5 chosen
 * exercises, and how many workouts trained each muscle group (each in its own colour). Postgres
 * does the sums (weekly_summary, one_rep_max_series, volume_by_muscle_group). Every chart has a
 * summary for screen readers and an empty state.
 */
export default function StatsScreen() {
  const { t, language } = useI18n();
  const { profile } = useAuth();
  const [range, setRange] = useState<StatsRange>('3m');
  const today = localDateOf(new Date(), getDeviceTimezone());
  const from = statsRangeStart(range, today);
  const units: Units = { weight: profile?.weight_unit ?? 'kg', language };

  return (
    <Screen scroll belowHeader floating={<StartWorkoutButton />}>
      <View style={styles.content}>
        <View
          style={styles.ranges}
          accessibilityRole="radiogroup"
          accessibilityLabel={t.stats.range}
        >
          {STATS_RANGES.map((option) => (
            <Chip
              key={option}
              label={t.stats.ranges[option]}
              selected={range === option}
              onPress={() => setRange(option)}
            />
          ))}
        </View>

        <WorkoutsPerWeek
          from={from}
          today={today}
          range={range}
          target={profile?.weekly_target ?? null}
          units={units}
        />
        <Strength from={from} range={range} units={units} />
        <Volume from={from} today={today} range={range} />
      </View>
    </Screen>
  );
}

// Labels under at most 5 bars, so long periods stay readable.
function weekPoints(
  weeks: readonly { weekStart: LocalDate; value: number }[],
  language: Units['language'],
): TrendChartPoint[] {
  const labelled = labelledIndexes(weeks.length);
  return weeks.map((week, index) => ({
    value: week.value,
    label: labelled.has(index) ? formatShortDate(week.weekStart, language) : '',
  }));
}

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <View style={styles.sectionTitle}>
        <AppText variant="heading" accessibilityRole="header">
          {title}
        </AppText>
        {hint && (
          <AppText variant="caption" color="muted">
            {hint}
          </AppText>
        )}
      </View>
      {children}
    </Card>
  );
}

function QueryError({
  error,
  retry,
  retrying,
}: {
  error: unknown;
  retry: () => void;
  retrying: boolean;
}) {
  const { t } = useI18n();
  const kind = classifyRequestError(error);
  return (
    <ErrorNotice
      message={t.common.errors[kind]}
      network={kind === 'network'}
      onRetry={retry}
      retryLabel={t.common.retry}
      retrying={retrying}
    />
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: ColorToken }) {
  return (
    <View style={styles.stat} accessible accessibilityLabel={`${label}: ${value}`}>
      <AppText variant="caption" color="muted">
        {label}
      </AppText>
      <AppText variant="numeric" color={color} style={styles.statValue}>
        {value}
      </AppText>
    </View>
  );
}

function WorkoutsPerWeek({
  from,
  today,
  range,
  target,
  units,
}: {
  from: LocalDate | null;
  today: LocalDate;
  range: StatsRange;
  target: number | null;
  units: Units;
}) {
  const { t } = useI18n();
  const weekly = useWeeklySummary(from, today);
  const weeks = weekly.data ?? [];
  const total = weeks.reduce((sum, week) => sum + week.workoutCount, 0);
  const average = averagePerWeek(
    weeks.map((week) => ({ weekStart: week.weekStart, count: week.workoutCount })),
  );
  const averageText = average === null ? '' : formatCompactNumber(average, units.language);
  const summary = [
    interpolate(t.stats.perWeekSummary, {
      total,
      period: t.stats.periods[range],
      average: averageText,
    }),
    target === null ? null : interpolate(t.stats.goalSummary, { target }),
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <Section title={t.stats.perWeek} hint={t.stats.perWeekHint}>
      {weekly.isError && (
        <QueryError
          error={weekly.error}
          retry={() => void weekly.refetch()}
          retrying={weekly.isFetching}
        />
      )}
      {weekly.isPending && <AppText color="muted">{t.common.loading}</AppText>}
      {weekly.isSuccess && total === 0 && <AppText color="muted">{t.stats.empty}</AppText>}
      {total > 0 && (
        <>
          <View style={styles.stats}>
            <Stat
              label={t.stats.average}
              value={interpolate(t.stats.averageValue, { value: averageText })}
            />
            {target !== null && (
              <Stat
                label={t.stats.goal}
                value={interpolate(t.stats.averageValue, { value: target })}
              />
            )}
          </View>
          <TrendChart
            kind="bar"
            color="chartPurple"
            points={weekPoints(
              weeks.map((week) => ({ weekStart: week.weekStart, value: week.workoutCount })),
              units.language,
            )}
            summary={summary}
            reference={target === null ? undefined : { value: target, label: t.stats.goal }}
          />
        </>
      )}
    </Section>
  );
}

function Strength({
  from,
  range,
  units,
}: {
  from: LocalDate | null;
  range: StatsRange;
  units: Units;
}) {
  const { t, language } = useI18n();
  const ctx = useDataContext();
  const usage = useExerciseUsage();
  const stored = useStrengthChoice(ctx.userId);
  const exercises = useExercises();
  const [shownId, setShownId] = useState<string | null>(null);
  const chosen = useMemo(
    () =>
      stored.choice ??
      defaultStrengthExercises(
        (usage.data ?? []).map((row) => ({
          exerciseId: row.exerciseId,
          setCount: row.setCount,
          lastLocalDate: row.lastLocalDate,
          hasOneRepMax: row.bestOneRepMaxKg !== null,
        })),
      ),
    [stored.choice, usage.data],
  );
  const series = useOneRepMaxSeries(chosen, from);
  const byId = new Map((exercises.data ?? []).map((exercise) => [exercise.id, exercise]));
  const nameOf = (id: string) => {
    const exercise = byId.get(id);
    return exercise ? exerciseName(exercise, language) : t.templateEditor.unknownExercise;
  };
  const weight = (kg: number) =>
    formatWeight(fromKilograms(kg, units.weight), units.weight, units.language);
  const ready = stored.loaded && (stored.choice !== null || usage.isSuccess);

  // The exercise on the chart: the one tapped, else the first chosen. Each has its own colour.
  const exerciseId = shownId && chosen.includes(shownId) ? shownId : chosen[0];
  const colorOf = (id: string) =>
    chartPalette[chosen.indexOf(id) % chartPalette.length] as ColorToken;
  const points = (series.data ?? []).filter((point) => point.exerciseId === exerciseId);
  const trend = describeTrend(
    points.map((point) => ({ localDate: point.localDate, value: point.valueKg })),
  );
  const best = points.reduce((top, point) => Math.max(top, point.valueKg), -Infinity);
  const labelled = labelledIndexes(points.length);
  const name = exerciseId ? nameOf(exerciseId) : '';
  const period = t.stats.periods[range];
  const summary = !trend
    ? t.stats.empty
    : trend.direction === 'same'
      ? interpolate(t.exercise.trendSame, { what: name, value: weight(trend.last.value), period })
      : interpolate(trend.direction === 'up' ? t.exercise.trendUp : t.exercise.trendDown, {
          what: name,
          from: weight(trend.first.value),
          to: weight(trend.last.value),
          period,
        });

  return (
    <Section title={t.stats.strength} hint={t.stats.strengthHint}>
      {(usage.isError || series.isError) && (
        <QueryError
          error={usage.error ?? series.error}
          retry={() => {
            void usage.refetch();
            void series.refetch();
          }}
          retrying={usage.isFetching || series.isFetching}
        />
      )}
      {ready && chosen.length === 0 && <AppText color="muted">{t.stats.strengthNone}</AppText>}

      {ready && exerciseId && (
        <>
          <View
            style={styles.chips}
            accessibilityRole="radiogroup"
            accessibilityLabel={t.savedWorkout.exercise}
          >
            {chosen.map((id) => (
              <Chip
                key={id}
                label={nameOf(id)}
                selected={id === exerciseId}
                onPress={() => setShownId(id)}
              />
            ))}
          </View>

          {trend && (
            <View style={styles.stats}>
              <Stat
                label={t.stats.current}
                value={weight(trend.last.value)}
                color={colorOf(exerciseId)}
              />
              <Stat label={t.stats.best} value={weight(best)} />
            </View>
          )}

          {series.isSuccess && points.length < 2 ? (
            <AppText color="muted">{t.stats.empty}</AppText>
          ) : (
            points.length >= 2 && (
              <TrendChart
                kind="line"
                color={colorOf(exerciseId)}
                points={points.map((point, index) => ({
                  value: fromKilograms(point.valueKg, units.weight),
                  label: labelled.has(index)
                    ? formatShortDate(point.localDate, units.language)
                    : '',
                }))}
                summary={summary}
                formatValue={(value) => formatCompactNumber(value, units.language)}
              />
            )
          )}
        </>
      )}

      <Button
        label={t.stats.chooseExercises}
        icon={ListChecks}
        variant="secondary"
        onPress={() => router.push('/stats/exercises')}
      />
    </Section>
  );
}

// How many workouts trained each muscle group in the period, each group in its own colour.
function Volume({
  from,
  today,
  range,
}: {
  from: LocalDate | null;
  today: LocalDate;
  range: StatsRange;
}) {
  const { t } = useI18n();
  const groups = useVolumeByMuscleGroup(from, today);
  const most = Math.max(1, ...(groups.data ?? []).map((group) => group.workoutCount));

  return (
    <Section
      title={t.stats.muscleTitle}
      hint={interpolate(t.stats.muscleHint, { period: t.stats.periodsShort[range] })}
    >
      {groups.isError && (
        <QueryError
          error={groups.error}
          retry={() => void groups.refetch()}
          retrying={groups.isFetching}
        />
      )}
      {groups.isPending && <AppText color="muted">{t.common.loading}</AppText>}
      {groups.isSuccess && groups.data.length === 0 && (
        <AppText color="muted">{t.stats.empty}</AppText>
      )}
      {groups.data?.map((group) => {
        const name = muscleGroupLabel(t, group.muscleGroup);
        const color = muscleGroupColor[group.muscleGroup];
        const workouts =
          group.workoutCount === 1
            ? t.stats.workoutsCountOne
            : interpolate(t.stats.workoutsCount, { count: group.workoutCount });
        return (
          <View
            key={group.muscleGroup}
            style={styles.muscleRow}
            accessible
            accessibilityLabel={`${name}: ${workouts}`}
          >
            <View style={styles.muscleName}>
              <View style={[styles.dot, { backgroundColor: colors[color] }]} />
              <AppText numberOfLines={1} style={styles.flex}>
                {name}
              </AppText>
            </View>
            <View style={styles.muscleBar}>
              <ProgressBar
                value={group.workoutCount / most}
                color={color}
                accessibilityLabel={`${name}: ${workouts}`}
              />
            </View>
            <AppText variant="numeric" style={styles.count}>
              {String(group.workoutCount)}
            </AppText>
          </View>
        );
      })}
    </Section>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing[4],
  },
  ranges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
  },
  sectionTitle: {
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
  statValue: {
    fontSize: typography.title.fontSize,
    lineHeight: typography.title.lineHeight,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
  },
  muscleRow: {
    minHeight: sizes.minTouch,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  muscleName: {
    width: '38%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  dot: {
    width: spacing[3],
    height: spacing[3],
    borderRadius: radii.pill,
  },
  muscleBar: {
    flex: 1,
  },
  count: {
    minWidth: spacing[6],
    textAlign: 'right',
  },
  flex: {
    flex: 1,
  },
});
