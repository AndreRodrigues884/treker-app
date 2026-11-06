import { router, useLocalSearchParams } from 'expo-router';
import { X } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { AppText, Button, Screen } from '@/components';
import { useTemplates } from '@/features/templates/queries';
import { useI18n } from '@/lib/i18n';
import { spacing } from '@/theme';

// PROVISIONAL: the gym session, opened from "+" with a saved workout (?template=<id>) or empty.
// Logging sets arrives in phase 1b.
export default function SessionScreen() {
  const { template } = useLocalSearchParams<{ template?: string }>();
  const { t } = useI18n();
  const templates = useTemplates();
  const name = template
    ? templates.data?.find((entry) => entry.template.id === template)?.template.name
    : t.session.emptyWorkout;

  return (
    <Screen>
      <View style={styles.content}>
        <View style={styles.top}>
          <Button label={t.common.close} variant="ghost" icon={X} onPress={() => router.back()} />
        </View>
        <AppText variant="title" accessibilityRole="header">
          {name ?? t.common.loading}
        </AppText>
        <AppText color="muted">{t.session.comingSoon}</AppText>
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
});
