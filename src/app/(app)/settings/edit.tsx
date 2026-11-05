import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText, Button, ErrorNotice, Screen } from '@/components';
import { classifyRequestError, type RequestErrorKey } from '@/core/errors';
import {
  addedSteps,
  answersFromProfile,
  buildProfileUpdate,
  defaultAnswers,
  isEditableStep,
  validateStep,
  type OnboardingAnswers,
  type StepId,
} from '@/core/onboarding';
import { useAuth } from '@/features/auth/auth-provider';
import { Question } from '@/features/onboarding/questions';
import { useUpdateProfile } from '@/features/profile/queries';
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
  const { profile } = useAuth();
  const saveProfile = useUpdateProfile();

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
  // A failed save (network or server). The answers stay as they are, ready to try again.
  const [saveError, setSaveError] = useState<RequestErrorKey>();

  if (!answers || !original) return <Screen>{null}</Screen>;

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
    setSaveError(undefined);
    try {
      await saveProfile.mutateAsync(result.value);
    } catch (failure) {
      setSaveError(classifyRequestError(failure));
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
        {saveError !== undefined ? (
          <ErrorNotice
            message={t.common.errors[saveError]}
            network={saveError === 'network'}
            onRetry={save}
            retryLabel={t.common.retry}
            retrying={saveProfile.isPending}
          />
        ) : (
          <Button label={t.common.save} onPress={save} loading={saveProfile.isPending} fullWidth />
        )}
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
