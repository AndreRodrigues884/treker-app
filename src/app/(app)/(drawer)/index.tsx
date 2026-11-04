import { Dumbbell } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { AppText, Card, EmptyState, ProgressBar, Screen } from '@/components';
import { interpolate } from '@/core/i18n';
import { useAuth } from '@/features/auth/auth-provider';
import { StartWorkoutButton } from '@/features/navigation/start-workout-button';
import { useI18n } from '@/lib/i18n';
import { spacing } from '@/theme';

// Workouts are logged from the next phase on; until then the week starts at zero.
const WORKOUTS_THIS_WEEK = 0;

// "Today": the athlete's name and weekly goal. The rest of its content (adapted to the onboarding
// answers) comes in the next phases.
export default function TodayScreen() {
  const { t } = useI18n();
  const { profile } = useAuth();
  const target = profile?.weekly_target ?? null;
  const progressText =
    target !== null
      ? interpolate(t.today.weeklyProgress, { done: WORKOUTS_THIS_WEEK, target })
      : null;

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
            <ProgressBar value={WORKOUTS_THIS_WEEK / target} accessibilityLabel={progressText} />
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
