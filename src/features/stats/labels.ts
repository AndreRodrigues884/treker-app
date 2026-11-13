// Text for progress: a measure's value in the athlete's units, the summary of a workout, and what a
// screen reader says for one exercise.
import type { MuscleGroup } from '@/core/exercises';
import { formatWeight, type WeightUnit } from '@/core/format';
import { interpolate, type Language, type Messages } from '@/core/i18n';
import type { ProgressMeasure, ProgressResult, ProgressSummary } from '@/core/progress';
import { fromKilograms } from '@/core/units';
import type { ColorToken } from '@/theme';

export type ProgressUnits = { weight: WeightUnit; language: Language };

// Up is green, the same is grey, down is red. Never the set squares' colours alone: the arrow and
// the text always say it too.
export const resultColor: Record<ProgressResult, ColorToken> = {
  up: 'positive',
  same: 'muted',
  down: 'danger',
  first: 'gym',
};

/** A measure's value: a weight (1RM, volume) in the athlete's unit, or seconds. */
export function progressValueText(
  t: Messages,
  measure: ProgressMeasure,
  value: number,
  units: ProgressUnits,
): string {
  if (measure === 'duration') {
    return interpolate(t.templateEditor.secondsValue, { count: Math.round(value) });
  }
  return formatWeight(fromKilograms(value, units.weight), units.weight, units.language);
}

/** "4 of 6 exercises progressed", or null when every exercise was done for the first time. */
export function progressSummaryText(t: Messages, summary: ProgressSummary): string | null {
  if (summary.compared === 0) return null;
  if (summary.compared === 1) return interpolate(t.progress.summarySingle, { up: summary.up });
  if (summary.up === 1) return interpolate(t.progress.summaryOneUp, { total: summary.compared });
  return interpolate(t.progress.summary, { up: summary.up, total: summary.compared });
}

/** What a screen reader says for one exercise: "Bench press: up, from 126.7 kg to 130 kg". */
export function progressLabel(
  t: Messages,
  name: string,
  progress: {
    measure: ProgressMeasure;
    current: number;
    previous: number | null;
    result: ProgressResult;
  },
  units: ProgressUnits,
): string {
  const value = (amount: number) => progressValueText(t, progress.measure, amount, units);
  const measure = t.progress.measures[progress.measure];
  return `${interpolate(t.progress.labels[progress.result], {
    name,
    current: value(progress.current),
    previous: progress.previous === null ? '' : value(progress.previous),
  })} (${measure})`;
}

// Each muscle group has its own colour on the Statistics screen, always next to its name.
export const muscleGroupColor: Record<MuscleGroup, ColorToken> = {
  back: 'chartOrange',
  chest: 'chartBlue',
  quads: 'chartGreen',
  hamstrings: 'chartTeal',
  glutes: 'chartLime',
  calves: 'chartIndigo',
  shoulders: 'chartPurple',
  biceps: 'chartPink',
  triceps: 'chartCyan',
  forearms: 'chartRose',
  core: 'chartAmber',
  full_body: 'chartRed',
};
