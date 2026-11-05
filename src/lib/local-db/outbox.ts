// The outbox: every change to athlete data, waiting to be sent to the server (step 6b).
// Repositories write the row and its outbox entry in the same transaction (see write.ts).
import { and, asc, eq, inArray, sql } from 'drizzle-orm';

import type { LocalDatabase } from './database';
import { outbox } from './schema';

// Tables whose rows the athlete writes on the phone.
export const SYNCED_TABLES = [
  'profiles',
  'exercises',
  'workout_templates',
  'workout_template_exercises',
  'activities',
  'gym_sets',
  'swim_entries',
] as const;
export type SyncedTable = (typeof SYNCED_TABLES)[number];

export type OutboxOperation = 'upsert' | 'delete';
export type OutboxEntry = typeof outbox.$inferSelect;

// Sending order: a row goes after the rows it references (an activity before its sets, a custom
// exercise before the sets that use it). Within the same priority, oldest first.
export const OUTBOX_PRIORITY: Record<SyncedTable, number> = {
  profiles: 0,
  exercises: 1,
  workout_templates: 2,
  workout_template_exercises: 3,
  activities: 4,
  gym_sets: 5,
  swim_entries: 5,
};

// A transaction (or the database itself).
export type LocalWriter = Parameters<Parameters<LocalDatabase['transaction']>[0]>[0];

const WAITING = ['pending', 'failed'] as const;

/**
 * Records a change to a row. If the row already has an entry waiting to be sent, that entry is
 * replaced by this one (latest operation and payload, original position), so intermediate states
 * are never sent. An entry already being sent is left alone and this change gets a new one.
 */
export function enqueue(
  writer: LocalWriter,
  change: {
    table: SyncedTable;
    rowId: string;
    operation: OutboxOperation;
    payload: Record<string, unknown>;
    at: Date;
  },
): void {
  writer
    .insert(outbox)
    .values({
      table_name: change.table,
      row_id: change.rowId,
      operation: change.operation,
      payload: change.payload,
      priority: OUTBOX_PRIORITY[change.table],
      created_at: change.at.toISOString(),
      attempts: 0,
      last_error: null,
      status: 'pending',
    })
    .onConflictDoUpdate({
      target: [outbox.table_name, outbox.row_id],
      targetWhere: sql`status in ('pending', 'failed')`,
      set: {
        operation: change.operation,
        payload: change.payload,
        status: 'pending',
        attempts: 0,
        last_error: null,
      },
    })
    .run();
}

// Entries still to send (pending, or failed and to retry), in sending order.
export function waitingEntries(db: LocalDatabase | LocalWriter): OutboxEntry[] {
  return db
    .select()
    .from(outbox)
    .where(inArray(outbox.status, WAITING))
    .orderBy(asc(outbox.priority), asc(outbox.id))
    .all();
}

export function hasWaitingChange(
  db: LocalDatabase | LocalWriter,
  table: SyncedTable,
  rowId: string,
): boolean {
  const entry = db
    .select({ id: outbox.id })
    .from(outbox)
    .where(
      and(
        eq(outbox.table_name, table),
        eq(outbox.row_id, rowId),
        inArray(outbox.status, ['pending', 'failed', 'sending']),
      ),
    )
    .get();
  return entry !== undefined;
}
