import { Dumbbell, Waves } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText, OptionCard, Stepper, TextField } from '@/components';
import { interpolate } from '@/core/i18n';
import {
  GYM_FOCUSES,
  POOL_LENGTHS,
  SWIM_STYLES,
  toggleSport,
  WEEKLY_TARGET_MAX,
  WEEKLY_TARGET_MIN,
  WEIGHT_UNITS,
  type OnboardingAnswers,
  type StepId,
} from '@/core/onboarding';
import { gymFocusLabels, poolLengthLabels, swimStyleLabels } from '@/features/onboarding/labels';
import { useI18n } from '@/lib/i18n';
import { spacing } from '@/theme';

type QuestionProps = {
  step: Exclude<StepId, 'summary'>;
  answers: OnboardingAnswers;
  onChange: (answers: OnboardingAnswers) => void;
  // Translated error for this step, if any.
  error?: string;
  // Called when the keyboard's "next" key is pressed on text questions.
  onSubmit: () => void;
};

// Title, hint and answer controls for one onboarding question.
export function Question({ step, answers, onChange, error, onSubmit }: QuestionProps) {
  const { t } = useI18n();
  const q = t.onboarding;
  const set = (changes: Partial<OnboardingAnswers>) => onChange({ ...answers, ...changes });

  switch (step) {
    case 'name':
      return (
        <QuestionLayout title={q.name.title}>
          <TextField
            label={q.name.label}
            autoComplete="name"
            textContentType="name"
            autoFocus
            returnKeyType="next"
            value={answers.displayName}
            onChangeText={(displayName) => set({ displayName })}
            onSubmitEditing={onSubmit}
            error={error}
          />
        </QuestionLayout>
      );

    case 'sports':
      return (
        <QuestionLayout title={q.sports.title} hint={q.sports.hint} error={error}>
          <OptionCard
            title={q.sports.gym}
            icon={Dumbbell}
            multiple
            selected={answers.sports.includes('gym')}
            onPress={() => onChange(toggleSport(answers, 'gym'))}
          />
          <OptionCard
            title={q.sports.swim}
            icon={Waves}
            tone="swim"
            multiple
            selected={answers.sports.includes('swim')}
            onPress={() => onChange(toggleSport(answers, 'swim'))}
          />
        </QuestionLayout>
      );

    case 'gymFocus': {
      const labels = gymFocusLabels(t);
      return (
        <QuestionLayout title={q.gymFocus.title} error={error}>
          {GYM_FOCUSES.map((focus) => (
            <OptionCard
              key={focus}
              title={labels[focus].title}
              description={labels[focus].hint}
              selected={answers.gymFocus === focus}
              onPress={() => set({ gymFocus: focus })}
            />
          ))}
        </QuestionLayout>
      );
    }

    case 'swimStyle': {
      const labels = swimStyleLabels(t);
      return (
        <QuestionLayout title={q.swimStyle.title} error={error}>
          {SWIM_STYLES.map((style) => (
            <OptionCard
              key={style}
              title={labels[style].title}
              description={labels[style].hint}
              tone="swim"
              selected={answers.swimStyle === style}
              onPress={() => set({ swimStyle: style })}
            />
          ))}
        </QuestionLayout>
      );
    }

    case 'poolLength': {
      const labels = poolLengthLabels(t);
      return (
        <QuestionLayout title={q.poolLength.title} hint={q.poolLength.hint} error={error}>
          {POOL_LENGTHS.map((pool) => (
            <OptionCard
              key={pool}
              title={labels[pool].title}
              description={labels[pool].hint}
              tone="swim"
              selected={answers.poolLength === pool}
              onPress={() => set({ poolLength: pool })}
            />
          ))}
        </QuestionLayout>
      );
    }

    case 'weeklyTarget':
      return (
        <QuestionLayout title={q.weeklyTarget.title} hint={q.weeklyTarget.hint} error={error}>
          <Stepper
            value={answers.weeklyTarget}
            min={WEEKLY_TARGET_MIN}
            max={WEEKLY_TARGET_MAX}
            onChange={(weeklyTarget) => set({ weeklyTarget })}
            label={q.weeklyTarget.label}
            valueText={interpolate(q.weeklyTarget.value, { count: answers.weeklyTarget })}
            decreaseLabel={q.weeklyTarget.decrease}
            increaseLabel={q.weeklyTarget.increase}
          />
        </QuestionLayout>
      );

    case 'units':
      return (
        <QuestionLayout title={q.units.title}>
          <AppText variant="caption" color="textSoft">
            {q.units.weightUnit}
          </AppText>
          <View style={styles.row}>
            {WEIGHT_UNITS.map((unit) => (
              <View key={unit} style={styles.flex}>
                <OptionCard
                  title={unit}
                  selected={answers.weightUnit === unit}
                  onPress={() => set({ weightUnit: unit })}
                />
              </View>
            ))}
          </View>
          <TextField
            label={interpolate(q.units.bodyweightLabel, { unit: answers.weightUnit })}
            kind="decimal"
            returnKeyType="done"
            value={answers.bodyweight}
            onChangeText={(bodyweight) => set({ bodyweight })}
            onSubmitEditing={onSubmit}
            error={error}
          />
          <AppText variant="caption" color="muted">
            {q.units.bodyweightHint}
          </AppText>
        </QuestionLayout>
      );
  }
}

function QuestionLayout({
  title,
  hint,
  error,
  children,
}: {
  title: string;
  hint?: string;
  // Errors not already shown by a text field.
  error?: string;
  children: ReactNode;
}) {
  return (
    <View style={styles.question}>
      <View style={styles.header}>
        <AppText variant="title" accessibilityRole="header">
          {title}
        </AppText>
        {hint !== undefined && <AppText color="muted">{hint}</AppText>}
      </View>
      <View style={styles.answers}>{children}</View>
      {error !== undefined && (
        <AppText color="danger" accessibilityRole="alert" accessibilityLiveRegion="polite">
          {error}
        </AppText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  question: {
    gap: spacing[6],
  },
  header: {
    gap: spacing[2],
  },
  answers: {
    gap: spacing[3],
  },
  row: {
    flexDirection: 'row',
    gap: spacing[3],
  },
  flex: {
    flex: 1,
  },
});
