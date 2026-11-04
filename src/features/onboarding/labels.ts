import type { GymFocus, PoolLength, Sport, SwimStyle } from '@/core/onboarding';
import type { Messages } from '@/core/i18n';

// Translated names of the onboarding answers, shared by the questions and the summaries.

export function sportLabel(t: Messages, sport: Sport): string {
  return t.onboarding.sports[sport];
}

export function gymFocusLabels(t: Messages): Record<GymFocus, { title: string; hint: string }> {
  const focus = t.onboarding.gymFocus;
  return {
    strength: { title: focus.strength, hint: focus.strengthHint },
    hypertrophy: { title: focus.hypertrophy, hint: focus.hypertrophyHint },
    maintenance: { title: focus.maintenance, hint: focus.maintenanceHint },
  };
}

export function swimStyleLabels(t: Messages): Record<SwimStyle, { title: string; hint: string }> {
  const style = t.onboarding.swimStyle;
  return {
    competitive: { title: style.competitive, hint: style.competitiveHint },
    fitness: { title: style.fitness, hint: style.fitnessHint },
  };
}

export function poolLengthLabels(t: Messages): Record<PoolLength, { title: string; hint: string }> {
  const pool = t.onboarding.poolLength;
  return {
    '25m': { title: pool.shortCourse, hint: pool.shortCourseHint },
    '50m': { title: pool.longCourse, hint: pool.longCourseHint },
    '25yd': { title: pool.yards, hint: pool.yardsHint },
  };
}
