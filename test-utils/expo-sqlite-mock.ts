// expo-sqlite for Jest, backed by Node's built-in SQLite (node:sqlite), so tests run the real app
// code (Drizzle, migrations, repositories) against a real SQLite engine.
// - Each database "file" is an in-memory SQLite kept by name: closing and reopening keeps the
//   data, deleteDatabaseSync throws it away (like the files on the phone).
// - Writes emit change events like enableChangeListener does on the phone (one per statement).
// Only the parts of the API the app and Drizzle use are implemented.
// The parts of node:sqlite used here (the project has no @types/node).
type NodeRunResult = { changes: number | bigint; lastInsertRowid: number | bigint };
type NodeStatement = {
  run: (...params: never[]) => NodeRunResult;
  all: (...params: never[]) => unknown[];
  get: (...params: never[]) => unknown;
  columns: () => unknown[];
  setReturnArrays: (enabled: boolean) => void;
};
type NodeDatabase = {
  exec: (source: string) => void;
  prepare: (source: string) => NodeStatement;
  close: () => void;
};

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { DatabaseSync } = require('node:sqlite') as {
  DatabaseSync: new (location: string) => NodeDatabase;
};
type Params = unknown[] | Record<string, unknown> | undefined;
type ChangeEvent = {
  databaseName: string;
  databaseFilePath: string;
  tableName: string;
  rowId: number;
};

const files = new Map<string, NodeDatabase>();
const listeners = new Set<(event: ChangeEvent) => void>();

const WRITE =
  /^\s*(?:insert(?:\s+or\s+\w+)?\s+into|update(?:\s+or\s+\w+)?|delete\s+from)\s+["`]?(\w+)/i;

function bindable(value: unknown): unknown {
  if (value === undefined) return null;
  if (typeof value === 'boolean') return value ? 1 : 0;
  return value;
}

function bind(params: Params): unknown[] {
  if (params === undefined) return [];
  if (Array.isArray(params)) return params.map(bindable);
  throw new Error('Named parameters are not supported by the expo-sqlite mock');
}

function flatParams(args: unknown[]): Params {
  if (args.length === 1 && (Array.isArray(args[0]) || typeof args[0] === 'object')) {
    return args[0] as Params;
  }
  return args;
}

class MockDatabase {
  databasePath: string;
  private closed = false;

  constructor(
    readonly databaseName: string,
    private readonly sqlite: NodeDatabase,
    private readonly changeListener: boolean,
  ) {
    this.databasePath = `/mock/SQLite/${databaseName}`;
  }

  private ensureOpen() {
    if (this.closed) throw new Error(`Database ${this.databaseName} is closed`);
  }

  emit(source: string, changes: number, rowId: number) {
    const match = WRITE.exec(source);
    if (!this.changeListener || !match || changes === 0) return;
    const event = {
      databaseName: this.databaseName,
      databaseFilePath: this.databasePath,
      tableName: match[1],
      rowId,
    };
    // Native events reach JS asynchronously.
    void Promise.resolve().then(() => listeners.forEach((listener) => listener(event)));
  }

  execSync(source: string) {
    this.ensureOpen();
    this.sqlite.exec(source);
  }

  runSync(source: string, ...args: unknown[]) {
    this.ensureOpen();
    const result = this.sqlite.prepare(source).run(...(bind(flatParams(args)) as never[]));
    const changes = Number(result.changes);
    const lastInsertRowId = Number(result.lastInsertRowid);
    this.emit(source, changes, lastInsertRowId);
    return { changes, lastInsertRowId };
  }

  getAllSync<T>(source: string, ...args: unknown[]): T[] {
    this.ensureOpen();
    return this.sqlite.prepare(source).all(...(bind(flatParams(args)) as never[])) as T[];
  }

  getFirstSync<T>(source: string, ...args: unknown[]): T | null {
    this.ensureOpen();
    return (this.sqlite.prepare(source).get(...(bind(flatParams(args)) as never[])) as T) ?? null;
  }

  withTransactionSync(task: () => void) {
    this.ensureOpen();
    this.sqlite.exec('begin');
    try {
      task();
      this.sqlite.exec('commit');
    } catch (error) {
      this.sqlite.exec('rollback');
      throw error;
    }
  }

  prepareSync(source: string) {
    this.ensureOpen();
    const statement = this.sqlite.prepare(source);
    const reads = statement.columns().length > 0;
    let rawStatement: NodeStatement | undefined;

    return {
      executeSync: (params?: Params) => {
        const values = bind(params) as never[];
        if (reads) {
          const rows = statement.all(...values);
          return {
            changes: 0,
            lastInsertRowId: 0,
            getAllSync: () => rows,
            getFirstSync: () => rows[0] ?? null,
          };
        }
        const result = statement.run(...values);
        const changes = Number(result.changes);
        const lastInsertRowId = Number(result.lastInsertRowid);
        this.emit(source, changes, lastInsertRowId);
        return { changes, lastInsertRowId, getAllSync: () => [], getFirstSync: () => null };
      },
      executeForRawResultSync: (params?: Params) => {
        rawStatement ??= this.sqlite.prepare(source);
        rawStatement.setReturnArrays(true);
        const values = bind(params) as never[];
        const rows = reads ? rawStatement.all(...values) : [];
        if (!reads) {
          const result = rawStatement.run(...values);
          this.emit(source, Number(result.changes), Number(result.lastInsertRowid));
        }
        return { getAllSync: () => rows, getFirstSync: () => rows[0] ?? null };
      },
      finalizeSync: () => {},
    };
  }

  closeSync() {
    this.closed = true;
  }
}

export function openDatabaseSync(
  databaseName: string,
  options: { enableChangeListener?: boolean } = {},
): MockDatabase {
  let sqlite = files.get(databaseName);
  if (!sqlite) {
    sqlite = new DatabaseSync(':memory:');
    files.set(databaseName, sqlite);
  }
  return new MockDatabase(databaseName, sqlite, options.enableChangeListener ?? false);
}

export function deleteDatabaseSync(databaseName: string): void {
  const sqlite = files.get(databaseName);
  if (!sqlite) throw new Error(`Database ${databaseName} not found`);
  sqlite.close();
  files.delete(databaseName);
}

export function addDatabaseChangeListener(listener: (event: ChangeEvent) => void) {
  listeners.add(listener);
  return { remove: () => listeners.delete(listener) };
}

export const defaultDatabaseDirectory = '/mock/SQLite';

// Test helpers -----------------------------------------------------------------------------------

export function databaseExists(databaseName: string): boolean {
  return files.has(databaseName);
}

export function resetDatabases(): void {
  for (const sqlite of files.values()) sqlite.close();
  files.clear();
  listeners.clear();
}
