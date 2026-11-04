import { parseDecimal, toKilograms, validateOnboarding, type OnboardingForm } from './onboarding';

const device = { language: 'pt' as const, timezone: 'Europe/Lisbon' };
const form: OnboardingForm = {
  displayName: ' Ana ',
  weightUnit: 'kg',
  poolUnit: 'm',
  bodyweight: '',
};

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

describe('validateOnboarding', () => {
  it('builds the profile with the device language and timezone', () => {
    expect(validateOnboarding(form, device)).toEqual({
      ok: true,
      value: {
        display_name: 'Ana',
        weight_unit: 'kg',
        pool_unit: 'm',
        bodyweight_kg: null,
        locale: 'pt',
        timezone: 'Europe/Lisbon',
      },
    });
  });

  it('stores the bodyweight in kg whatever unit was typed', () => {
    const result = validateOnboarding({ ...form, weightUnit: 'lb', bodyweight: '160' }, device);
    expect(result.ok && result.value.bodyweight_kg).toBe(72.57);
  });

  it('requires a name', () => {
    expect(validateOnboarding({ ...form, displayName: '   ' }, device)).toEqual({
      ok: false,
      error: { displayName: 'nameRequired' },
    });
  });

  it.each(['abc', '5', '900'])('rejects an implausible bodyweight %p', (bodyweight) => {
    expect(validateOnboarding({ ...form, bodyweight }, device)).toEqual({
      ok: false,
      error: { bodyweight: 'bodyweightInvalid' },
    });
  });
});
