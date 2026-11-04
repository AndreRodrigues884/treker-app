import { router } from 'expo-router';
import { LayoutGrid, LogOut } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText, Button, Screen } from '@/components';
import { interpolate } from '@/core/i18n';
import { useAuth } from '@/features/auth/auth-provider';
import { useI18n } from '@/lib/i18n';
import { spacing } from '@/theme';

// Provisional home screen until the real app screens arrive.
export default function HomeScreen() {
  const { t } = useI18n();
  const { profile, signOut } = useAuth();
  const [signingOut, setSigningOut] = useState(false);

  const name = profile?.display_name;

  return (
    <Screen centered>
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
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    alignItems: 'center',
    gap: spacing[2],
    marginBottom: spacing[8],
  },
  actions: {
    alignItems: 'center',
    gap: spacing[2],
  },
});
