import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { AppText, Button, Screen, TextField } from '@/components';
import { CODE_LENGTH, normalizeCode, secondsUntilResend, validateCode } from '@/core/auth';
import { interpolate } from '@/core/i18n';
import { sendEmailCode, verifyEmailCode } from '@/features/auth/api';
import { useI18n } from '@/lib/i18n';
import { spacing } from '@/theme';

const TICK_MS = 1000;

export default function VerifyCodeScreen() {
  const { t } = useI18n();
  const params = useLocalSearchParams<{ email: string; sentAt?: string }>();
  const email = params.email ?? '';

  const [code, setCode] = useState('');
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [lastSentAt, setLastSentAt] = useState(() => Number(params.sentAt) || Date.now());
  const [now, setNow] = useState(() => Date.now());

  const resendIn = secondsUntilResend(lastSentAt, now);

  // Tick only while the resend button is waiting.
  useEffect(() => {
    if (resendIn === 0) return;
    const timer = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(timer);
  }, [resendIn]);

  const verify = async (input: string) => {
    const result = validateCode(input);
    if (!result.ok) {
      setError(t.auth.errors[result.error]);
      return;
    }

    setError(undefined);
    setNotice(undefined);
    setVerifying(true);
    const { error: verifyError } = await verifyEmailCode(email, result.value, lastSentAt);
    setVerifying(false);

    // On success the session changes and the router moves on to onboarding or the app.
    if (verifyError) {
      setError(t.auth.errors[verifyError]);
      setCode('');
    }
  };

  const onChangeCode = (input: string) => {
    const digits = normalizeCode(input);
    setCode(digits);
    // Codes filled in by the keyboard or pasted are submitted straight away.
    if (digits.length === CODE_LENGTH && !verifying) void verify(digits);
  };

  const resend = async () => {
    setError(undefined);
    setNotice(undefined);
    setResending(true);
    const { error: sendError } = await sendEmailCode(email);
    setResending(false);

    if (sendError) {
      setError(t.auth.errors[sendError]);
      return;
    }
    const sentAt = Date.now();
    setLastSentAt(sentAt);
    setNow(sentAt);
    setCode('');
    setNotice(t.auth.codeResent);
  };

  return (
    <Screen scroll>
      <View style={styles.content}>
        <View style={styles.header}>
          <AppText variant="title" accessibilityRole="header">
            {t.auth.codeTitle}
          </AppText>
          <AppText color="muted">{interpolate(t.auth.codeSubtitle, { email })}</AppText>
        </View>
        <TextField
          label={t.auth.codeLabel}
          kind="integer"
          maxLength={CODE_LENGTH}
          // Lets iOS and Android offer the code from the email or notification.
          textContentType="oneTimeCode"
          autoComplete={Platform.OS === 'android' ? 'sms-otp' : 'one-time-code'}
          autoFocus
          value={code}
          onChangeText={onChangeCode}
          onSubmitEditing={() => verify(code)}
          error={error}
        />
        {notice !== undefined && (
          <AppText color="positive" accessibilityLiveRegion="polite">
            {notice}
          </AppText>
        )}
        <Button label={t.auth.verify} onPress={() => verify(code)} loading={verifying} fullWidth />
        <View style={styles.secondary}>
          <Button
            label={
              resendIn > 0 ? interpolate(t.auth.resendIn, { seconds: resendIn }) : t.auth.resend
            }
            variant="secondary"
            onPress={resend}
            disabled={resendIn > 0}
            loading={resending}
            fullWidth
          />
          <Button label={t.auth.changeEmail} variant="ghost" onPress={() => router.back()} />
        </View>
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
  secondary: {
    gap: spacing[2],
    alignItems: 'center',
  },
});
