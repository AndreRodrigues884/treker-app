// Calendar dates as the athlete sees them: 'YYYY-MM-DD' strings in their timezone, never derived
// from UTC (a workout at 00:30 in Lisbon belongs to that day).

export type LocalDate = string;

const LOCAL_DATE = /^\d{4}-\d{2}-\d{2}$/;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function isLocalDate(value: string): value is LocalDate {
  return LOCAL_DATE.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

// The calendar date of an instant in a timezone, e.g. 2026-11-04T23:30:00Z in Lisbon (UTC+0 in
// winter) is '2026-11-04', and in Madrid (UTC+1) '2026-11-05'.
export function localDateOf(instant: Date, timeZone: string): LocalDate {
  // en-CA formats dates as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(instant);
}

// Date arithmetic on calendar dates only (computed in UTC, so no daylight-saving surprises).
export function addDays(date: LocalDate, days: number): LocalDate {
  const time = Date.parse(`${date}T00:00:00Z`) + days * MS_PER_DAY;
  return new Date(time).toISOString().slice(0, 10);
}

// The week containing a date, Monday to Sunday (ISO 8601, as used in Portugal), inclusive.
export function weekRange(date: LocalDate): { start: LocalDate; end: LocalDate } {
  const weekday = new Date(`${date}T00:00:00Z`).getUTCDay(); // 0 = Sunday
  const daysSinceMonday = (weekday + 6) % 7;
  const start = addDays(date, -daysSinceMonday);
  return { start, end: addDays(start, 6) };
}

const TIME_OF_DAY = /^([01]?\d|2[0-3]):([0-5]\d)$/;

// "09:30" or "9:30" -> minutes after midnight; null when not a time of day.
export function parseTimeOfDay(text: string): number | null {
  const match = TIME_OF_DAY.exec(text.trim());
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

// The time of day of an instant in a timezone, as "HH:MM".
export function timeOfDayIn(instant: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(instant);
}

// The offset of a timezone from UTC at an instant, in minutes (Lisbon in summer: +60).
function offsetMinutes(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(instant);
  const value = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  const asUtc = Date.UTC(
    value('year'),
    value('month') - 1,
    value('day'),
    value('hour'),
    value('minute'),
    value('second'),
  );
  return Math.round((asUtc - instant.getTime()) / 60_000);
}

/**
 * The instant of a calendar date and time of day in a timezone: ("2026-07-01", 9:30, Lisbon) ->
 * 08:30 UTC. Used when the athlete changes when a workout started. The offset is taken at that
 * moment, so summer and winter time are both right.
 */
export function instantOf(date: LocalDate, minutes: number, timeZone: string): Date {
  const naive = Date.parse(`${date}T00:00:00Z`) + minutes * 60_000;
  const first = naive - offsetMinutes(new Date(naive), timeZone) * 60_000;
  // Near a daylight-saving change the offset can differ at the real instant: correct once.
  return new Date(naive - offsetMinutes(new Date(first), timeZone) * 60_000);
}
