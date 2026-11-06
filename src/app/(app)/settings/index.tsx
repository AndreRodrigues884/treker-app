import Constants from 'expo-constants';
import { router } from 'expo-router';
import { ArrowLeft, LayoutGrid, Languages, Mail, Ruler, Shield } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { AppText, Button, ListRow, Screen } from '@/components';
import { interpolate } from '@/core/i18n';
import { useAuth } from '@/features/auth/auth-provider';
import { Section } from '@/features/profile/section';
import { useI18n, useLanguageSettings } from '@/lib/i18n';
import { links, openLink } from '@/lib/links';
import { spacing } from '@/theme';

// Settings, opened from Profile: units, language, the privacy policy and contact, and the version.
export default function SettingsScreen() {
  const { t } = useI18n();
  const { preference } = useLanguageSettings();
  const { profile } = useAuth();
  const version = Constants.expoConfig?.version ?? '?';

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
          {t.profile.settings}
        </AppText>

        <Section title={t.profile.app}>
          <ListRow
            label={t.profile.units}
            icon={Ruler}
            value={profile?.weight_unit}
            onPress={() => router.push({ pathname: '/settings/edit', params: { step: 'units' } })}
          />
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

const styles = StyleSheet.create({
  content: {
    gap: spacing[6],
  },
  top: {
    alignItems: 'flex-start',
  },
});
