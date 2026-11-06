import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { colors, radii, sizes, spacing } from '@/theme';

export type ConfirmDialogProps = {
  visible: boolean;
  title: string;
  // What will happen, in plain words.
  body: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  // danger: the confirm button is red (deleting).
  tone?: 'danger' | 'default';
  loading?: boolean;
};

// A centred dialog over a dimmed screen that asks before doing something. Tapping outside, the
// cancel button or Android's back closes it without doing anything.
export function ConfirmDialog({
  visible,
  title,
  body,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  tone = 'default',
  loading = false,
}: ConfirmDialogProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
      statusBarTranslucent
    >
      <View style={styles.backdrop}>
        {/* Tapping outside cancels; screen readers use the cancel button instead. */}
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onCancel}
          accessible={false}
          importantForAccessibility="no"
        />
        <View style={styles.dialog} accessibilityViewIsModal>
          <AppText variant="heading" accessibilityRole="header">
            {title}
          </AppText>
          <AppText color="textSoft">{body}</AppText>
          <View style={styles.actions}>
            <Button
              label={confirmLabel}
              variant={tone === 'danger' ? 'danger' : 'primary'}
              onPress={onConfirm}
              loading={loading}
              fullWidth
            />
            <Button label={cancelLabel} variant="secondary" onPress={onCancel} fullWidth />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing[6],
    backgroundColor: colors.scrim,
  },
  dialog: {
    width: '100%',
    maxWidth: sizes.maxContentWidth,
    alignSelf: 'center',
    gap: spacing[3],
    padding: spacing[5],
    borderRadius: radii.xl,
    borderWidth: sizes.border,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  actions: {
    gap: spacing[2],
    marginTop: spacing[2],
  },
});
