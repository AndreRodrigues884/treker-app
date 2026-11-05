// Write rules shared by every repository:
// 1. a row and its outbox entry are written in the same transaction (both or neither);
// 2. the outbox payload is the row as stored after the write;
// 3. deleting is setting deleted_at, sent as a 'delete' operation;
// 4. updated_at is set on every write (the server sets its own when the change arrives).
import { eq } from 'drizzle-orm';
import type { SQLiteTable } from 'drizzle-orm/sqlite-core';

import type { LocalStore } from './database';
import { enqueue, type LocalWriter, type OutboxOperation, type SyncedTable } from './outbox';

type TableWithId = SQLiteTable & { id: Parameters<typeof eq>[0] };

export function inTransaction<T>(store: LocalStore, work: (tx: LocalWriter) => T): T {
  return store.db.transaction(work);
}

// Reads the row back and records it in the outbox. Call inside inTransaction, after the write.
export function recordChange<Row extends { id: string }>(
  tx: LocalWriter,
  store: LocalStore,
  table: SyncedTable,
  drizzleTable: TableWithId,
  id: string,
  operation: OutboxOperation,
): Row {
  const row = tx.select().from(drizzleTable).where(eq(drizzleTable.id, id)).get() as
    Row | undefined;
  if (!row) throw new Error(`${table} ${id} was not written`);
  enqueue(tx, { table, rowId: id, operation, payload: row, at: store.now() });
  return row;
}

export function timestamp(store: LocalStore): string {
  return store.now().toISOString();
}
