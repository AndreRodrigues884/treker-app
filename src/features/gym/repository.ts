// Gym sets in the local database.
import { and, asc, eq, isNull } from 'drizzle-orm';

import { requireActivity, type GymSetRow } from '@/features/activities/repository';
import { gymSets, type LocalStore } from '@/lib/local-db';
import { inTransaction, recordChange, timestamp } from '@/lib/local-db/write';

export type { GymSetRow };

export type NewGymSet = {
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

export function addSet(store: LocalStore, input: NewGymSet): GymSetRow {
  const id = store.newId();
  const now = timestamp(store);
  return inTransaction(store, (tx) => {
    const activity = requireActivity(tx, store, input.activityId);
    if (activity.type !== 'gym') throw new Error('Sets belong to gym activities');

    tx.insert(gymSets)
      .values({
        id,
        user_id: store.userId,
        activity_id: input.activityId,
        exercise_id: input.exerciseId,
        exercise_position: input.exercisePosition,
        set_number: input.setNumber,
        weight_kg: input.weightKg ?? null,
        reps: input.reps ?? null,
        duration_s: input.durationS ?? null,
        rpe: input.rpe ?? null,
        is_warmup: input.isWarmup ?? false,
        created_at: now,
        updated_at: now,
        deleted_at: null,
      })
      .run();
    return recordChange<GymSetRow>(tx, store, 'gym_sets', gymSets, id, 'upsert');
  });
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

export function updateSet(store: LocalStore, id: string, changes: GymSetChanges): GymSetRow {
  return inTransaction(store, (tx) => {
    requireSet(tx, store, id);
    tx.update(gymSets)
      .set({ ...changes, updated_at: timestamp(store) })
      .where(eq(gymSets.id, id))
      .run();
    return recordChange<GymSetRow>(tx, store, 'gym_sets', gymSets, id, 'upsert');
  });
}

export function deleteSet(store: LocalStore, id: string): void {
  inTransaction(store, (tx) => {
    requireSet(tx, store, id);
    const deletedAt = timestamp(store);
    tx.update(gymSets)
      .set({ deleted_at: deletedAt, updated_at: deletedAt })
      .where(eq(gymSets.id, id))
      .run();
    recordChange(tx, store, 'gym_sets', gymSets, id, 'delete');
  });
}

export function listSets(store: LocalStore, activityId: string): GymSetRow[] {
  return store.db
    .select()
    .from(gymSets)
    .where(and(eq(gymSets.activity_id, activityId), isNull(gymSets.deleted_at)))
    .orderBy(asc(gymSets.exercise_position), asc(gymSets.set_number))
    .all();
}

function requireSet(reader: Pick<LocalStore['db'], 'select'>, store: LocalStore, id: string) {
  const set = reader.select().from(gymSets).where(eq(gymSets.id, id)).get();
  if (!set || set.user_id !== store.userId || set.deleted_at !== null) {
    throw new Error(`Set ${id} not found`);
  }
  return set;
}
