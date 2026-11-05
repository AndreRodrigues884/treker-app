// Local SQLite schema (Drizzle). It mirrors the Postgres tables: same table and column names, same
// UUID ids and the same enum values, taken from the generated Supabase types so they never drift.
// schema-types.ts checks at compile time that every row type equals the server's.
//
// SQLite has no enums, booleans, arrays or timestamptz, so: enums are text limited to the server
// values, booleans are 0/1 integers, arrays are JSON text, and timestamps are ISO 8601 text.
// The tables are created by the versioned migrations in migrations.ts, not by Drizzle.
import { integer, primaryKey, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';

import { Constants, type Database } from '@/lib/supabase/database.types';

const enums = Constants.public.Enums;
type Enums = Database['public']['Enums'];

const timestamp = (name: string) => text(name);

// Athlete data: read and written on the phone, then sent to the server through the outbox. ------

export const profiles = sqliteTable('profiles', {
  id: text('id').primaryKey(),
  display_name: text('display_name'),
  weight_unit: text('weight_unit', { enum: enums.weight_unit }).notNull(),
  pool_unit: text('pool_unit', { enum: enums.pool_unit }).notNull(),
  timezone: text('timezone').notNull(),
  locale: text('locale').notNull(),
  bodyweight_kg: real('bodyweight_kg'),
  visibility: text('visibility', { enum: enums.visibility }).notNull(),
  created_at: timestamp('created_at').notNull(),
  updated_at: timestamp('updated_at').notNull(),
  onboarded_at: timestamp('onboarded_at'),
  sports: text('sports', { mode: 'json' }).$type<Enums['activity_type'][] | null>(),
  gym_focus: text('gym_focus', { enum: enums.gym_focus }),
  swim_style: text('swim_style', { enum: enums.swim_style }),
  default_pool_length: text('default_pool_length', { enum: enums.pool_length }),
  weekly_target: integer('weekly_target'),
});

// The shared library (owner_id null, read-only, arrives from the server in step 6b) and the
// athlete's custom exercises.
export const exercises = sqliteTable('exercises', {
  id: text('id').primaryKey(),
  owner_id: text('owner_id'),
  slug: text('slug'),
  name_en: text('name_en').notNull(),
  name_pt: text('name_pt').notNull(),
  muscle_group: text('muscle_group', { enum: enums.muscle_group }).notNull(),
  equipment: text('equipment', { enum: enums.equipment }).notNull(),
  tracks_load: integer('tracks_load', { mode: 'boolean' }).notNull(),
  unit: text('unit', { enum: enums.exercise_unit }).notNull(),
  adds_bodyweight: integer('adds_bodyweight', { mode: 'boolean' }).notNull(),
  archived: integer('archived', { mode: 'boolean' }).notNull(),
  created_at: timestamp('created_at').notNull(),
  updated_at: timestamp('updated_at').notNull(),
  deleted_at: timestamp('deleted_at'),
});

export const workoutTemplates = sqliteTable('workout_templates', {
  id: text('id').primaryKey(),
  user_id: text('user_id').notNull(),
  name: text('name').notNull(),
  notes: text('notes'),
  created_at: timestamp('created_at').notNull(),
  updated_at: timestamp('updated_at').notNull(),
  deleted_at: timestamp('deleted_at'),
});

export const workoutTemplateExercises = sqliteTable('workout_template_exercises', {
  id: text('id').primaryKey(),
  user_id: text('user_id').notNull(),
  template_id: text('template_id')
    .notNull()
    .references(() => workoutTemplates.id),
  exercise_id: text('exercise_id')
    .notNull()
    .references(() => exercises.id),
  position: integer('position').notNull(),
  target_sets: integer('target_sets'),
  target_reps_min: integer('target_reps_min'),
  target_reps_max: integer('target_reps_max'),
  target_seconds: integer('target_seconds'),
  notes: text('notes'),
  created_at: timestamp('created_at').notNull(),
  updated_at: timestamp('updated_at').notNull(),
  deleted_at: timestamp('deleted_at'),
});

export const activities = sqliteTable('activities', {
  id: text('id').primaryKey(),
  user_id: text('user_id').notNull(),
  type: text('type', { enum: enums.activity_type }).notNull(),
  local_date: text('local_date').notNull(),
  timezone: text('timezone').notNull(),
  started_at: timestamp('started_at'),
  ended_at: timestamp('ended_at'),
  title: text('title'),
  notes: text('notes'),
  visibility: text('visibility', { enum: enums.visibility }).notNull(),
  template_id: text('template_id').references(() => workoutTemplates.id),
  bodyweight_kg: real('bodyweight_kg'),
  created_at: timestamp('created_at').notNull(),
  updated_at: timestamp('updated_at').notNull(),
  deleted_at: timestamp('deleted_at'),
});

export const gymSets = sqliteTable('gym_sets', {
  id: text('id').primaryKey(),
  user_id: text('user_id').notNull(),
  activity_id: text('activity_id')
    .notNull()
    .references(() => activities.id),
  exercise_id: text('exercise_id')
    .notNull()
    .references(() => exercises.id),
  exercise_position: integer('exercise_position').notNull(),
  set_number: integer('set_number').notNull(),
  weight_kg: real('weight_kg'),
  reps: integer('reps'),
  duration_s: integer('duration_s'),
  rpe: real('rpe'),
  is_warmup: integer('is_warmup', { mode: 'boolean' }).notNull(),
  created_at: timestamp('created_at').notNull(),
  updated_at: timestamp('updated_at').notNull(),
  deleted_at: timestamp('deleted_at'),
});

export const swimEntries = sqliteTable('swim_entries', {
  id: text('id').primaryKey(),
  user_id: text('user_id').notNull(),
  activity_id: text('activity_id')
    .notNull()
    .references(() => activities.id),
  position: integer('position').notNull(),
  stroke: text('stroke', { enum: enums.swim_stroke }).notNull(),
  distance: integer('distance').notNull(),
  pool_length: text('pool_length', { enum: enums.pool_length }).notNull(),
  time_cs: integer('time_cs').notNull(),
  kind: text('kind', { enum: enums.swim_kind }).notNull(),
  splits_cs: text('splits_cs', { mode: 'json' }).$type<number[] | null>(),
  created_at: timestamp('created_at').notNull(),
  updated_at: timestamp('updated_at').notNull(),
  deleted_at: timestamp('deleted_at'),
});

// Read-only on the phone: computed by Postgres, they arrive from the server in step 6b. ---------

export const personalRecords = sqliteTable('personal_records', {
  id: text('id').primaryKey(),
  user_id: text('user_id').notNull(),
  type: text('type', { enum: enums.activity_type }).notNull(),
  exercise_id: text('exercise_id'),
  stroke: text('stroke', { enum: enums.swim_stroke }),
  distance: integer('distance'),
  pool_length: text('pool_length', { enum: enums.pool_length }),
  value: real('value').notNull(),
  previous_value: real('previous_value'),
  sequence: integer('sequence').notNull(),
  activity_id: text('activity_id').notNull(),
  gym_set_id: text('gym_set_id'),
  swim_entry_id: text('swim_entry_id'),
  swim_kind: text('swim_kind', { enum: enums.swim_kind }),
  local_date: text('local_date').notNull(),
  created_at: timestamp('created_at').notNull(),
});

export const exerciseStats = sqliteTable(
  'exercise_stats',
  {
    user_id: text('user_id').notNull(),
    exercise_id: text('exercise_id').notNull(),
    best_one_rep_max_kg: real('best_one_rep_max_kg'),
    total_volume_kg: real('total_volume_kg').notNull(),
    set_count: integer('set_count').notNull(),
    last_local_date: text('last_local_date'),
    updated_at: timestamp('updated_at').notNull(),
  },
  (table) => [primaryKey({ columns: [table.user_id, table.exercise_id] })],
);

// Outbox: changes waiting to be sent to the server (step 6b). --------------------------------------

export const outboxStatuses = ['pending', 'sending', 'failed'] as const;
export const outboxOperations = ['upsert', 'delete'] as const;

export const outbox = sqliteTable('outbox', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  table_name: text('table_name').notNull(),
  row_id: text('row_id').notNull(),
  operation: text('operation', { enum: outboxOperations }).notNull(),
  // The whole row as it should end up on the server.
  payload: text('payload', { mode: 'json' }).$type<Record<string, unknown>>().notNull(),
  // Parents before children when sending (see outbox.ts).
  priority: integer('priority').notNull(),
  created_at: timestamp('created_at').notNull(),
  attempts: integer('attempts').notNull(),
  last_error: text('last_error'),
  status: text('status', { enum: outboxStatuses }).notNull(),
});

export const schema = {
  profiles,
  exercises,
  workoutTemplates,
  workoutTemplateExercises,
  activities,
  gymSets,
  swimEntries,
  personalRecords,
  exerciseStats,
  outbox,
};

export type LocalSchema = typeof schema;
