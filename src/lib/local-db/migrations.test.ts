import { getTableConfig } from 'drizzle-orm/sqlite-core';
import { openDatabaseSync } from 'expo-sqlite';

import { resetLocalDatabases } from '../../../test-utils/local-store';

import { currentVersion, LATEST_VERSION, migrations, runMigrations } from './migrations';
import { schema } from './schema';

type Column = { name: string; notnull: number };

function open(name = 'migrations.db') {
  return openDatabaseSync(name);
}

beforeEach(resetLocalDatabases);

describe('local migrations', () => {
  it('bring a new database to the latest version', () => {
    const db = open();
    expect(runMigrations(db)).toEqual(migrations.map((m) => m.version));
    expect(currentVersion(db)).toBe(LATEST_VERSION);
  });

  it('create exactly the tables and columns of the Drizzle schema', () => {
    const db = open();
    runMigrations(db);

    for (const table of Object.values(schema)) {
      const config = getTableConfig(table);
      const columns = db.getAllSync<Column>(`pragma table_info(${config.name})`);
      expect({
        table: config.name,
        columns: columns.map((c) => [c.name, c.notnull === 1]).sort(),
      }).toEqual({
        table: config.name,
        columns: config.columns.map((c) => [c.name, c.notNull || c.primary]).sort(),
      });
    }
  });

  it('upgrade an old database without losing its data', () => {
    const db = open();
    runMigrations(db, 1);
    expect(currentVersion(db)).toBe(1);

    db.runSync(
      `insert into activities (id, user_id, type, local_date, timezone, visibility, created_at, updated_at)
       values ('a1', 'u1', 'gym', '2026-11-04', 'Europe/Lisbon', 'private', 't', 't')`,
    );
    db.runSync(
      `insert into outbox (table_name, row_id, operation, payload, priority, created_at)
       values ('activities', 'a1', 'upsert', '{}', 4, 't')`,
    );

    expect(runMigrations(db)).toEqual([2]);
    expect(currentVersion(db)).toBe(LATEST_VERSION);
    expect(db.getAllSync('select id, local_date from activities')).toEqual([
      { id: 'a1', local_date: '2026-11-04' },
    ]);
    expect(db.getFirstSync<{ n: number }>('select count(*) as n from outbox')?.n).toBe(1);
    expect(
      db.getFirstSync<{ n: number }>(
        "select count(*) as n from sqlite_master where name = 'activities_local_date_idx'",
      )?.n,
    ).toBe(1);
  });

  it('do nothing when already up to date', () => {
    const db = open();
    runMigrations(db);
    expect(runMigrations(db)).toEqual([]);
  });

  it('roll back a migration that fails halfway, leaving the version unchanged', () => {
    const db = open();
    // A table v1 also creates: the migration fails on it, after creating the ones before.
    db.execSync('create table activities (id text)');

    expect(() => runMigrations(db)).toThrow();
    expect(currentVersion(db)).toBe(0);
    expect(
      db.getFirstSync<{ n: number }>(
        "select count(*) as n from sqlite_master where name = 'profiles'",
      )?.n,
    ).toBe(0);
  });
});
