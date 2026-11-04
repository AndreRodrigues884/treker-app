import { router } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { AppText, Button, OptionCard, Screen } from '@/components';
import { languagePreferences } from '@/core/i18n';
import { useI18n, useLanguageSettings } from '@/lib/i18n';
import { spacing } from '@/theme';

// App language: automatic (the phone's), English or Portuguese. Kept on this phone and applied
// straight away.
export default function LanguageScreen() {
  const { t, deviceLanguage } = useI18n();
  const { preference, setPreference } = useLanguageSettings();

  return (
    <Screen scroll>
      <View style={styles.content}>
        <View style={styles.top}>
          <Button
            label={t.common.back}
            variant="ghost"
            icon={ArrowLeft}
            onPress={() => router.back()}
          />
        </View>
        <AppText variant="title" accessibilityRole="header">
          {t.language.title}
        </AppText>
        {languagePreferences.map((option) => (
          <OptionCard
            key={option}
            title={option === 'auto' ? t.language.auto : t.language[option]}
            description={
              option === 'auto'
                ? `${t.language.autoHint} · ${t.language[deviceLanguage]}`
                : undefined
            }
            selected={preference === option}
            onPress={() => setPreference(option)}
          />
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing[4],
  },
  top: {
    alignItems: 'flex-start',
  },
});
