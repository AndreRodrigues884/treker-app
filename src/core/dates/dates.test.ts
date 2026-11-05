import { addDays, isLocalDate, localDateOf, weekRange } from './index';

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
