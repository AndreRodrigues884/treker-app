import { router } from 'expo-router';
import { LayoutGrid } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { AppText, Button, Screen } from '@/components';
import { useI18n } from '@/lib/i18n';
import { spacing } from '@/theme';

export default function HomeScreen() {
  const { t } = useI18n();

  return (
    <Screen centered>
      <View style={styles.hero}>
        <AppText variant="display" accessibilityRole="header">
          Treker
        </AppText>
        <AppText color="muted" align="center">
          {t.home.tagline}
        </AppText>
      </View>
      {__DEV__ && (
        // Dev-only tool, so its label is not translated.
        <Button
          label="Component catalog"
          variant="secondary"
          icon={LayoutGrid}
          onPress={() => router.push('/dev/components')}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    alignItems: 'center',
    gap: spacing[2],
    marginBottom: spacing[8],
  },
});
