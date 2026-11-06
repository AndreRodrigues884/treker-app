import { router } from 'expo-router';
import { Activity, ChevronRight, Dumbbell, Waves } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText, Button, EmptyState, ErrorNotice, Icon } from '@/components';
import type { ActivitySummary } from '@/core/activities';
import { localDateOf } from '@/core/dates';
import { classifyRequestError } from '@/core/errors';
import { formatDuration, formatLocalDate } from '@/core/format';
import { interpolate } from '@/core/i18n';
import {
  workoutAmount,
  workoutCount,
  workoutTitle,
  type DisplayUnits,
} from '@/features/activities/labels';
import { useActivitySummaries } from '@/features/activities/queries';
import { useAuth } from '@/features/auth/auth-provider';
import { getDeviceTimezone } from '@/lib/device';
import { useI18n } from '@/lib/i18n';
import { accentTints, colors, opacity, radii, sizes, spacing } from '@/theme';

import { Section } from './section';

const sportIcons = { gym: Dumbbell, swim: Waves } as const;

/**
 * The athlete's workouts, gym and swimming together, newest first, like an activity feed. Each row
 * shows the title, date, duration, sets and volume (or distance), and opens the workout. Loads one
 * page at a time ("Show more"), never the whole history.
 */
export function RecentWorkouts() {
  const { t, language } = useI18n();
  const { profile } = useAuth();
  const summaries = useActivitySummaries();
  const today = localDateOf(new Date(), getDeviceTimezone());
  const workouts = summaries.data?.pages.flat() ?? [];
  const units: DisplayUnits = {
    weight: profile?.weight_unit ?? 'kg',
    distance: profile?.pool_unit ?? 'm',
    language,
  };

  return (
    <Section title={t.profile.recentWorkouts}>
      {summaries.isError && (
        <ErrorNotice
          message={t.common.errors[classifyRequestError(summaries.error)]}
          network={classifyRequestError(summaries.error) === 'network'}
          onRetry={() => summaries.refetch()}
          retryLabel={t.common.retry}
          retrying={summaries.isFetching}
        />
      )}
      {summaries.isPending && <AppText color="muted">{t.common.loading}</AppText>}
      {summaries.isSuccess && workouts.length === 0 && (
        <EmptyState
          icon={Activity}
          title={t.profile.recentEmptyTitle}
          body={t.profile.recentEmptyBody}
        />
      )}
      {workouts.map((workout) => (
        <WorkoutRow key={workout.id} workout={workout} today={today} units={units} />
      ))}
      {summaries.hasNextPage && (
        <View style={styles.more}>
          <Button
            label={t.workout.showMore}
            variant="secondary"
            fullWidth
            loading={summaries.isFetchingNextPage}
            onPress={() => summaries.fetchNextPage()}
          />
        </View>
      )}
    </Section>
  );
}

function WorkoutRow({
  workout,
  today,
  units,
}: {
  workout: ActivitySummary;
  today: string;
  units: DisplayUnits;
}) {
  const { t } = useI18n();
  const title = workoutTitle(t, workout.type, workout.title);
  const when = [
    formatLocalDate(workout.localDate, units.language, today),
    workout.durationS !== null ? formatDuration(workout.durationS) : null,
  ]
    .filter(Boolean)
    .join(' · ');
  const amount = [workoutCount(t, workout.type, workout.setCount), workoutAmount(workout, units)]
    .filter(Boolean)
    .join(' · ');

  return (
    <Pressable
      onPress={() => router.push({ pathname: '/activities/[id]', params: { id: workout.id } })}
      accessibilityRole="button"
      accessibilityLabel={`${interpolate(t.workout.open, { title })}, ${when}, ${amount}`}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <View style={[styles.icon, { backgroundColor: colors[accentTints[workout.type]] }]}>
        <Icon icon={sportIcons[workout.type]} color={workout.type} />
      </View>
      <View style={styles.text}>
        <AppText variant="heading" numberOfLines={1}>
          {title}
        </AppText>
        <AppText variant="caption" color="muted">
          {when}
        </AppText>
        <AppText variant="numeric" color="textSoft">
          {amount}
        </AppText>
      </View>
      <Icon icon={ChevronRight} size="sm" color="dim" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
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
  icon: {
    width: sizes.minTouch,
    height: sizes.minTouch,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    flex: 1,
    gap: spacing[1],
  },
  more: {
    paddingTop: spacing[3],
  },
});
