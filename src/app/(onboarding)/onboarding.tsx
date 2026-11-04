import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText, Button, Chip, Screen, TextField } from '@/components';
import { interpolate } from '@/core/i18n';
import {
  validateOnboarding,
  type OnboardingErrors,
  type OnboardingForm,
  type PoolUnit,
  type WeightUnit,
} from '@/core/profile';
import { useAuth } from '@/features/auth/auth-provider';
import { saveOnboarding } from '@/features/profile/api';
import { getDeviceTimezone } from '@/lib/device';
import { useI18n } from '@/lib/i18n';
import { spacing } from '@/theme';

const weightUnits: WeightUnit[] = ['kg', 'lb'];
const poolUnits: PoolUnit[] = ['m', 'yd'];

export default function OnboardingScreen() {
  const { t, language } = useI18n();
  const { session, reloadProfile } = useAuth();
  const [form, setForm] = useState<OnboardingForm>({
    displayName: '',
    weightUnit: 'kg',
    poolUnit: 'm',
    bodyweight: '',
  });
  const [errors, setErrors] = useState<OnboardingErrors>({});
  const [saveError, setSaveError] = useState<string>();
  const [saving, setSaving] = useState(false);

  const update = (changes: Partial<OnboardingForm>) =>
    setForm((current) => ({ ...current, ...changes }));

  const submit = async () => {
    if (!session) return;
    const result = validateOnboarding(form, { language, timezone: getDeviceTimezone() });
    if (!result.ok) {
      setErrors(result.error);
      return;
    }

    setErrors({});
    setSaveError(undefined);
    setSaving(true);
    try {
      await saveOnboarding(session.user.id, result.value);
      // The profile now has onboarded_at, so the router moves on to the app.
      await reloadProfile();
    } catch {
      setSaveError(t.auth.errors.generic);
      setSaving(false);
    }
  };

  const poolUnitLabels: Record<PoolUnit, string> = {
    m: t.onboarding.metres,
    yd: t.onboarding.yards,
  };

  return (
    <Screen scroll>
      <View style={styles.content}>
        <View style={styles.header}>
          <AppText variant="title" accessibilityRole="header">
            {t.onboarding.title}
          </AppText>
          <AppText color="muted">{t.onboarding.subtitle}</AppText>
        </View>

        <TextField
          label={t.onboarding.nameLabel}
          autoComplete="name"
          textContentType="name"
          value={form.displayName}
          onChangeText={(displayName) => update({ displayName })}
          error={errors.displayName && t.onboarding.errors[errors.displayName]}
        />

        <View style={styles.group}>
          <AppText variant="caption" color="textSoft">
            {t.onboarding.weightUnitLabel}
          </AppText>
          <View style={styles.chips}>
            {weightUnits.map((unit) => (
              <Chip
                key={unit}
                label={unit}
                selected={form.weightUnit === unit}
                onPress={() => update({ weightUnit: unit })}
              />
            ))}
          </View>
        </View>

        <View style={styles.group}>
          <AppText variant="caption" color="textSoft">
            {t.onboarding.poolUnitLabel}
          </AppText>
          <View style={styles.chips}>
            {poolUnits.map((unit) => (
              <Chip
                key={unit}
                label={poolUnitLabels[unit]}
                tone="swim"
                selected={form.poolUnit === unit}
                onPress={() => update({ poolUnit: unit })}
              />
            ))}
          </View>
        </View>

        <View style={styles.group}>
          <TextField
            label={interpolate(t.onboarding.bodyweightLabel, { unit: form.weightUnit })}
            kind="decimal"
            value={form.bodyweight}
            onChangeText={(bodyweight) => update({ bodyweight })}
            error={errors.bodyweight && t.onboarding.errors[errors.bodyweight]}
          />
          <AppText variant="caption" color="muted">
            {t.onboarding.bodyweightHint}
          </AppText>
        </View>

        {saveError !== undefined && (
          <AppText color="danger" accessibilityRole="alert">
            {saveError}
          </AppText>
        )}

        <Button label={t.onboarding.continue} onPress={submit} loading={saving} fullWidth />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing[5],
    paddingVertical: spacing[6],
  },
  header: {
    gap: spacing[2],
  },
  group: {
    gap: spacing[2],
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
  },
});
