import {
  addDays,
  instantOf,
  isLocalDate,
  localDateOf,
  parseTimeOfDay,
  timeOfDayIn,
  weekRange,
} from './index';

describe('localDateOf', () => {
  it('uses the athlete timezone, not UTC', () => {
    const lateNightUtc = new Date('2026-11-04T23:30:00Z');
    expect(localDateOf(lateNightUtc, 'Europe/Lisbon')).toBe('2026-11-04');
    expect(localDateOf(lateNightUtc, 'Europe/Madrid')).toBe('2026-11-05');
    expect(localDateOf(lateNightUtc, 'America/New_York')).toBe('2026-11-04');
  });

  it('handles the night clocks change', () => {
    // 2026-10-25 01:30 UTC: Lisbon has just gone back from UTC+1 to UTC+0.
    expect(localDateOf(new Date('2026-10-25T01:30:00Z'), 'Europe/Lisbon')).toBe('2026-10-25');
  });
});

describe('addDays', () => {
  it('crosses months, years and daylight-saving changes', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-29', -1)).toBe('2026-03-28');
  });
});

describe('weekRange', () => {
  it('runs Monday to Sunday', () => {
    // 2026-11-04 is a Wednesday.
    expect(weekRange('2026-11-04')).toEqual({ start: '2026-11-02', end: '2026-11-08' });
  });

  it('a Monday starts its own week and a Sunday ends it', () => {
    expect(weekRange('2026-11-02')).toEqual({ start: '2026-11-02', end: '2026-11-08' });
    expect(weekRange('2026-11-08')).toEqual({ start: '2026-11-02', end: '2026-11-08' });
  });

  it('can span two years', () => {
    expect(weekRange('2027-01-01')).toEqual({ start: '2026-12-28', end: '2027-01-03' });
  });
});

describe('isLocalDate', () => {
  it('accepts YYYY-MM-DD dates only', () => {
    expect(isLocalDate('2026-11-04')).toBe(true);
    expect(isLocalDate('2026-11-4')).toBe(false);
    expect(isLocalDate('2026-11-04T10:00:00Z')).toBe(false);
  });
});

describe('times of day', () => {
  it('reads "HH:MM"', () => {
    expect(parseTimeOfDay('09:30')).toBe(570);
    expect(parseTimeOfDay(' 7:05 ')).toBe(425);
    expect(parseTimeOfDay('24:00')).toBeNull();
    expect(parseTimeOfDay('9h30')).toBeNull();
  });

  it('turns a date and time in a timezone into the instant, summer and winter', () => {
    // Lisbon is UTC+1 in summer and UTC+0 in winter.
    expect(instantOf('2026-07-01', 570, 'Europe/Lisbon').toISOString()).toBe(
      '2026-07-01T08:30:00.000Z',
    );
    expect(instantOf('2026-12-01', 570, 'Europe/Lisbon').toISOString()).toBe(
      '2026-12-01T09:30:00.000Z',
    );
    // Just after midnight in Madrid is still the day before in UTC.
    expect(instantOf('2026-11-05', 30, 'Europe/Madrid').toISOString()).toBe(
      '2026-11-04T23:30:00.000Z',
    );
  });

  it('and back: the time of day of an instant in a timezone', () => {
    expect(timeOfDayIn(new Date('2026-07-01T08:30:00Z'), 'Europe/Lisbon')).toBe('09:30');
  });
});
