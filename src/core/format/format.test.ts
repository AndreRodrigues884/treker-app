import {
  formatDistance,
  formatDuration,
  formatLocalDate,
  formatSwimTime,
  formatWeight,
  initialsOf,
} from './index';

const NBSP = ' ';

describe('formatSwimTime', () => {
  it.each([
    [2761, '27.61', '27,61'],
    [500, '5.00', '5,00'],
    [0, '0.00', '0,00'],
    [5999, '59.99', '59,99'],
    [6000, '1:00.00', '1:00,00'],
    [6245, '1:02.45', '1:02,45'],
    [90509, '15:05.09', '15:05,09'],
    [366245, '1:01:02.45', '1:01:02,45'],
  ])('formats %i centiseconds as %s (en) and %s (pt)', (centiseconds, en, pt) => {
    expect(formatSwimTime(centiseconds, 'en')).toBe(en);
    expect(formatSwimTime(centiseconds, 'pt')).toBe(pt);
  });

  it.each([-1, 12.5, Number.NaN])('rejects invalid input %p', (value) => {
    expect(() => formatSwimTime(value, 'en')).toThrow(RangeError);
  });
});

describe('formatWeight', () => {
  it.each([
    [100, 'kg', `100${NBSP}kg`, `100${NBSP}kg`],
    [102.5, 'kg', `102.5${NBSP}kg`, `102,5${NBSP}kg`],
    [1.25, 'kg', `1.25${NBSP}kg`, `1,25${NBSP}kg`],
    [225, 'lb', `225${NBSP}lb`, `225${NBSP}lb`],
  ] as const)('formats %p %s', (value, unit, en, pt) => {
    expect(formatWeight(value, unit, 'en')).toBe(en);
    expect(formatWeight(value, unit, 'pt')).toBe(pt);
  });
});

describe('formatDistance', () => {
  it.each([
    [50, 'm', `50${NBSP}m`, `50${NBSP}m`],
    [1500, 'm', `1,500${NBSP}m`, `1500${NBSP}m`],
    [25, 'yd', `25${NBSP}yd`, `25${NBSP}yd`],
  ] as const)('formats %p %s', (value, unit, en, pt) => {
    expect(formatDistance(value, unit, 'en')).toBe(en);
    expect(formatDistance(value, unit, 'pt')).toBe(pt);
  });

  it('groups thousands in pt from 10 000 up', () => {
    expect(formatDistance(10000, 'm', 'pt')).toMatch(/^10\s000 m$/);
  });
});

describe('formatLocalDate', () => {
  it('shows weekday, day and month, never shifting the day', () => {
    expect(formatLocalDate('2026-11-05', 'en', '2026-11-06')).toBe('Thu, Nov 5');
    // The exact Portuguese form comes from the platform's ICU ("quinta, 5/11" in Node).
    expect(formatLocalDate('2026-11-05', 'pt', '2026-11-06')).toMatch(/^qui.*5/);
  });

  it('adds the year when it is not the current one', () => {
    expect(formatLocalDate('2025-12-31', 'en', '2026-11-06')).toBe('Wed, Dec 31, 2025');
  });
});

describe('initialsOf', () => {
  it.each([
    ['Ana Silva', 'AS'],
    ['ana', 'A'],
    ['  maria   da  costa ', 'MC'],
    ['Élio', 'É'],
    ['', ''],
    [null, ''],
  ])('%p -> %p', (name, initials) => {
    expect(initialsOf(name)).toBe(initials);
  });
});

describe('formatDuration', () => {
  it.each([
    [20, '1 min'],
    [45 * 60, '45 min'],
    [3600, '1 h'],
    [4500, '1 h 15 min'],
  ])('%i s -> %s', (seconds, text) => {
    expect(formatDuration(seconds).replace(/ /g, ' ')).toBe(text);
  });
});
