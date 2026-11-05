import { drizzle, type ExpoSQLiteDatabase } from 'drizzle-orm/expo-sqlite';
import { randomUUID } from 'expo-crypto';
import { deleteDatabaseSync, openDatabaseSync, type SQLiteDatabase } from 'expo-sqlite';

import { runMigrations } from './migrations';
import { schema, type LocalSchema } from './schema';

export type LocalDatabase = ExpoSQLiteDatabase<LocalSchema>;

// Everything a repository needs: the athlete's database, who they are, and the clock and id
// generator (replaceable in tests).
export type LocalStore = {
  userId: string;
  databaseName: string;
  sqlite: SQLiteDatabase;
  db: LocalDatabase;
  now: () => Date;
  newId: () => string;
};

// One database file per user, so two accounts on the same phone never mix their data.
export function databaseNameFor(userId: string): string {
  if (!/^[0-9a-f-]{36}$/i.test(userId)) {
    throw new Error(`Not a user id: ${userId}`);
  }
  return `treker-${userId.toLowerCase()}.db`;
}

// Open databases, one per user, shared by the whole app.
const openStores = new Map<string, LocalStore>();

export function openLocalStore(
  userId: string,
  options: { now?: () => Date; newId?: () => string } = {},
): LocalStore {
  const existing = openStores.get(userId);
  if (existing) return existing;

  const databaseName = databaseNameFor(userId);
  // The change listener powers useLocalQuery.
  const sqlite = openDatabaseSync(databaseName, { enableChangeListener: true });
  sqlite.execSync('pragma journal_mode = wal');
  // Set outside any transaction, where SQLite ignores it.
  sqlite.execSync('pragma foreign_keys = on');
  runMigrations(sqlite);

  const store: LocalStore = {
    userId,
    databaseName,
    sqlite,
    db: drizzle(sqlite, { schema }),
    now: options.now ?? (() => new Date()),
    newId: options.newId ?? randomUUID,
  };
  openStores.set(userId, store);
  return store;
}

export function closeLocalStore(userId: string): void {
  const store = openStores.get(userId);
  if (!store) return;
  openStores.delete(userId);
  store.sqlite.closeSync();
}

// Deletes the user's database file (account deleted, or the dev "delete local database" button).
export function deleteLocalStore(userId: string): void {
  closeLocalStore(userId);
  deleteDatabaseSync(databaseNameFor(userId));
}

// Tests only: forget every open database.
export function closeAllLocalStores(): void {
  for (const userId of [...openStores.keys()]) closeLocalStore(userId);
}
