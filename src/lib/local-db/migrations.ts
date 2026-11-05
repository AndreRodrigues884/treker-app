// Versioned migrations of the local database. The version lives in SQLite's PRAGMA user_version.
// Rules (an app update must never lose the athlete's data):
// - never edit a migration that has shipped; add a new one with the next version;
// - add before you remove (columns old app versions may still need);
// - each migration runs in one transaction together with the version bump.
// The tables must match schema.ts; migrations.test.ts checks they do.

export type Migration = { version: number; statements: string[] };

// What runMigrations needs from an expo-sqlite database.
export type MigrationDatabase = {
  execSync: (source: string) => void;
  getFirstSync: <T>(source: string) => T | null;
  withTransactionSync: (task: () => void) => void;
};

export const migrations: Migration[] = [
  {
    version: 1,
    statements: [
      `create table profiles (
        id text primary key not null,
        display_name text,
        weight_unit text not null,
        pool_unit text not null,
        timezone text not null,
        locale text not null,
        bodyweight_kg real,
        visibility text not null,
        created_at text not null,
        updated_at text not null,
        onboarded_at text,
        sports text,
        gym_focus text,
        swim_style text,
        default_pool_length text,
        weekly_target integer
      )`,
      `create table exercises (
        id text primary key not null,
        owner_id text,
        slug text,
        name_en text not null,
        name_pt text not null,
        muscle_group text not null,
        equipment text not null,
        tracks_load integer not null,
        unit text not null,
        adds_bodyweight integer not null,
        archived integer not null,
        created_at text not null,
        updated_at text not null,
        deleted_at text
      )`,
      `create table workout_templates (
        id text primary key not null,
        user_id text not null,
        name text not null,
        notes text,
        created_at text not null,
        updated_at text not null,
        deleted_at text
      )`,
      `create table workout_template_exercises (
        id text primary key not null,
        user_id text not null,
        template_id text not null references workout_templates (id),
        exercise_id text not null references exercises (id),
        position integer not null,
        target_sets integer,
        target_reps_min integer,
        target_reps_max integer,
        target_seconds integer,
        notes text,
        created_at text not null,
        updated_at text not null,
        deleted_at text
      )`,
      `create table activities (
        id text primary key not null,
        user_id text not null,
        type text not null,
        local_date text not null,
        timezone text not null,
        started_at text,
        ended_at text,
        title text,
        notes text,
        visibility text not null,
        template_id text references workout_templates (id),
        bodyweight_kg real,
        created_at text not null,
        updated_at text not null,
        deleted_at text
      )`,
      `create table gym_sets (
        id text primary key not null,
        user_id text not null,
        activity_id text not null references activities (id),
        exercise_id text not null references exercises (id),
        exercise_position integer not null,
        set_number integer not null,
        weight_kg real,
        reps integer,
        duration_s integer,
        rpe real,
        is_warmup integer not null,
        created_at text not null,
        updated_at text not null,
        deleted_at text
      )`,
      `create table swim_entries (
        id text primary key not null,
        user_id text not null,
        activity_id text not null references activities (id),
        position integer not null,
        stroke text not null,
        distance integer not null,
        pool_length text not null,
        time_cs integer not null,
        kind text not null,
        splits_cs text,
        created_at text not null,
        updated_at text not null,
        deleted_at text
      )`,
      `create table personal_records (
        id text primary key not null,
        user_id text not null,
        type text not null,
        exercise_id text,
        stroke text,
        distance integer,
        pool_length text,
        value real not null,
        previous_value real,
        sequence integer not null,
        activity_id text not null,
        gym_set_id text,
        swim_entry_id text,
        swim_kind text,
        local_date text not null,
        created_at text not null
      )`,
      `create table exercise_stats (
        user_id text not null,
        exercise_id text not null,
        best_one_rep_max_kg real,
        total_volume_kg real not null,
        set_count integer not null,
        last_local_date text,
        updated_at text not null,
        primary key (user_id, exercise_id)
      )`,
      `create table outbox (
        id integer primary key autoincrement not null,
        table_name text not null,
        row_id text not null,
        operation text not null check (operation in ('upsert', 'delete')),
        payload text not null,
        priority integer not null,
        created_at text not null,
        attempts integer not null default 0,
        last_error text,
        status text not null default 'pending' check (status in ('pending', 'sending', 'failed'))
      )`,
      // At most one waiting entry per row: later changes replace it (see outbox.ts). An entry
      // already being sent is left alone, so a change made meanwhile gets its own entry.
      `create unique index outbox_one_waiting_per_row
        on outbox (table_name, row_id) where status in ('pending', 'failed')`,
    ],
  },
  {
    version: 2,
    statements: [
      // The reads the app makes most: the calendar and weekly count, an activity's sets and times,
      // and the outbox in sending order.
      'create index activities_local_date_idx on activities (local_date)',
      'create index gym_sets_activity_id_idx on gym_sets (activity_id)',
      'create index swim_entries_activity_id_idx on swim_entries (activity_id)',
      'create index outbox_order_idx on outbox (status, priority, id)',
    ],
  },
];

export const LATEST_VERSION = migrations[migrations.length - 1].version;

export function currentVersion(db: MigrationDatabase): number {
  return db.getFirstSync<{ user_version: number }>('pragma user_version')?.user_version ?? 0;
}

// Brings the database up to `target` (the latest by default), one migration at a time. Returns
// the versions applied.
export function runMigrations(db: MigrationDatabase, target = LATEST_VERSION): number[] {
  const applied: number[] = [];
  for (const migration of migrations) {
    if (migration.version <= currentVersion(db) || migration.version > target) continue;
    db.withTransactionSync(() => {
      for (const statement of migration.statements) db.execSync(statement);
      db.execSync(`pragma user_version = ${migration.version}`);
    });
    applied.push(migration.version);
  }
  return applied;
}
