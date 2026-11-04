import { z } from 'zod';

import type { Validation } from '../auth';
import type { Language } from '../i18n';

export type WeightUnit = 'kg' | 'lb';
export type PoolUnit = 'm' | 'yd';

export type OnboardingForm = {
  displayName: string;
  weightUnit: WeightUnit;
  poolUnit: PoolUnit;
  // As typed, in the chosen weight unit; '' when skipped.
  bodyweight: string;
};

export type OnboardingErrorKey = 'nameRequired' | 'bodyweightInvalid';

// What gets written to the profile.
export type OnboardingProfile = {
  display_name: string;
  weight_unit: WeightUnit;
  pool_unit: PoolUnit;
  bodyweight_kg: number | null;
  locale: Language;
  timezone: string;
};

export const KG_PER_LB = 0.45359237;

// Matches profiles.bodyweight_kg (numeric(5, 2), between 0 and 500).
const MIN_BODYWEIGHT_KG = 20;
const MAX_BODYWEIGHT_KG = 400;
const MAX_NAME_LENGTH = 50;

const nameSchema = z.string().trim().min(1).max(MAX_NAME_LENGTH);

// Accepts "72.5" and "72,5" (Portuguese keyboards use a comma).
export function parseDecimal(input: string): number | null {
  const normalized = input.trim().replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(normalized)) return null;
  return Number(normalized);
}

export function toKilograms(value: number, unit: WeightUnit): number {
  const kg = unit === 'kg' ? value : value * KG_PER_LB;
  return Math.round(kg * 100) / 100;
}

export type OnboardingErrors = Partial<Record<'displayName' | 'bodyweight', OnboardingErrorKey>>;

export function validateOnboarding(
  form: OnboardingForm,
  device: { language: Language; timezone: string },
): Validation<OnboardingProfile, OnboardingErrors> {
  const errors: OnboardingErrors = {};

  const name = nameSchema.safeParse(form.displayName);
  if (!name.success) errors.displayName = 'nameRequired';

  let bodyweightKg: number | null = null;
  if (form.bodyweight.trim() !== '') {
    const value = parseDecimal(form.bodyweight);
    bodyweightKg = value === null ? null : toKilograms(value, form.weightUnit);
    if (
      bodyweightKg === null ||
      bodyweightKg < MIN_BODYWEIGHT_KG ||
      bodyweightKg > MAX_BODYWEIGHT_KG
    ) {
      errors.bodyweight = 'bodyweightInvalid';
    }
  }

  if (!name.success || errors.bodyweight) return { ok: false, error: errors };

  return {
    ok: true,
    value: {
      display_name: name.data,
      weight_unit: form.weightUnit,
      pool_unit: form.poolUnit,
      bodyweight_kg: bodyweightKg,
      locale: device.language,
      timezone: device.timezone,
    },
  };
}
