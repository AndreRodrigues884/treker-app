// The Statistics screen and the saved workout screen: date ranges, the average per week, which
// exercises the strength chart shows, and the progress of a saved workout grouped for its charts.
// The numbers themselves come from Postgres (weekly_summary, one_rep_max_series, template_progress).
import { addDays, weekRange, type LocalDate } from '../dates';

import { addMonths } from './ranges';
import type { ProgressMeasure, ProgressResult } from './rule';

export const STATS_RANGES = ['4w', '3m', '1y', 'all'] as const;
export type StatsRange = (typeof STATS_RANGES)[number];

/**
 * The first day a Statistics range shows (null: everything). Always a Monday, so the first week
 * is whole: "4 weeks" is this week and the 3 before it.
 */
export function statsRangeStart(range: StatsRange, today: LocalDate): LocalDate | null {
  if (range === 'all') return null;
  const from =
    range === '4w'
      ? addDays(today, -21)
      : range === '3m'
        ? addMonths(today, -3)
        : addMonths(today, -12);
  return weekRange(from).start;
}

export type WeekCount = { weekStart: LocalDate; count: number };

/**
 * Workouts per week in the range, from the first week with a workout (so someone who started two
 * weeks ago is not averaged over a year). Null when there is no workout.
 */
export function averagePerWeek(weeks: readonly WeekCount[]): number | null {
  const first = weeks.findIndex((week) => week.count > 0);
  if (first === -1) return null;
  const counted = weeks.slice(first);
  const total = counted.reduce((sum, week) => sum + week.count, 0);
  return Math.round((total / counted.length) * 10) / 10;
}

export const MAX_STRENGTH_EXERCISES = 5;

export type ExerciseUsage = {
  exerciseId: string;
  setCount: number;
  lastLocalDate: LocalDate | null;
  // Exercises without an estimated 1RM (a plank) cannot be on the strength chart.
  hasOneRepMax: boolean;
};

/** The strength chart's exercises by default: the ones done most (most sets), then the latest. */
export function defaultStrengthExercises(
  usage: readonly ExerciseUsage[],
  max = MAX_STRENGTH_EXERCISES,
): string[] {
  return usage
    .filter((item) => item.hasOneRepMax)
    .sort(
      (a, b) =>
        b.setCount - a.setCount ||
        (b.lastLocalDate ?? '').localeCompare(a.lastLocalDate ?? '') ||
        a.exerciseId.localeCompare(b.exerciseId),
    )
    .slice(0, max)
    .map((item) => item.exerciseId);
}

/**
 * Ticking or unticking an exercise of the strength chart. A sixth is refused: `limited` says so,
 * and the list stays as it was.
 */
export function toggleStrengthExercise(
  selected: readonly string[],
  exerciseId: string,
  max = MAX_STRENGTH_EXERCISES,
): { selected: string[]; limited: boolean } {
  if (selected.includes(exerciseId)) {
    return { selected: selected.filter((id) => id !== exerciseId), limited: false };
  }
  if (selected.length >= max) return { selected: [...selected], limited: true };
  return { selected: [...selected, exerciseId], limited: false };
}

/** The strength chart's choice kept on the phone: a list of ids, or null when not valid. */
export function parseStrengthChoice(value: unknown): string[] | null {
  if (!Array.isArray(value) || !value.every((item) => typeof item === 'string')) return null;
  return [...new Set(value as string[])].slice(0, MAX_STRENGTH_EXERCISES);
}

// The saved workout screen ---------------------------------------------------------------------------

export type TemplateProgressRow = {
  activityId: string;
  localDate: LocalDate;
  exerciseId: string;
  position: number;
  measure: ProgressMeasure;
  value: number;
  result: ProgressResult;
  sessionResult: ProgressResult;
};

export type TemplateSession = { activityId: string; localDate: LocalDate; result: ProgressResult };

export type TemplateExerciseSeries = {
  exerciseId: string;
  measure: ProgressMeasure;
  points: { activityId: string; localDate: LocalDate; value: number; result: ProgressResult }[];
};

/**
 * template_progress's rows (oldest workout first) as the saved workout screen shows them: one
 * entry per workout with its overall result, and one bar series per exercise. A series uses the
 * measure of the exercise's latest workout and leaves out workouts measured otherwise, so its bars
 * are always comparable. Exercises follow their order in the latest workout that has them.
 */
export function groupTemplateProgress(rows: readonly TemplateProgressRow[]): {
  sessions: TemplateSession[];
  exercises: TemplateExerciseSeries[];
} {
  const sessions = new Map<string, TemplateSession>();
  const byExercise = new Map<string, TemplateProgressRow[]>();
  for (const row of rows) {
    if (!sessions.has(row.activityId)) {
      sessions.set(row.activityId, {
        activityId: row.activityId,
        localDate: row.localDate,
        result: row.sessionResult,
      });
    }
    byExercise.set(row.exerciseId, [...(byExercise.get(row.exerciseId) ?? []), row]);
  }
  const order = [...sessions.keys()];
  const exercises = [...byExercise.values()]
    .map((list) => {
      const latest = list[list.length - 1] as TemplateProgressRow;
      return {
        latest,
        series: {
          exerciseId: latest.exerciseId,
          measure: latest.measure,
          points: list
            .filter((row) => row.measure === latest.measure)
            .map((row) => ({
              activityId: row.activityId,
              localDate: row.localDate,
              value: row.value,
              result: row.result,
            })),
        },
      };
    })
    .sort(
      (a, b) =>
        order.indexOf(b.latest.activityId) - order.indexOf(a.latest.activityId) ||
        a.latest.position - b.latest.position,
    )
    .map(({ series }) => series);
  return { sessions: [...sessions.values()], exercises };
}
