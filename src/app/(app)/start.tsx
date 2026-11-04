import { router } from 'expo-router';
import { Dumbbell, Waves, X } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText, Button, OptionCard, Screen } from '@/components';
import type { Sport } from '@/core/onboarding';
import { useAuth } from '@/features/auth/auth-provider';
import { sportLabel } from '@/features/onboarding/labels';
import { useI18n } from '@/lib/i18n';
import { spacing } from '@/theme';

const sportIcons = { gym: Dumbbell, swim: Waves } as const;

// PROVISIONAL: opened by the "+" tab button. Shows only the sports chosen in onboarding; logging
// a workout arrives in the next phase.
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
        {picked !== null && (
          <AppText color="muted" accessibilityLiveRegion="polite">
            {t.start.comingSoon}
          </AppText>
        )}
      </View>
    </Screen>
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
