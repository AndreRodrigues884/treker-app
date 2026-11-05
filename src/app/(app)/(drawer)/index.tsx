import { Dumbbell } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { AppText, Card, EmptyState, ProgressBar, Screen } from '@/components';
import { interpolate } from '@/core/i18n';
import { useWorkoutsThisWeek } from '@/features/activities/use-workouts-this-week';
import { useAuth } from '@/features/auth/auth-provider';
import { StartWorkoutButton } from '@/features/navigation/start-workout-button';
import { useI18n } from '@/lib/i18n';
import { spacing } from '@/theme';

// "Today": the athlete's name and weekly goal. The rest of its content (adapted to the onboarding
// answers) comes in the next phases.
export default function TodayScreen() {
  const { t } = useI18n();
  const { profile } = useAuth();
  const done = useWorkoutsThisWeek() ?? 0;
  const target = profile?.weekly_target ?? null;
  const progressText =
    target !== null ? interpolate(t.today.weeklyProgress, { done, target }) : null;

  return (
    <Screen scroll belowHeader floating={<StartWorkoutButton />}>
      <View style={styles.content}>
        <AppText variant="title" accessibilityRole="header">
          {interpolate(t.today.greeting, { name: profile?.display_name ?? '' })}
        </AppText>

        {progressText !== null && target !== null && (
          <Card>
            <AppText variant="caption" color="muted">
              {t.today.weeklyGoal}
            </AppText>
            <AppText variant="heading">{progressText}</AppText>
            <ProgressBar value={done / target} accessibilityLabel={progressText} />
          </Card>
        )}

        <EmptyState icon={Dumbbell} title={t.today.emptyTitle} body={t.today.emptyBody} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing[5],
  },
});
