import { addDatabaseChangeListener } from 'expo-sqlite';
import { useEffect, useState } from 'react';

import type { LocalStore } from './database';

/**
 * Reads from the local database and reads again whenever one of `tables` changes (expo-sqlite's
 * change listener), so the screen follows the data. `read` must be synchronous and cheap; pass
 * in `deps` any value it uses besides the store (for example a date range).
 *
 * Unlike Drizzle's useLiveQuery, it listens to every table the read touches, not only the first.
 * Returns undefined only when there is no store (signed out).
 */
export function useLocalQuery<T>(
  store: LocalStore | null,
  read: (store: LocalStore) => T,
  tables: readonly string[],
  deps: readonly unknown[] = [],
): T | undefined {
  // The latest result pushed by a change event, tagged with what it was read for.
  const [pushed, setPushed] = useState<{ key: unknown[]; value: T } | undefined>(undefined);
  const key = [store, ...deps];
  const tableList = tables.join(',');

  useEffect(() => {
    if (!store) return;
    const watched = new Set(tableList.split(','));
    const subscription = addDatabaseChangeListener((event) => {
      if (event.databaseName === store.databaseName && watched.has(event.tableName)) {
        setPushed({ key: [store, ...deps], value: read(store) });
      }
    });
    return () => subscription.remove();
    // `read` is usually an inline function; the store, tables and deps decide when to re-read.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store, tableList, ...deps]);

  if (!store) return undefined;
  // Until a change arrives for these inputs, read directly (synchronous and cheap).
  return pushed && sameKey(pushed.key, key) ? pushed.value : read(store);
}

function sameKey(a: unknown[], b: unknown[]): boolean {
  return a.length === b.length && a.every((value, index) => Object.is(value, b[index]));
}
