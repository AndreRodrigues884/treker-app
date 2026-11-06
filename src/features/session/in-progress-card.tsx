import { router } from 'expo-router';
import { Play, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText, Button, Card, ConfirmDialog } from '@/components';
import { formatDuration } from '@/core/format';
import { interpolate } from '@/core/i18n';
import { elapsedS } from '@/core/session';
import { useDataContext } from '@/features/auth/auth-provider';
import { useI18n } from '@/lib/i18n';
import { useNow } from '@/lib/use-now';
import { spacing } from '@/theme';

import { useSessionActions } from './queries';
import { useActiveSession } from './session-store';

// On Today, when a workout was left in progress (the app was closed or killed): continue it, or
// discard it after a confirmation. Shows nothing otherwise.
export function InProgressCard() {
  const { t } = useI18n();
  const ctx = useDataContext();
  const session = useActiveSession(ctx.userId);
  const actions = useSessionActions();
  const now = useNow(30_000);
  const [confirming, setConfirming] = useState(false);

  if (!session) return null;

  const title = session.templateName ?? t.session.emptyWorkout;
  const ago = interpolate(t.session.ago, { time: formatDuration(elapsedS(session, now)) });
  const meta = interpolate(t.session.inProgressMeta, { title, ago });

  return (
    <Card>
      <View style={styles.text}>
        <AppText variant="heading" accessibilityRole="header">
          {t.session.inProgress}
        </AppText>
        <AppText color="muted">{meta}</AppText>
      </View>
      <View style={styles.buttons}>
        <Button label={t.session.continue} icon={Play} onPress={() => router.push('/session')} />
        <Button
          label={t.session.discard}
          icon={Trash2}
          variant="ghost"
          onPress={() => setConfirming(true)}
        />
      </View>
      <ConfirmDialog
        visible={confirming}
        tone="danger"
        title={t.session.discardTitle}
        body={t.session.discardBody}
        confirmLabel={t.session.discardWorkout}
        cancelLabel={t.common.cancel}
        onCancel={() => setConfirming(false)}
        onConfirm={async () => {
          setConfirming(false);
          await actions.discard();
        }}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  text: {
    gap: spacing[1],
  },
  buttons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
  },
});
