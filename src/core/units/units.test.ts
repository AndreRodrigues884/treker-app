import { fromKilograms, fromMetres, parseDecimal, toKilograms } from './index';

describe('parseDecimal', () => {
  it.each([
    ['72', 72],
    ['72.5', 72.5],
    ['72,5', 72.5],
    [' 80 ', 80],
  ])('parses %p', (input, expected) => {
    expect(parseDecimal(input)).toBe(expected);
  });

  it.each(['', 'abc', '72,5,1', '-70', '1e3'])('rejects %p', (input) => {
    expect(parseDecimal(input)).toBeNull();
  });
});

describe('toKilograms', () => {
  it('keeps kg and converts lb, rounded to 0.01 kg', () => {
    expect(toKilograms(72.5, 'kg')).toBe(72.5);
    expect(toKilograms(160, 'lb')).toBe(72.57);
  });
});

describe('fromKilograms', () => {
  it('converts back for display, rounded to 0.1', () => {
    expect(fromKilograms(72.57, 'lb')).toBe(160);
    expect(fromKilograms(72.5, 'kg')).toBe(72.5);
  });
});

describe('fromMetres', () => {
  it('shows metres in the pool unit, rounded', () => {
    expect(fromMetres(141.44, 'm')).toBe(141);
    expect(fromMetres(91.44, 'yd')).toBe(100);
  });
});
