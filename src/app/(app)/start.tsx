import { router } from 'expo-router';
import { ClipboardList, Dumbbell, Plus, Waves, X } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText, Button, ErrorNotice, OptionCard, Screen } from '@/components';
import { classifyRequestError } from '@/core/errors';
import { interpolate } from '@/core/i18n';
import type { Sport } from '@/core/onboarding';
import { useAuth } from '@/features/auth/auth-provider';
import { sportLabel } from '@/features/onboarding/labels';
import { useStartGymSession } from '@/features/session/queries';
import { useTemplates } from '@/features/templates/queries';
import type { TemplateWithExercises } from '@/features/templates/repository';
import { useI18n } from '@/lib/i18n';
import { spacing } from '@/theme';

const sportIcons = { gym: Dumbbell, swim: Waves } as const;

// Opened by the "+" button. Shows only the sports chosen in onboarding. Gym lists the saved
// workouts and "Empty workout"; either starts the gym session (its sets filled in from last time)
// and opens it. Swimming arrives later.
export default function StartWorkoutScreen() {
  const { t } = useI18n();
  const { profile } = useAuth();
  const [picked, setPicked] = useState<Sport | null>(null);
  const sports = profile?.sports ?? [];

  return (
    <Screen scroll>
      <View style={styles.content}>
        <View style={styles.top}>
          <Button label={t.common.close} variant="ghost" icon={X} onPress={() => router.back()} />
        </View>
        <View style={styles.header}>
          <AppText variant="title" accessibilityRole="header">
            {t.start.title}
          </AppText>
          <AppText color="muted">{t.start.subtitle}</AppText>
        </View>
        {sports.map((sport) => (
          <OptionCard
            key={sport}
            title={sportLabel(t, sport)}
            icon={sportIcons[sport]}
            tone={sport}
            selected={picked === sport}
            onPress={() => setPicked(sport)}
          />
        ))}
        {picked === 'gym' && <GymWorkouts />}
        {picked === 'swim' && (
          <AppText color="muted" accessibilityLiveRegion="polite">
            {t.start.comingSoon}
          </AppText>
        )}
      </View>
    </Screen>
  );
}

// The saved workouts, then "Empty workout".
function GymWorkouts() {
  const { t } = useI18n();
  const templates = useTemplates();
  const start = useStartGymSession();

  // Starts the session, closes this modal, then opens the session.
  const open = (template: TemplateWithExercises | null) => {
    start.mutate(template, {
      onSuccess: () => {
        router.back();
        router.push('/session');
      },
    });
  };

  return (
    <View style={styles.header}>
      <AppText variant="heading" accessibilityRole="header">
        {t.start.gymTitle}
      </AppText>
      {templates.isError && (
        <ErrorNotice
          message={t.common.errors[classifyRequestError(templates.error)]}
          network={classifyRequestError(templates.error) === 'network'}
          onRetry={() => templates.refetch()}
          retryLabel={t.common.retry}
          retrying={templates.isFetching}
        />
      )}
      {start.error && (
        <ErrorNotice
          message={t.common.errors[classifyRequestError(start.error)]}
          network={classifyRequestError(start.error) === 'network'}
          onRetry={() => start.variables !== undefined && open(start.variables)}
          retryLabel={t.common.retry}
          retrying={start.isPending}
        />
      )}
      {(templates.isPending || start.isPending) && (
        <AppText color="muted" accessibilityLiveRegion="polite">
          {t.common.loading}
        </AppText>
      )}
      {templates.data?.map((entry) => {
        const { template, exercises } = entry;
        return (
          <OptionCard
            key={template.id}
            title={template.name}
            description={
              exercises.length === 1
                ? t.workouts.exerciseCountOne
                : interpolate(t.workouts.exerciseCount, { count: exercises.length })
            }
            icon={ClipboardList}
            selected={false}
            onPress={() => open(entry)}
          />
        );
      })}
      <OptionCard
        title={t.session.emptyWorkout}
        description={t.start.emptyWorkoutHint}
        icon={Plus}
        selected={false}
        onPress={() => open(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing[4],
  },
  top: {
    alignItems: 'flex-end',
  },
  header: {
    gap: spacing[2],
  },
});
