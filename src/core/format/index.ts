import type { LocalDate } from '../dates';
import { intlLocale, type Language } from '../i18n';

export type WeightUnit = 'kg' | 'lb';
export type DistanceUnit = 'm' | 'yd';

// Keeps the value and its unit on the same line.
const NBSP = ' ';

const SECONDS_PER_MINUTE = 60;
const SECONDS_PER_HOUR = 3600;
const CENTISECONDS_PER_SECOND = 100;

export function formatWeight(value: number, unit: WeightUnit, language: Language): string {
  const number = new Intl.NumberFormat(intlLocale(language), {
    maximumFractionDigits: 2,
  }).format(value);
  return `${number}${NBSP}${unit}`;
}

export function formatDistance(value: number, unit: DistanceUnit, language: Language): string {
  const number = new Intl.NumberFormat(intlLocale(language), {
    maximumFractionDigits: 0,
  }).format(value);
  return `${number}${NBSP}${unit}`;
}

/**
 * Formats a swim time given in centiseconds (hundredths of a second, the precision of
 * touchpad timing): 2761 -> "27.61" (en) / "27,61" (pt), 6245 -> "1:02.45", 366245 -> "1:01:02.45".
 */
export function formatSwimTime(centiseconds: number, language: Language): string {
  if (!Number.isInteger(centiseconds) || centiseconds < 0) {
    throw new RangeError(
      `Swim time must be a non-negative integer of centiseconds: ${centiseconds}`,
    );
  }

  const totalSeconds = Math.floor(centiseconds / CENTISECONDS_PER_SECOND);
  const hours = Math.floor(totalSeconds / SECONDS_PER_HOUR);
  const minutes = Math.floor((totalSeconds % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE);
  const seconds =
    (totalSeconds % SECONDS_PER_MINUTE) +
    (centiseconds % CENTISECONDS_PER_SECOND) / CENTISECONDS_PER_SECOND;

  const hasMinutes = hours > 0 || minutes > 0;
  const secondsText = new Intl.NumberFormat(intlLocale(language), {
    minimumIntegerDigits: hasMinutes ? 2 : 1,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    useGrouping: false,
  }).format(seconds);

  if (hours > 0) return `${hours}:${String(minutes).padStart(2, '0')}:${secondsText}`;
  if (minutes > 0) return `${minutes}:${secondsText}`;
  return secondsText;
}

/**
 * A workout's calendar date, short: "Thu, Nov 5" (en) / "qui., 5/11" style per locale. The year
 * is added when it is not the current one. Formatted in UTC so the date never shifts a day.
 */
export function formatLocalDate(date: LocalDate, language: Language, today: LocalDate): string {
  const sameYear = date.slice(0, 4) === today.slice(0, 4);
  return new Intl.DateTimeFormat(intlLocale(language), {
    timeZone: 'UTC',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    ...(sameYear ? {} : { year: 'numeric' }),
  }).format(new Date(`${date}T12:00:00Z`));
}

// Up to two initials for the profile picture placeholder: "Ana Silva" -> "AS", "ana" -> "A",
// "  " -> "". Uses the first and last words.
export function initialsOf(name: string | null | undefined): string {
  const words = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '';
  const first = words[0] ?? '';
  const last = words.length > 1 ? (words[words.length - 1] ?? '') : '';
  return (Array.from(first)[0] ?? '').concat(Array.from(last)[0] ?? '').toLocaleUpperCase();
}
