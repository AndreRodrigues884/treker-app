// Gym sets. Postgres checks the set belongs to one of the athlete's gym activities and uses an
// exercise they may use (see docs/database.md).
import type { GymSetRow } from '@/features/activities/repository';
import type { DataContext } from '@/lib/data/context';
import { throwIfError, unwrap } from '@/lib/data/result';
import { supabase } from '@/lib/supabase/client';

export type { GymSetRow };

export type NewGymSet = {
  // Pass the same id when retrying, so the set is not created twice.
  id?: string;
  activityId: string;
  exerciseId: string;
  exercisePosition: number;
  setNumber: number;
  weightKg?: number | null;
  reps?: number | null;
  durationS?: number | null;
  rpe?: number | null;
  isWarmup?: boolean;
};

export async function addSet(ctx: DataContext, input: NewGymSet): Promise<GymSetRow> {
  const row = {
    id: input.id ?? ctx.newId(),
    user_id: ctx.userId,
    activity_id: input.activityId,
    exercise_id: input.exerciseId,
    exercise_position: input.exercisePosition,
    set_number: input.setNumber,
    weight_kg: input.weightKg ?? null,
    reps: input.reps ?? null,
    duration_s: input.durationS ?? null,
    rpe: input.rpe ?? null,
    is_warmup: input.isWarmup ?? false,
  };
  return unwrap(
    await supabase.from('gym_sets').upsert(row, { onConflict: 'id' }).select().single(),
  );
}

export type GymSetChanges = Partial<
  Pick<
    GymSetRow,
    | 'exercise_id'
    | 'exercise_position'
    | 'set_number'
    | 'weight_kg'
    | 'reps'
    | 'duration_s'
    | 'rpe'
    | 'is_warmup'
  >
>;

export async function updateSet(
  ctx: DataContext,
  id: string,
  changes: GymSetChanges,
): Promise<GymSetRow> {
  return unwrap(
    await supabase
      .from('gym_sets')
      .update(changes)
      .eq('id', id)
      .eq('user_id', ctx.userId)
      .select()
      .single(),
  );
}

export async function deleteSet(ctx: DataContext, id: string): Promise<void> {
  throwIfError(
    await supabase
      .from('gym_sets')
      .update({ deleted_at: ctx.now().toISOString() })
      .eq('id', id)
      .eq('user_id', ctx.userId)
      .is('deleted_at', null),
  );
}

export async function listSets(ctx: DataContext, activityId: string): Promise<GymSetRow[]> {
  return unwrap(
    await supabase
      .from('gym_sets')
      .select('*')
      .eq('activity_id', activityId)
      .eq('user_id', ctx.userId)
      .is('deleted_at', null)
      .order('exercise_position', { ascending: true })
      .order('set_number', { ascending: true }),
  );
}
