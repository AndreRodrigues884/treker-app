import { Activity, Dumbbell, Waves } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { AppText, EmptyState, ErrorNotice, Icon } from '@/components';
import { localDateOf } from '@/core/dates';
import { classifyRequestError } from '@/core/errors';
import { formatLocalDate } from '@/core/format';
import { useRecentActivities } from '@/features/activities/queries';
import type { ActivityRow } from '@/features/activities/repository';
import { sportLabel } from '@/features/onboarding/labels';
import { getDeviceTimezone } from '@/lib/device';
import { useI18n } from '@/lib/i18n';
import { accentTints, colors, radii, sizes, spacing } from '@/theme';

import { Section } from './section';

const sportIcons = { gym: Dumbbell, swim: Waves } as const;

// The athlete's latest workouts, gym and swimming together, newest first. Each row will open the
// workout once sessions are logged (phase 1b).
export function RecentWorkouts() {
  const { t } = useI18n();
  const recent = useRecentActivities();
  const today = localDateOf(new Date(), getDeviceTimezone());

  return (
    <Section title={t.profile.recentWorkouts}>
      {recent.isError && (
        <ErrorNotice
          message={t.common.errors[classifyRequestError(recent.error)]}
          network={classifyRequestError(recent.error) === 'network'}
          onRetry={() => recent.refetch()}
          retryLabel={t.common.retry}
          retrying={recent.isFetching}
        />
      )}
      {recent.isPending && <AppText color="muted">{t.common.loading}</AppText>}
      {recent.data?.length === 0 && (
        <EmptyState
          icon={Activity}
          title={t.profile.recentEmptyTitle}
          body={t.profile.recentEmptyBody}
        />
      )}
      {recent.data?.map((activity) => (
        <WorkoutRow key={activity.id} activity={activity} today={today} />
      ))}
    </Section>
  );
}

function WorkoutRow({ activity, today }: { activity: ActivityRow; today: string }) {
  const { t, language } = useI18n();
  const sport = sportLabel(t, activity.type);
  const title = activity.title?.trim() || sport;
  const date = formatLocalDate(activity.local_date, language, today);

  return (
    <View style={styles.row} accessible accessibilityLabel={`${title}, ${sport}, ${date}`}>
      <View style={[styles.icon, { backgroundColor: colors[accentTints[activity.type]] }]}>
        <Icon icon={sportIcons[activity.type]} color={activity.type} />
      </View>
      <View style={styles.text}>
        <AppText variant="heading" numberOfLines={1}>
          {title}
        </AppText>
        <AppText variant="caption" color="muted">
          {title === sport ? date : `${sport} · ${date}`}
        </AppText>
      </View>
    </View>
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
});
