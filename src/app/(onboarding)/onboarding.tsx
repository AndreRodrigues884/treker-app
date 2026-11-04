import { ArrowLeft } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { BackHandler, StyleSheet, View } from 'react-native';

import { AppText, Button, ProgressBar, Screen } from '@/components';
import { interpolate } from '@/core/i18n';
import {
  buildProfileUpdate,
  choicesFromUpdate,
  classifySaveError,
  defaultAnswers,
  nextStep,
  previousStep,
  resumeDraft,
  stepProgress,
  validateStep,
  type OnboardingAnswers,
  type OnboardingDraft,
} from '@/core/onboarding';
import { useAuth } from '@/features/auth/auth-provider';
import { ChoicesSummary } from '@/features/onboarding/choices-summary';
import { clearDraft, loadDraft, saveDraft } from '@/features/onboarding/draft';
import { Question } from '@/features/onboarding/questions';
import { completeOnboarding } from '@/features/profile/api';
import { getDeviceRegion, getDeviceTimezone } from '@/lib/device';
import { useI18n } from '@/lib/i18n';
import { spacing } from '@/theme';

// The questionnaire after the first sign-in: one question per screen. Which questions appear and
// how answers are checked lives in src/core/onboarding; this screen only shows them. Every change
// is saved on the phone so the questionnaire continues where it stopped.
export default function OnboardingScreen() {
  const { t, language } = useI18n();
  const { session, reloadProfile } = useAuth();
  const userId = session?.user.id ?? null;

  const [draft, setDraft] = useState<OnboardingDraft | null>(null);
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!userId) return;
    let current = true;
    void loadDraft(userId).then((saved) => {
      if (current) setDraft(resumeDraft(saved, defaultAnswers(getDeviceRegion())));
    });
    return () => {
      current = false;
    };
  }, [userId]);

  const update = (next: OnboardingDraft) => {
    setDraft(next);
    if (userId) void saveDraft(userId, next);
  };

  const goBack = (): boolean => {
    if (!draft) return false;
    const previous = previousStep(draft.step, draft.answers);
    if (!previous) return false;
    setError(undefined);
    update({ ...draft, step: previous });
    return true;
  };

  // Android's back button goes to the previous question instead of leaving the app.
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', goBack);
    return () => subscription.remove();
  });

  if (!draft || !userId) {
    return <Screen>{null}</Screen>;
  }

  const { step, answers } = draft;
  const progress = stepProgress(step, answers);
  const progressLabel = interpolate(t.onboarding.stepOf, progress);

  const changeAnswers = (next: OnboardingAnswers) => {
    setError(undefined);
    update({ step, answers: next });
  };

  const goNext = () => {
    const stepError = validateStep(step, answers);
    if (stepError) {
      setError(t.onboarding.errors[stepError]);
      return;
    }
    const next = nextStep(step, answers);
    if (next) {
      setError(undefined);
      update({ step: next, answers });
    }
  };

  const finish = async () => {
    const result = buildProfileUpdate(answers, { language, timezone: getDeviceTimezone() });
    if (!result.ok) {
      update({ step: result.error.step, answers });
      setError(t.onboarding.errors[result.error.error]);
      return;
    }

    setError(undefined);
    setSaving(true);
    try {
      await completeOnboarding(userId, result.value);
    } catch (saveError) {
      // The draft stays on the phone, so nothing is lost and the user can try again.
      setError(t.onboarding.errors[classifySaveError(saveError as Error)]);
      setSaving(false);
      return;
    }
    await clearDraft(userId);
    // The profile now has onboarded_at, so the router moves on to the app.
    await reloadProfile();
  };

  const summary =
    step === 'summary' ? buildProfileUpdate(answers, { language, timezone: '' }) : null;

  return (
    <Screen scroll>
      <View style={styles.content}>
        <View style={styles.progress}>
          <View style={styles.progressRow}>
            {progress.number > 1 ? (
              <Button label={t.common.back} variant="ghost" icon={ArrowLeft} onPress={goBack} />
            ) : (
              <View />
            )}
            <AppText variant="caption" color="muted">
              {progressLabel}
            </AppText>
          </View>
          <ProgressBar
            value={progress.number / progress.total}
            accessibilityLabel={progressLabel}
          />
        </View>

        {step === 'summary' ? (
          <View style={styles.summary}>
            <AppText variant="title" accessibilityRole="header">
              {interpolate(t.onboarding.summary.title, { name: answers.displayName.trim() })}
            </AppText>
            {summary?.ok && <ChoicesSummary choices={choicesFromUpdate(summary.value)} />}
            <AppText color="muted">{t.onboarding.summary.hint}</AppText>
            {error !== undefined && (
              <AppText color="danger" accessibilityRole="alert" accessibilityLiveRegion="polite">
                {error}
              </AppText>
            )}
            <Button
              label={t.onboarding.summary.enter}
              onPress={finish}
              loading={saving}
              fullWidth
            />
          </View>
        ) : (
          <>
            <Question
              step={step}
              answers={answers}
              onChange={changeAnswers}
              error={error}
              onSubmit={goNext}
            />
            <Button label={t.common.next} onPress={goNext} fullWidth />
          </>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing[6],
  },
  progress: {
    gap: spacing[2],
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: spacing[12],
  },
  summary: {
    gap: spacing[4],
  },
});
