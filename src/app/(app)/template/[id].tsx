import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, BarChart3, Pencil, Play } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  AppText,
  Button,
  Card,
  Chip,
  EmptyState,
  ErrorNotice,
  Icon,
  Screen,
  TrendChart,
  type TrendChartPoint,
} from '@/components';
import { localDateOf } from '@/core/dates';
import { classifyRequestError } from '@/core/errors';
import { exerciseName } from '@/core/exercises';
import { formatCompactNumber, formatLocalDate, formatShortDate } from '@/core/format';
import { interpolate } from '@/core/i18n';
import { groupTemplateProgress, type TemplateExerciseSeries } from '@/core/progress';
import { fromKilograms } from '@/core/units';
import { useAuth, useDataContext } from '@/features/auth/auth-provider';
import { useExercises } from '@/features/exercises/queries';
import { useStartGymSession } from '@/features/session/queries';
import { useActiveSession } from '@/features/session/session-store';
import { progressValueText, resultColor, type ProgressUnits } from '@/features/stats/labels';
import { resultIcon } from '@/features/stats/progress-indicator';
import { useTemplateProgress, useTemplateUsage } from '@/features/stats/queries';
import { useTemplate } from '@/features/templates/queries';
import { getDeviceTimezone } from '@/lib/device';
import { useI18n } from '@/lib/i18n';
import { colors, radii, sizes, spacing, typography } from '@/theme';

/**
 * A saved workout: its name, how many times it was done and when last, "Start" and "Edit", then
 * the overall result of its last workouts (a strip, oldest first) and, per exercise, a bar chart of
 * the measure in those workouts with an arrow above each bar against the bar before
 * (template_progress). Opened from the Workouts list and the Statistics screen.
 */
export default function SavedWorkoutScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, language } = useI18n();
  const { profile } = useAuth();
  const ctx = useDataContext();
  const today = localDateOf(new Date(), getDeviceTimezone());
  const template = useTemplate(id);
  const usage = useTemplateUsage(null, today);
  const progress = useTemplateProgress(id);
  const exercises = useExercises();
  const active = useActiveSession(ctx.userId);
  const start = useStartGymSession();
  const units: ProgressUnits = { weight: profile?.weight_unit ?? 'kg', language };

  const used = usage.data?.find((row) => row.templateId === id);
  const grouped = useMemo(() => groupTemplateProgress(progress.data ?? []), [progress.data]);
  const byId = useMemo(
    () => new Map((exercises.data ?? []).map((exercise) => [exercise.id, exercise])),
    [exercises.data],
  );
  const failure = template.error ?? progress.error ?? usage.error;

  const startWorkout = () => {
    // One workout at a time: with one in progress, open it instead.
    if (active) {
      router.push('/session');
      return;
    }
    if (!template.data) return;
    start.mutate(template.data, { onSuccess: () => router.push('/session') });
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
        </View>

        {failure && (
          <ErrorNotice
            message={t.common.errors[classifyRequestError(failure)]}
            network={classifyRequestError(failure) === 'network'}
            onRetry={() => {
              void template.refetch();
              void progress.refetch();
              void usage.refetch();
            }}
            retryLabel={t.common.retry}
            retrying={template.isFetching || progress.isFetching || usage.isFetching}
          />
        )}
        {template.isPending && <AppText color="muted">{t.common.loading}</AppText>}
        {template.isSuccess && template.data === null && (
          <AppText color="muted">{t.savedWorkout.notFound}</AppText>
        )}

        {template.data && (
          <>
            <View style={styles.header}>
              <AppText variant="title" accessibilityRole="header">
                {template.data.template.name}
              </AppText>
              {used && (
                <AppText color="muted">
                  {[
                    used.workoutCount === 1
                      ? t.savedWorkout.timesDoneOne
                      : interpolate(t.savedWorkout.timesDone, { count: used.workoutCount }),
                    interpolate(t.savedWorkout.lastDone, {
                      date: formatLocalDate(used.lastDate, language, today),
                    }),
                  ].join(' · ')}
                </AppText>
              )}
              {usage.isSuccess && !used && <AppText color="muted">{t.savedWorkout.never}</AppText>}
            </View>
            <View style={styles.actions}>
              <Button
                label={t.savedWorkout.start}
                icon={Play}
                loading={start.isPending}
                onPress={startWorkout}
              />
              <Button
                label={t.savedWorkout.edit}
                icon={Pencil}
                variant="secondary"
                onPress={() => router.push({ pathname: '/templates/[id]', params: { id } })}
              />
            </View>
            {start.error && (
              <ErrorNotice
                message={t.common.errors[classifyRequestError(start.error)]}
                network={classifyRequestError(start.error) === 'network'}
                onRetry={startWorkout}
                retryLabel={t.common.retry}
                retrying={start.isPending}
              />
            )}
          </>
        )}

        {progress.isSuccess && grouped.sessions.length === 0 && (
          <EmptyState
            icon={BarChart3}
            title={t.savedWorkout.emptyTitle}
            body={t.savedWorkout.emptyBody}
          />
        )}

        {grouped.sessions.length > 0 && (
          <View style={styles.section}>
            <AppText variant="heading" accessibilityRole="header">
              {t.savedWorkout.sessions}
            </AppText>
            {/* The overall result of each workout, oldest first. */}
            <View style={styles.strip}>
              {grouped.sessions.map((session) => (
                <View
                  key={session.activityId}
                  style={[styles.session, { borderColor: colors[resultColor[session.result]] }]}
                  accessible
                  accessibilityLabel={`${formatLocalDate(session.localDate, language, today)}: ${
                    t.progress.results[session.result]
                  }`}
                >
                  <Icon
                    icon={resultIcon[session.result]}
                    size="sm"
                    color={resultColor[session.result]}
                  />
                  <AppText variant="caption" color="muted">
                    {formatShortDate(session.localDate, language)}
                  </AppText>
                </View>
              ))}
            </View>
          </View>
        )}

        {grouped.exercises.length > 0 && (
          <View style={styles.section}>
            <AppText variant="heading" accessibilityRole="header">
              {t.savedWorkout.exercises}
            </AppText>
            <ExerciseChart
              exercises={grouped.exercises.map((series) => {
                const exercise = byId.get(series.exerciseId);
                return {
                  name: exercise
                    ? exerciseName(exercise, language)
                    : t.templateEditor.unknownExercise,
                  series,
                };
              })}
              units={units}
            />
          </View>
        )}
      </View>
    </Screen>
  );
}

/**
 * One chart for all the exercises: the chips choose the exercise, and the bars show its measure in
 * the last workouts, an arrow above each against the bar before. Tapping a bar shows its exact
 * value (the latest one at first); the best of the bars is beside it.
 */
function ExerciseChart({
  exercises,
  units,
}: {
  exercises: { name: string; series: TemplateExerciseSeries }[];
  units: ProgressUnits;
}) {
  const { t } = useI18n();
  const [chosenId, setChosenId] = useState<string | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const current =
    exercises.find((item) => item.series.exerciseId === chosenId) ??
    (exercises[0] as {
      name: string;
      series: TemplateExerciseSeries;
    });
  const { name, series } = current;
  const lastIndex = series.points.length - 1;
  const index = selected !== null && selected <= lastIndex ? selected : lastIndex;
  const point = series.points[index];
  const value = (amount: number) => progressValueText(t, series.measure, amount, units);
  const best = series.points.reduce(
    (top, item) => (item.value > top ? item.value : top),
    series.points[0]?.value ?? 0,
  );

  const shown = (amount: number) =>
    series.measure === 'duration' ? amount : fromKilograms(amount, units.weight);
  const points: TrendChartPoint[] = series.points.map((item) => ({
    value: shown(item.value),
    label: formatShortDate(item.localDate, units.language),
    color: resultColor[item.result],
    topIcon: { icon: resultIcon[item.result], color: resultColor[item.result] },
  }));
  const summary = interpolate(t.savedWorkout.chartSummary, {
    name,
    measure: t.progress.measures[series.measure],
    count: series.points.length,
    list: series.points
      .map(
        (item) =>
          `${formatShortDate(item.localDate, units.language)} ${value(item.value)} ${
            t.progress.results[item.result]
          }`,
      )
      .join(', '),
  });

  return (
    <Card>
      <AppText variant="heading" accessibilityRole="header">
        {t.progress.measures[series.measure]}
      </AppText>
      <View
        style={styles.chips}
        accessibilityRole="radiogroup"
        accessibilityLabel={t.savedWorkout.exercise}
      >
        {exercises.map((item) => (
          <Chip
            key={item.series.exerciseId}
            label={item.name}
            selected={item.series.exerciseId === series.exerciseId}
            onPress={() => {
              setChosenId(item.series.exerciseId);
              setSelected(null);
            }}
          />
        ))}
      </View>

      {point && (
        <View style={styles.values}>
          <View
            style={styles.value}
            accessible
            accessibilityLiveRegion="polite"
            accessibilityLabel={`${formatShortDate(point.localDate, units.language)}: ${value(
              point.value,
            )}, ${t.progress.results[point.result]}`}
          >
            <AppText variant="caption" color="muted">
              {formatShortDate(point.localDate, units.language)}
            </AppText>
            <View style={styles.valueLine}>
              <AppText variant="numeric" color={resultColor[point.result]} style={styles.big}>
                {value(point.value)}
              </AppText>
              <Icon icon={resultIcon[point.result]} size="sm" color={resultColor[point.result]} />
            </View>
          </View>
          <View
            style={styles.value}
            accessible
            accessibilityLabel={`${t.savedWorkout.best}: ${value(best)}`}
          >
            <AppText variant="caption" color="muted">
              {t.savedWorkout.best}
            </AppText>
            <AppText variant="numeric" style={styles.big}>
              {value(best)}
            </AppText>
          </View>
        </View>
      )}

      <TrendChart
        kind="bar"
        points={points}
        summary={summary}
        formatValue={(amount) => formatCompactNumber(amount, units.language)}
        selectedIndex={index}
        onSelect={setSelected}
      />
      <AppText variant="caption" color="muted">
        {t.savedWorkout.tapHint}
      </AppText>
    </Card>
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
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[3],
  },
  section: {
    gap: spacing[3],
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
  },
  values: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[6],
  },
  value: {
    gap: spacing[1],
  },
  valueLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  big: {
    fontSize: typography.heading.fontSize,
    lineHeight: typography.heading.lineHeight,
  },
  strip: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
  },
  session: {
    minWidth: sizes.minTouch,
    minHeight: sizes.minTouch,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[1],
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
    borderRadius: radii.md,
    borderWidth: sizes.border,
    backgroundColor: colors.surface,
  },
});
