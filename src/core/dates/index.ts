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
