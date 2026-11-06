import type { ActivityType } from '@/core/activities';
import { formatDistance, formatSwimTime, formatWeight } from '@/core/format';
import { interpolate, type Language, type Messages } from '@/core/i18n';
import { fromKilograms, fromMetres, type DistanceUnit, type WeightUnit } from '@/core/units';
import { poolLengthLabels, sportLabel } from '@/features/onboarding/labels';

// How a workout is described in the profile list and on its screen.

export type DisplayUnits = { weight: WeightUnit; distance: DistanceUnit; language: Language };

// Its title, or the sport when it has none ("Swimming").
export function workoutTitle(t: Messages, type: ActivityType, title: string | null): string {
  return title?.trim() || sportLabel(t, type);
}

// "3 sets" at the gym, "2 times" in the pool.
export function workoutCount(t: Messages, type: ActivityType, count: number): string {
  const words = t.workout;
  if (type === 'gym') {
    return count === 1 ? words.setCountOne : interpolate(words.setCount, { count });
  }
  return count === 1 ? words.timeCountOne : interpolate(words.timeCount, { count });
}

// The volume lifted ("1,000 kg") or the distance swum ("141 m"), in the athlete's units.
export function workoutAmount(
  workout: { type: ActivityType; volumeKg: number | null; distanceM: number | null },
  units: DisplayUnits,
): string | null {
  if (workout.type === 'gym' && workout.volumeKg !== null) {
    return formatWeight(
      fromKilograms(workout.volumeKg, units.weight),
      units.weight,
      units.language,
    );
  }
  if (workout.type === 'swim' && workout.distanceM !== null) {
    return formatDistance(
      fromMetres(workout.distanceM, units.distance),
      units.distance,
      units.language,
    );
  }
  return null;
}

// One set: "100 kg × 5", "× 12" (no weight), "60 s", "20 kg · 60 s". Assistance shows as a
// negative weight ("−20 kg × 8").
export function setText(
  set: { weight_kg: number | null; reps: number | null; duration_s: number | null },
  units: DisplayUnits,
): string {
  const weight =
    set.weight_kg === null
      ? null
      : formatWeight(fromKilograms(set.weight_kg, units.weight), units.weight, units.language);
  if (set.reps !== null) return weight ? `${weight} × ${set.reps}` : `× ${set.reps}`;
  const seconds = set.duration_s !== null ? `${set.duration_s} s` : null;
  return [weight, seconds].filter(Boolean).join(' · ');
}

// A swim event: "50 m Freestyle · 25 m". The distance is in the pool's own unit.
export function swimEventText(
  t: Messages,
  event: {
    stroke: 'free' | 'back' | 'breast' | 'fly' | 'im';
    distance: number;
    pool_length: '25m' | '50m' | '25yd';
  },
  language: Language,
): string {
  const unit: DistanceUnit = event.pool_length === '25yd' ? 'yd' : 'm';
  return `${formatDistance(event.distance, unit, language)} ${t.workout.strokes[event.stroke]} · ${
    poolLengthLabels(t)[event.pool_length].title
  }`;
}

export function swimTimeText(timeCs: number, language: Language): string {
  return formatSwimTime(timeCs, language);
}
