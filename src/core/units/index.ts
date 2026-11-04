export type WeightUnit = 'kg' | 'lb';

export const KG_PER_LB = 0.45359237;

// Accepts "72.5" and "72,5" (Portuguese keyboards use a comma). Null when not a plain positive
// number.
export function parseDecimal(input: string): number | null {
  const normalized = input.trim().replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(normalized)) return null;
  return Number(normalized);
}

// Rounded to 0.01 kg, the precision of profiles.bodyweight_kg.
export function toKilograms(value: number, unit: WeightUnit): number {
  const kg = unit === 'kg' ? value : value * KG_PER_LB;
  return Math.round(kg * 100) / 100;
}

// Rounded to 0.1 in the target unit, for display.
export function fromKilograms(kg: number, unit: WeightUnit): number {
  const value = unit === 'kg' ? kg : kg / KG_PER_LB;
  return Math.round(value * 10) / 10;
}
