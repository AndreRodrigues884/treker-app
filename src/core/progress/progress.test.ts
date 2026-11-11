import { addMonths, describeTrend, isRecentRecord, rangeStart } from '.';

describe('ranges', () => {
  it('3 months, 1 year, or everything', () => {
    expect(rangeStart('3m', '2026-11-11')).toBe('2026-08-11');
    expect(rangeStart('1y', '2026-11-11')).toBe('2025-11-11');
    expect(rangeStart('all', '2026-11-11')).toBeNull();
  });

  it('keeps the day when the month has it, else the last day', () => {
    expect(addMonths('2026-05-31', -3)).toBe('2026-02-28');
    expect(addMonths('2024-05-31', -3)).toBe('2024-02-29');
    expect(addMonths('2026-01-15', -3)).toBe('2025-10-15');
  });
});

describe('describeTrend (the screen reader summary of a chart)', () => {
  it('first and last point, and the direction', () => {
    expect(
      describeTrend([
        { localDate: '2026-08-12', value: 100 },
        { localDate: '2026-09-01', value: 95 },
        { localDate: '2026-11-01', value: 116.67 },
      ]),
    ).toEqual({
      first: { localDate: '2026-08-12', value: 100 },
      last: { localDate: '2026-11-01', value: 116.67 },
      direction: 'up',
      count: 3,
    });
    expect(describeTrend([{ localDate: '2026-08-12', value: 100 }])?.direction).toBe('same');
    expect(
      describeTrend([
        { localDate: '2026-08-12', value: 100 },
        { localDate: '2026-09-12', value: 90 },
      ])?.direction,
    ).toBe('down');
  });

  it('is null without points', () => {
    expect(describeTrend([])).toBeNull();
  });
});

describe('isRecentRecord', () => {
  it('the last 7 days, today included', () => {
    expect(isRecentRecord('2026-11-11', '2026-11-11')).toBe(true);
    expect(isRecentRecord('2026-11-05', '2026-11-11')).toBe(true);
    expect(isRecentRecord('2026-11-04', '2026-11-11')).toBe(false);
  });
});
