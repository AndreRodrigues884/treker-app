// Swim times in the local database.
import { eq } from 'drizzle-orm';

import { requireActivity, type SwimEntryRow } from '@/features/activities/repository';
import { swimEntries, type LocalStore } from '@/lib/local-db';
import { inTransaction, recordChange, timestamp } from '@/lib/local-db/write';

export type { SwimEntryRow };

export type NewSwimEntry = {
  activityId: string;
  position: number;
  stroke: SwimEntryRow['stroke'];
  distance: number;
  poolLength: SwimEntryRow['pool_length'];
  timeCs: number;
  kind: SwimEntryRow['kind'];
  splitsCs?: number[] | null;
};

export function addSwimEntry(store: LocalStore, input: NewSwimEntry): SwimEntryRow {
  const id = store.newId();
  const now = timestamp(store);
  return inTransaction(store, (tx) => {
    const activity = requireActivity(tx, store, input.activityId);
    if (activity.type !== 'swim') throw new Error('Swim times belong to swim activities');

    tx.insert(swimEntries)
      .values({
        id,
        user_id: store.userId,
        activity_id: input.activityId,
        position: input.position,
        stroke: input.stroke,
        distance: input.distance,
        pool_length: input.poolLength,
        time_cs: input.timeCs,
        kind: input.kind,
        splits_cs: input.splitsCs ?? null,
        created_at: now,
        updated_at: now,
        deleted_at: null,
      })
      .run();
    return recordChange<SwimEntryRow>(tx, store, 'swim_entries', swimEntries, id, 'upsert');
  });
}

export type SwimEntryChanges = Partial<
  Pick<
    SwimEntryRow,
    'position' | 'stroke' | 'distance' | 'pool_length' | 'time_cs' | 'kind' | 'splits_cs'
  >
>;

export function updateSwimEntry(
  store: LocalStore,
  id: string,
  changes: SwimEntryChanges,
): SwimEntryRow {
  return inTransaction(store, (tx) => {
    requireEntry(tx, store, id);
    tx.update(swimEntries)
      .set({ ...changes, updated_at: timestamp(store) })
      .where(eq(swimEntries.id, id))
      .run();
    return recordChange<SwimEntryRow>(tx, store, 'swim_entries', swimEntries, id, 'upsert');
  });
}

export function deleteSwimEntry(store: LocalStore, id: string): void {
  inTransaction(store, (tx) => {
    requireEntry(tx, store, id);
    const deletedAt = timestamp(store);
    tx.update(swimEntries)
      .set({ deleted_at: deletedAt, updated_at: deletedAt })
      .where(eq(swimEntries.id, id))
      .run();
    recordChange(tx, store, 'swim_entries', swimEntries, id, 'delete');
  });
}

function requireEntry(reader: Pick<LocalStore['db'], 'select'>, store: LocalStore, id: string) {
  const entry = reader.select().from(swimEntries).where(eq(swimEntries.id, id)).get();
  if (!entry || entry.user_id !== store.userId || entry.deleted_at !== null) {
    throw new Error(`Swim entry ${id} not found`);
  }
  return entry;
}
