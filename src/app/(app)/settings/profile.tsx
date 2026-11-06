import { router, type Href } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { AppText, Button, ListRow, Screen } from '@/components';
import { formatWeight } from '@/core/format';
import { interpolate } from '@/core/i18n';
import type { StepId } from '@/core/onboarding';
import { fromKilograms } from '@/core/units';
import { useAuth } from '@/features/auth/auth-provider';
import {
  gymFocusLabels,
  poolLengthLabels,
  sportLabel,
  swimStyleLabels,
} from '@/features/onboarding/labels';
import { useI18n } from '@/lib/i18n';
import { spacing } from '@/theme';

function editHref(step: Exclude<StepId, 'summary'>): Href {
  return { pathname: '/settings/edit', params: { step } };
}

// Edit profile: the questionnaire answers, one row each. Each opens the same question as the
// onboarding (settings/edit), with the same validation.
export default function EditProfileScreen() {
  const { t, language } = useI18n();
  const { profile } = useAuth();
  const labels = t.onboarding.summary;

  const back = (
    <View style={styles.top}>
      <Button
        label={t.common.back}
        variant="ghost"
        icon={ArrowLeft}
        onPress={() => router.back()}
      />
    </View>
  );

  if (!profile) return <Screen>{back}</Screen>;

  const sports = profile.sports ?? [];
  const gym = sports.includes('gym');
  const swim = sports.includes('swim');

  return (
    <Screen scroll>
      <View style={styles.content}>
        {back}
        <AppText variant="title" accessibilityRole="header">
          {t.profile.editProfile}
        </AppText>

        <View>
          <ListRow
            label={t.profile.name}
            value={profile.display_name ?? ''}
            onPress={() => router.push(editHref('name'))}
          />
          <ListRow
            label={labels.sports}
            value={sports.map((sport) => sportLabel(t, sport)).join(', ')}
            onPress={() => router.push(editHref('sports'))}
          />
          {gym && profile.gym_focus && (
            <ListRow
              label={labels.gymFocus}
              value={gymFocusLabels(t)[profile.gym_focus].title}
              onPress={() => router.push(editHref('gymFocus'))}
            />
          )}
          {swim && profile.swim_style && (
            <ListRow
              label={labels.swimStyle}
              value={swimStyleLabels(t)[profile.swim_style].title}
              onPress={() => router.push(editHref('swimStyle'))}
            />
          )}
          {swim && profile.default_pool_length && (
            <ListRow
              label={labels.pool}
              value={poolLengthLabels(t)[profile.default_pool_length].title}
              onPress={() => router.push(editHref('poolLength'))}
            />
          )}
          <ListRow
            label={labels.weeklyTarget}
            value={
              profile.weekly_target !== null
                ? interpolate(t.onboarding.weeklyTarget.value, { count: profile.weekly_target })
                : undefined
            }
            onPress={() => router.push(editHref('weeklyTarget'))}
          />
          <ListRow
            label={labels.bodyweight}
            value={
              profile.bodyweight_kg === null
                ? labels.notSet
                : formatWeight(
                    fromKilograms(profile.bodyweight_kg, profile.weight_unit),
                    profile.weight_unit,
                    language,
                  )
            }
            onPress={() => router.push(editHref('units'))}
          />
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing[5],
  },
  top: {
    alignItems: 'flex-start',
  },
});
