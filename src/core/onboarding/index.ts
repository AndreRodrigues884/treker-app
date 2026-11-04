// The onboarding questionnaire: which questions appear, how each answer is validated, sensible
// defaults, resuming a half-finished questionnaire, and what is finally saved to the profile.
// Every question changes something in the app; nothing about age, sex, height or experience.
import { z } from 'zod';

import type { Validation } from '../auth';
import type { Language } from '../i18n';
import { parseDecimal, toKilograms, type WeightUnit } from '../units';

export type { WeightUnit };
export type Sport = 'gym' | 'swim';
export type GymFocus = 'strength' | 'hypertrophy' | 'maintenance';
export type SwimStyle = 'competitive' | 'fitness';
export type PoolLength = '25m' | '50m' | '25yd';
export type PoolUnit = 'm' | 'yd';

export const SPORTS: readonly Sport[] = ['gym', 'swim'];
export const GYM_FOCUSES: readonly GymFocus[] = ['strength', 'hypertrophy', 'maintenance'];
export const SWIM_STYLES: readonly SwimStyle[] = ['competitive', 'fitness'];
export const POOL_LENGTHS: readonly PoolLength[] = ['25m', '50m', '25yd'];
export const WEIGHT_UNITS: readonly WeightUnit[] = ['kg', 'lb'];

// Matches profiles.weekly_target.
export const WEEKLY_TARGET_MIN = 1;
export const WEEKLY_TARGET_MAX = 14;
const DEFAULT_WEEKLY_TARGET = 3;

// Plausible bodyweight range; profiles.bodyweight_kg allows 0 to 500.
const MIN_BODYWEIGHT_KG = 20;
const MAX_BODYWEIGHT_KG = 400;
const MAX_NAME_LENGTH = 50;

export type OnboardingAnswers = {
  displayName: string;
  sports: Sport[];
  // Null until chosen: there is no sensible default for these.
  gymFocus: GymFocus | null;
  swimStyle: SwimStyle | null;
  poolLength: PoolLength;
  weeklyTarget: number;
  weightUnit: WeightUnit;
  // As typed, in weightUnit; '' when skipped.
  bodyweight: string;
};

// Steps ------------------------------------------------------------------------------------------

export type StepId =
  | 'name'
  | 'sports'
  | 'gymFocus'
  | 'swimStyle'
  | 'poolLength'
  | 'weeklyTarget'
  | 'units'
  | 'summary';

const STEP_ORDER: readonly StepId[] = [
  'name',
  'sports',
  'gymFocus',
  'swimStyle',
  'poolLength',
  'weeklyTarget',
  'units',
  'summary',
];

// Questions that only make sense for one sport.
const STEP_SPORT: Partial<Record<StepId, Sport>> = {
  gymFocus: 'gym',
  swimStyle: 'swim',
  poolLength: 'swim',
};

export function visibleSteps(answers: Pick<OnboardingAnswers, 'sports'>): StepId[] {
  return STEP_ORDER.filter((step) => {
    const sport = STEP_SPORT[step];
    return sport === undefined || answers.sports.includes(sport);
  });
}

export function nextStep(current: StepId, answers: OnboardingAnswers): StepId | null {
  const steps = visibleSteps(answers);
  return steps[steps.indexOf(current) + 1] ?? null;
}

export function previousStep(current: StepId, answers: OnboardingAnswers): StepId | null {
  const steps = visibleSteps(answers);
  const index = steps.indexOf(current);
  return index > 0 ? steps[index - 1] : null;
}

// Position for the progress bar: 1-based step number out of the visible steps.
export function stepProgress(
  current: StepId,
  answers: OnboardingAnswers,
): { number: number; total: number } {
  const steps = visibleSteps(answers);
  return { number: steps.indexOf(current) + 1, total: steps.length };
}

// Validation -------------------------------------------------------------------------------------

export type OnboardingErrorKey =
  | 'nameRequired'
  | 'sportsRequired'
  | 'gymFocusRequired'
  | 'swimStyleRequired'
  | 'weeklyTargetInvalid'
  | 'bodyweightInvalid';

const nameSchema = z.string().trim().min(1).max(MAX_NAME_LENGTH);

function bodyweightKg(answers: OnboardingAnswers): number | null | 'invalid' {
  if (answers.bodyweight.trim() === '') return null;
  const value = parseDecimal(answers.bodyweight);
  if (value === null) return 'invalid';
  const kg = toKilograms(value, answers.weightUnit);
  return kg < MIN_BODYWEIGHT_KG || kg > MAX_BODYWEIGHT_KG ? 'invalid' : kg;
}

// The error that keeps the user on this step, or null when they can go on.
export function validateStep(step: StepId, answers: OnboardingAnswers): OnboardingErrorKey | null {
  switch (step) {
    case 'name':
      return nameSchema.safeParse(answers.displayName).success ? null : 'nameRequired';
    case 'sports':
      return answers.sports.length > 0 ? null : 'sportsRequired';
    case 'gymFocus':
      return answers.gymFocus !== null ? null : 'gymFocusRequired';
    case 'swimStyle':
      return answers.swimStyle !== null ? null : 'swimStyleRequired';
    case 'poolLength':
      return null;
    case 'weeklyTarget':
      return Number.isInteger(answers.weeklyTarget) &&
        answers.weeklyTarget >= WEEKLY_TARGET_MIN &&
        answers.weeklyTarget <= WEEKLY_TARGET_MAX
        ? null
        : 'weeklyTargetInvalid';
    case 'units':
      return bodyweightKg(answers) === 'invalid' ? 'bodyweightInvalid' : null;
    case 'summary':
      return null;
  }
}

// Defaults ---------------------------------------------------------------------------------------

// Pounds and yards only for phones set to the United States.
export function defaultAnswers(regionCode: string | null): OnboardingAnswers {
  const us = regionCode?.toUpperCase() === 'US';
  return {
    displayName: '',
    sports: [],
    gymFocus: null,
    swimStyle: null,
    poolLength: us ? '25yd' : '25m',
    weeklyTarget: DEFAULT_WEEKLY_TARGET,
    weightUnit: us ? 'lb' : 'kg',
    bodyweight: '',
  };
}

export function toggleSport(answers: OnboardingAnswers, sport: Sport): OnboardingAnswers {
  const sports = answers.sports.includes(sport)
    ? answers.sports.filter((item) => item !== sport)
    : SPORTS.filter((item) => item === sport || answers.sports.includes(item));
  return { ...answers, sports };
}

// Resuming ---------------------------------------------------------------------------------------

export type OnboardingDraft = { step: StepId; answers: OnboardingAnswers };

const draftSchema = z.object({
  step: z.enum(STEP_ORDER as [StepId, ...StepId[]]),
  answers: z.object({
    displayName: z.string(),
    sports: z.array(z.enum(['gym', 'swim'])),
    gymFocus: z.enum(['strength', 'hypertrophy', 'maintenance']).nullable(),
    swimStyle: z.enum(['competitive', 'fitness']).nullable(),
    poolLength: z.enum(['25m', '50m', '25yd']),
    weeklyTarget: z.number(),
    weightUnit: z.enum(['kg', 'lb']),
    bodyweight: z.string(),
  }),
});

/**
 * Where to continue a saved questionnaire. Anything unreadable starts over with the defaults.
 * The saved step is kept unless it no longer applies (for example the gym question after
 * unticking gym) or an earlier answer is missing; then it goes to the first step needing an
 * answer.
 */
export function resumeDraft(saved: unknown, defaults: OnboardingAnswers): OnboardingDraft {
  const parsed = draftSchema.safeParse(saved);
  if (!parsed.success) return { step: 'name', answers: defaults };

  const { answers } = parsed.data;
  const steps = visibleSteps(answers);
  const savedIndex = steps.indexOf(parsed.data.step);
  const firstIncomplete = steps.findIndex((step) => validateStep(step, answers) !== null);

  let index = savedIndex === -1 ? steps.length - 1 : savedIndex;
  if (firstIncomplete !== -1 && firstIncomplete < index) index = firstIncomplete;
  return { step: steps[index], answers };
}

// Saving -----------------------------------------------------------------------------------------

// The profiles columns written when onboarding finishes (plus onboarded_at, set when saving).
export type OnboardingProfileUpdate = {
  display_name: string;
  sports: Sport[];
  gym_focus: GymFocus | null;
  swim_style: SwimStyle | null;
  default_pool_length: PoolLength | null;
  weekly_target: number;
  weight_unit: WeightUnit;
  pool_unit: PoolUnit;
  bodyweight_kg: number | null;
  locale: Language;
  timezone: string;
};

export function buildProfileUpdate(
  answers: OnboardingAnswers,
  device: { language: Language; timezone: string },
): Validation<OnboardingProfileUpdate, { step: StepId; error: OnboardingErrorKey }> {
  for (const step of visibleSteps(answers)) {
    const error = validateStep(step, answers);
    if (error) return { ok: false, error: { step, error } };
  }

  const gym = answers.sports.includes('gym');
  const swim = answers.sports.includes('swim');
  const bodyweight = bodyweightKg(answers);

  return {
    ok: true,
    value: {
      display_name: answers.displayName.trim(),
      sports: answers.sports,
      // Answers to questions that were skipped are not saved.
      gym_focus: gym ? answers.gymFocus : null,
      swim_style: swim ? answers.swimStyle : null,
      default_pool_length: swim ? answers.poolLength : null,
      weekly_target: answers.weeklyTarget,
      weight_unit: answers.weightUnit,
      pool_unit: answers.poolLength === '25yd' ? 'yd' : 'm',
      bodyweight_kg: bodyweight === 'invalid' ? null : bodyweight,
      locale: device.language,
      timezone: device.timezone,
    },
  };
}

// What the summary screens show, from the answers or from a saved profile.
export type OnboardingChoices = {
  displayName: string;
  sports: Sport[];
  gymFocus: GymFocus | null;
  swimStyle: SwimStyle | null;
  poolLength: PoolLength | null;
  weeklyTarget: number;
  weightUnit: WeightUnit;
  bodyweightKg: number | null;
};

export function choicesFromUpdate(update: OnboardingProfileUpdate): OnboardingChoices {
  return {
    displayName: update.display_name,
    sports: update.sports,
    gymFocus: update.gym_focus,
    swimStyle: update.swim_style,
    poolLength: update.default_pool_length,
    weeklyTarget: update.weekly_target,
    weightUnit: update.weight_unit,
    bodyweightKg: update.bodyweight_kg,
  };
}

export type SaveErrorKey = 'network' | 'generic';

// Saving fails without a connection as a fetch TypeError ("Network request failed").
export function classifySaveError(error: { name?: string; message?: string }): SaveErrorKey {
  const text = `${error.name ?? ''} ${error.message ?? ''}`;
  return /network request failed|failed to fetch|fetcherror|typeerror/i.test(text)
    ? 'network'
    : 'generic';
}
