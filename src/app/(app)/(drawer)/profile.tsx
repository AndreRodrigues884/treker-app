import Constants from 'expo-constants';
import { router, type Href } from 'expo-router';
import { LayoutGrid, Languages, LogOut, Mail, Shield, Trash2 } from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText, Button, ListRow, Screen } from '@/components';
import { formatWeight } from '@/core/format';
import { interpolate } from '@/core/i18n';
import type { StepId } from '@/core/onboarding';
import { fromKilograms } from '@/core/units';
import { useAuth } from '@/features/auth/auth-provider';
import { StartWorkoutButton } from '@/features/navigation/start-workout-button';
import {
  gymFocusLabels,
  poolLengthLabels,
  sportLabel,
  swimStyleLabels,
} from '@/features/onboarding/labels';
import { useI18n, useLanguageSettings } from '@/lib/i18n';
import { links, openLink } from '@/lib/links';
import { spacing } from '@/theme';

function editHref(step: Exclude<StepId, 'summary'>): Href {
  return { pathname: '/settings/edit', params: { step } };
}

export default function ProfileScreen() {
  const { t, language } = useI18n();
  const { preference } = useLanguageSettings();
  const { profile, session, signOut } = useAuth();
  const [signingOut, setSigningOut] = useState(false);

  if (!profile) return <Screen belowHeader>{null}</Screen>;

  const labels = t.onboarding.summary;
  const sports = profile.sports ?? [];
  const gym = sports.includes('gym');
  const swim = sports.includes('swim');
  const version = Constants.expoConfig?.version ?? '?';

  return (
    <Screen scroll belowHeader floating={<StartWorkoutButton />}>
      <View style={styles.content}>
        <View style={styles.header}>
          <AppText variant="title" accessibilityRole="header">
            {profile.display_name ?? t.nav.profile}
          </AppText>
          {session?.user.email ? <AppText color="muted">{session.user.email}</AppText> : null}
        </View>

        <Section title={t.profile.training}>
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
            label={t.profile.units}
            value={profile.weight_unit}
            onPress={() => router.push(editHref('units'))}
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
        </Section>

        <Section title={t.profile.app}>
          <ListRow
            label={t.language.title}
            icon={Languages}
            value={preference === 'auto' ? t.language.auto : t.language[preference]}
            onPress={() => router.push('/settings/language')}
          />
        </Section>

        <Section title={t.profile.support}>
          <ListRow
            label={t.profile.privacy}
            icon={Shield}
            kind="link"
            onPress={() => openLink(links.privacyPolicy)}
          />
          <ListRow
            label={t.profile.contact}
            icon={Mail}
            kind="link"
            onPress={() => openLink(links.contact)}
          />
        </Section>

        <Section title={t.profile.account}>
          <Button
            label={t.profile.signOut}
            variant="secondary"
            icon={LogOut}
            loading={signingOut}
            fullWidth
            onPress={async () => {
              setSigningOut(true);
              await signOut();
            }}
          />
          <ListRow
            label={t.profile.deleteAccount}
            icon={Trash2}
            kind="danger"
            onPress={() => router.push('/settings/delete-account')}
          />
        </Section>

        {__DEV__ && (
          // Dev-only tools, so their labels are not translated.
          <Section title="Development">
            <ListRow
              label="Component catalog"
              icon={LayoutGrid}
              onPress={() => router.push('/dev/components')}
            />
          </Section>
        )}

        <AppText variant="caption" color="dim" align="center">
          {interpolate(t.profile.version, { version })}
        </AppText>
      </View>
    </Screen>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <AppText variant="caption" color="muted" accessibilityRole="header">
        {title}
      </AppText>
      <View>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing[6],
  },
  header: {
    gap: spacing[1],
  },
  section: {
    gap: spacing[2],
  },
});
