import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText, Button, Screen } from '@/components';
import {
  addedSteps,
  answersFromProfile,
  buildProfileUpdate,
  classifySaveError,
  defaultAnswers,
  isEditableStep,
  validateStep,
  type OnboardingAnswers,
  type StepId,
} from '@/core/onboarding';
import { useAuth } from '@/features/auth/auth-provider';
import { Question } from '@/features/onboarding/questions';
import { updateProfile } from '@/features/profile/repository';
import { getDeviceRegion, getDeviceTimezone } from '@/lib/device';
import { useI18n } from '@/lib/i18n';
import { spacing } from '@/theme';

type EditableStep = Exclude<StepId, 'summary'>;

// Edits one onboarding answer from the profile, with the same question and validation as the
// questionnaire (src/core/onboarding). If the change makes another answer necessary (adding
// swimming needs a swim style and pool), those questions follow before saving, so the profile
// always meets the database consistency rules.
export default function EditAnswerScreen() {
  const { t, language } = useI18n();
  const params = useLocalSearchParams<{ step?: string }>();
  const { profile, store } = useAuth();

  const [step, setStep] = useState<EditableStep>(
    isEditableStep(params.step) ? params.step : 'name',
  );
  const [answers, setAnswers] = useState<OnboardingAnswers | null>(() =>
    profile ? answersFromProfile(profile, defaultAnswers(getDeviceRegion())) : null,
  );
  // The saved answers, to see which questions a change adds.
  const [original] = useState(answers);
  // Questions still to ask before saving (after adding a sport).
  const [queue, setQueue] = useState<EditableStep[]>([]);
  const [error, setError] = useState<string>();
  const [followUp, setFollowUp] = useState(false);
  const [saving, setSaving] = useState(false);

  if (!answers || !original || !store) return <Screen>{null}</Screen>;

  const ask = (next: EditableStep, rest: EditableStep[]) => {
    setStep(next);
    setQueue(rest);
    setFollowUp(true);
    setError(undefined);
  };

  const save = async () => {
    const stepError = validateStep(step, answers);
    if (stepError) {
      setError(t.onboarding.errors[stepError]);
      return;
    }

    // Adding a sport: ask its questions (even those with a default, like the pool) first.
    const pending = step === 'sports' && !followUp ? addedSteps(original, answers) : queue;
    if (pending.length > 0) {
      ask(pending[0], pending.slice(1));
      return;
    }

    const result = buildProfileUpdate(answers, { language, timezone: getDeviceTimezone() });
    if (!result.ok) {
      // Another answer is still missing: ask it before saving.
      if (isEditableStep(result.error.step)) ask(result.error.step, []);
      return;
    }

    setError(undefined);
    setSaving(true);
    try {
      // Saved on the phone and queued for the server; screens follow the local profile.
      updateProfile(store, result.value);
    } catch (saveError) {
      setError(t.onboarding.errors[classifySaveError(saveError as Error)]);
      setSaving(false);
      return;
    }
    router.back();
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
        {followUp && (
          <AppText color="textSoft" accessibilityLiveRegion="polite">
            {t.profile.editMore}
          </AppText>
        )}
        <Question
          step={step}
          answers={answers}
          onChange={(next) => {
            setError(undefined);
            setAnswers(next);
          }}
          error={error}
          onSubmit={save}
        />
        <Button label={t.common.save} onPress={save} loading={saving} fullWidth />
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
