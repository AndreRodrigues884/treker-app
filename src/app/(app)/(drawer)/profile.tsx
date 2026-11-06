import { router } from 'expo-router';
import { Dumbbell, LogOut, Pencil, Settings, Trash2, Waves } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText, Avatar, Badge, Button, ListRow, Screen } from '@/components';
import { useAuth } from '@/features/auth/auth-provider';
import { StartWorkoutButton } from '@/features/navigation/start-workout-button';
import { sportLabel } from '@/features/onboarding/labels';
import { RecentWorkouts } from '@/features/profile/recent-workouts';
import { Section } from '@/features/profile/section';
import { useI18n } from '@/lib/i18n';
import { spacing } from '@/theme';

const sportIcons = { gym: Dumbbell, swim: Waves } as const;

// "Me": the picture (initials for now), name and sports, then the latest workouts, like an
// activity feed. The questionnaire answers are in Edit profile; units, language and links in
// Settings. Signing out and deleting the account are at the bottom.
export default function ProfileScreen() {
  const { t } = useI18n();
  const { profile } = useAuth();

  // The profile could not be loaded (no connection): signing out is always possible.
  if (!profile) {
    return (
      <Screen scroll belowHeader>
        <AccountActions />
      </Screen>
    );
  }

  const sports = profile.sports ?? [];

  return (
    <Screen scroll belowHeader floating={<StartWorkoutButton />}>
      <View style={styles.content}>
        <View style={styles.identity}>
          <Avatar name={profile.display_name} />
          <AppText variant="title" accessibilityRole="header" align="center">
            {profile.display_name ?? t.nav.profile}
          </AppText>
          {sports.length > 0 && (
            <View style={styles.sports}>
              {sports.map((sport) => (
                <Badge
                  key={sport}
                  label={sportLabel(t, sport)}
                  tone={sport}
                  icon={sportIcons[sport]}
                />
              ))}
            </View>
          )}
        </View>

        <View style={styles.actions}>
          <Button
            label={t.profile.editProfile}
            icon={Pencil}
            variant="secondary"
            onPress={() => router.push('/settings/profile')}
          />
          <Button
            label={t.profile.settings}
            icon={Settings}
            variant="secondary"
            onPress={() => router.push('/settings')}
          />
        </View>

        <RecentWorkouts />

        <AccountActions />
      </View>
    </Screen>
  );
}

function AccountActions() {
  const { t } = useI18n();
  const { signOut } = useAuth();
  const [signingOut, setSigningOut] = useState(false);

  return (
    <Section title={t.profile.account}>
      <View style={styles.account}>
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
      </View>
    </Section>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing[6],
  },
  identity: {
    alignItems: 'center',
    gap: spacing[2],
  },
  sports: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing[2],
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing[3],
  },
  account: {
    gap: spacing[2],
  },
});
