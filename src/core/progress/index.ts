// Progress per exercise: the date ranges of the charts, the summary a screen reader gets instead of
// the chart, and which records are recent. Pure TypeScript; the points themselves are computed by
// Postgres (exercise_progress).
import { addDays, type LocalDate } from '../dates';

export const PROGRESS_RANGES = ['3m', '1y', 'all'] as const;
export type ProgressRange = (typeof PROGRESS_RANGES)[number];

// Months back from a date, keeping the day when it exists (31 May - 3 months = 28 Feb).
export function addMonths(date: LocalDate, months: number): LocalDate {
  const [year, month, day] = date.split('-').map(Number) as [number, number, number];
  const index = year * 12 + (month - 1) + months;
  const targetYear = Math.floor(index / 12);
  const targetMonth = index - targetYear * 12;
  const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${targetYear}-${pad(targetMonth + 1)}-${pad(Math.min(day, lastDay))}`;
}

// The first date a range shows, or null for everything.
export function rangeStart(range: ProgressRange, today: LocalDate): LocalDate | null {
  if (range === '3m') return addMonths(today, -3);
  if (range === '1y') return addMonths(today, -12);
  return null;
}

export type TrendPoint = { localDate: LocalDate; value: number };

export type Trend = {
  first: TrendPoint;
  last: TrendPoint;
  direction: 'up' | 'down' | 'same';
  count: number;
};

/**
 * What a chart shows, in words: where the series started and ended in the range, and which way it
 * went ("Estimated 1RM went up from 100 kg to 116.7 kg"). Null without points.
 */
export function describeTrend(points: readonly TrendPoint[]): Trend | null {
  const first = points[0];
  const last = points[points.length - 1];
  if (!first || !last) return null;
  const direction = last.value > first.value ? 'up' : last.value < first.value ? 'down' : 'same';
  return { first, last, direction, count: points.length };
}

// Records set in the last `days` days (today included) are highlighted.
export function isRecentRecord(localDate: LocalDate, today: LocalDate, days = 7): boolean {
  return localDate > addDays(today, -days) && localDate <= today;
}
