import { router } from 'expo-router';
import { LayoutGrid, LogOut } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText, Button, Screen } from '@/components';
import { interpolate } from '@/core/i18n';
import { useAuth } from '@/features/auth/auth-provider';
import { ChoicesSummary } from '@/features/onboarding/choices-summary';
import { profileChoices } from '@/features/profile/api';
import { useI18n } from '@/lib/i18n';
import { spacing } from '@/theme';

// Provisional home screen until the real one is built (it will adapt to the onboarding answers;
// see docs/plano-produto.md). For now it shows the saved answers.
export default function HomeScreen() {
  const { t } = useI18n();
  const { profile, signOut } = useAuth();
  const [signingOut, setSigningOut] = useState(false);

  const name = profile?.display_name;
  const choices = profile ? profileChoices(profile) : null;

  return (
    <Screen scroll>
      <View style={styles.content}>
        <View style={styles.hero}>
          <AppText variant="display" accessibilityRole="header">
            Treker
          </AppText>
          {name ? (
            <AppText variant="heading" align="center">
              {interpolate(t.home.greeting, { name })}
            </AppText>
          ) : null}
          <AppText color="muted" align="center">
            {t.home.tagline}
          </AppText>
        </View>

        {choices && (
          <View style={styles.choices}>
            <AppText variant="heading" accessibilityRole="header">
              {t.home.choicesTitle}
            </AppText>
            <ChoicesSummary choices={choices} />
          </View>
        )}

        <View style={styles.actions}>
          <Button
            label={t.home.signOut}
            variant="secondary"
            icon={LogOut}
            loading={signingOut}
            onPress={async () => {
              setSigningOut(true);
              await signOut();
            }}
          />
          {__DEV__ && (
            // Dev-only tool, so its label is not translated.
            <Button
              label="Component catalog"
              variant="ghost"
              icon={LayoutGrid}
              onPress={() => router.push('/dev/components')}
            />
          )}
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing[8],
    paddingVertical: spacing[6],
  },
  hero: {
    alignItems: 'center',
    gap: spacing[2],
  },
  choices: {
    gap: spacing[3],
  },
  actions: {
    alignItems: 'center',
    gap: spacing[2],
  },
});
