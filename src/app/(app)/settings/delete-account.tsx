import { router } from 'expo-router';
import { ArrowLeft, TriangleAlert } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText, Button, Card, Icon, Screen, TextField } from '@/components';
import { isDeleteConfirmed } from '@/core/account';
import { interpolate } from '@/core/i18n';
import { classifyRequestError } from '@/core/errors';
import { useAuth } from '@/features/auth/auth-provider';
import { clearDraft } from '@/features/onboarding/draft';
import { deleteAccount } from '@/features/profile/repository';
import { useI18n } from '@/lib/i18n';
import { colors, radii, spacing } from '@/theme';

// Deletes the account for good, after a clear warning and typing the confirmation word.
// Postgres delete_my_account() removes the user and, by cascade, all their data.
export default function DeleteAccountScreen() {
  const { t } = useI18n();
  const { session } = useAuth();
  const copy = t.deleteAccount;
  const [typed, setTyped] = useState('');
  const [error, setError] = useState<string>();
  const [deleting, setDeleting] = useState(false);

  const confirmed = isDeleteConfirmed(typed, copy.word);

  const remove = async () => {
    if (!confirmed) {
      setError(interpolate(copy.mismatch, { word: copy.word }));
      return;
    }
    setError(undefined);
    setDeleting(true);
    try {
      const userId = session?.user.id;
      if (!userId) return;
      // Deletes the account on the server and signs out; the session is gone, so the cache is
      // cleared and the router moves to the email screen.
      await deleteAccount();
      await clearDraft(userId);
    } catch (deleteError) {
      setError(copy.errors[classifyRequestError(deleteError as Error)]);
      setDeleting(false);
    }
  };

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
          {copy.title}
        </AppText>

        <Card style={styles.warning}>
          <View style={styles.row}>
            <Icon icon={TriangleAlert} color="danger" />
            <AppText style={styles.flex}>{copy.warning}</AppText>
          </View>
          <AppText variant="caption" color="muted">
            {copy.lose}
          </AppText>
          {[copy.loseWorkouts, copy.loseRecords, copy.loseProfile].map((item) => (
            <AppText key={item} color="textSoft">
              • {item}
            </AppText>
          ))}
        </Card>

        <TextField
          label={interpolate(copy.confirmLabel, { word: copy.word })}
          autoCapitalize="characters"
          autoCorrect={false}
          value={typed}
          onChangeText={(value) => {
            setError(undefined);
            setTyped(value);
          }}
          error={error}
        />

        <Button
          label={copy.confirm}
          variant="danger"
          onPress={remove}
          disabled={!confirmed}
          loading={deleting}
          fullWidth
        />
        <Button label={copy.cancel} variant="ghost" onPress={() => router.back()} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing[5],
  },
  top: {
    alignItems: 'flex-start',
  },
  warning: {
    borderColor: colors.danger,
    backgroundColor: colors.dangerTint,
    borderRadius: radii.lg,
  },
  row: {
    flexDirection: 'row',
    gap: spacing[2],
  },
  flex: {
    flex: 1,
  },
});
