import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText, Button, Screen, TextField } from '@/components';
import { validateEmail } from '@/core/auth';
import { sendEmailCode } from '@/features/auth/api';
import { useIntro } from '@/features/intro/intro-state';
import { useI18n } from '@/lib/i18n';
import { spacing } from '@/theme';

// One screen for new and returning users (sign-in by code creates the account when needed);
// "mode" from the intro only changes the title.
export default function SignInScreen() {
  const { t } = useI18n();
  const { mode } = useLocalSearchParams<{ mode?: 'signup' | 'signin' }>();
  const { resetIntro } = useIntro();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string>();
  const [sending, setSending] = useState(false);

  const submit = async () => {
    const result = validateEmail(email);
    if (!result.ok) {
      setError(t.auth.errors[result.error]);
      return;
    }

    setError(undefined);
    setSending(true);
    const { error: sendError } = await sendEmailCode(result.value);
    setSending(false);

    if (sendError) {
      setError(t.auth.errors[sendError]);
      return;
    }
    router.push({
      pathname: '/verify',
      params: { email: result.value, sentAt: String(Date.now()) },
    });
  };

  return (
    <Screen scroll>
      <View style={styles.content}>
        <View style={styles.header}>
          <AppText variant="title" accessibilityRole="header">
            {mode === 'signup' ? t.auth.signUpTitle : t.auth.emailTitle}
          </AppText>
          <AppText color="muted">{t.auth.emailSubtitle}</AppText>
        </View>
        <TextField
          label={t.auth.emailLabel}
          placeholder={t.auth.emailPlaceholder}
          kind="email"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          textContentType="emailAddress"
          returnKeyType="send"
          value={email}
          onChangeText={setEmail}
          onSubmitEditing={submit}
          error={error}
        />
        <Button label={t.auth.sendCode} onPress={submit} loading={sending} fullWidth />
        {__DEV__ && (
          // Dev-only tool to test the intro again, so its label is not translated.
          <Button
            label="Replay intro (dev)"
            variant="ghost"
            onPress={async () => {
              await resetIntro();
              router.replace('/welcome');
            }}
          />
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    gap: spacing[5],
  },
  header: {
    gap: spacing[2],
  },
});
