// Activities (one row per workout, gym or swim) in the local database. Screens use these
// functions; they never write SQL or call Supabase for training data.
import { and, asc, between, count, desc, eq, isNull } from 'drizzle-orm';

import { localDateOf, type LocalDate } from '@/core/dates';
import { activities, gymSets, profiles, swimEntries, type LocalStore } from '@/lib/local-db';
import { inTransaction, recordChange, timestamp } from '@/lib/local-db/write';

export type ActivityRow = typeof activities.$inferSelect;
export type GymSetRow = typeof gymSets.$inferSelect;
export type SwimEntryRow = typeof swimEntries.$inferSelect;
export type ActivityType = ActivityRow['type'];

export type ActivityWithEntries = {
  activity: ActivityRow;
  gymSets: GymSetRow[];
  swimEntries: SwimEntryRow[];
};

export type StartActivityInput = {
  type: ActivityType;
  // The athlete's timezone; the local date is taken in it.
  timezone: string;
  startedAt?: Date;
  // Defaults to the date of startedAt in the timezone.
  localDate?: LocalDate;
  title?: string | null;
  templateId?: string | null;
  // Defaults to the profile's bodyweight, like the server does.
  bodyweightKg?: number | null;
};

export function startActivity(store: LocalStore, input: StartActivityInput): ActivityRow {
  const startedAt = input.startedAt ?? store.now();
  const id = store.newId();
  const now = timestamp(store);

  return inTransaction(store, (tx) => {
    const bodyweight =
      input.bodyweightKg !== undefined
        ? input.bodyweightKg
        : (tx
            .select({ bodyweight_kg: profiles.bodyweight_kg })
            .from(profiles)
            .where(eq(profiles.id, store.userId))
            .get()?.bodyweight_kg ?? null);

    tx.insert(activities)
      .values({
        id,
        user_id: store.userId,
        type: input.type,
        local_date: input.localDate ?? localDateOf(startedAt, input.timezone),
        timezone: input.timezone,
        started_at: startedAt.toISOString(),
        ended_at: null,
        title: input.title ?? null,
        notes: null,
        visibility: 'private',
        template_id: input.templateId ?? null,
        bodyweight_kg: bodyweight,
        created_at: now,
        updated_at: now,
        deleted_at: null,
      })
      .run();
    return recordChange<ActivityRow>(tx, store, 'activities', activities, id, 'upsert');
  });
}

export function finishActivity(
  store: LocalStore,
  id: string,
  endedAt: Date = store.now(),
): ActivityRow {
  return updateActivity(store, id, { ended_at: endedAt.toISOString() });
}

export type ActivityChanges = Partial<
  Pick<ActivityRow, 'title' | 'notes' | 'local_date' | 'started_at' | 'ended_at' | 'bodyweight_kg'>
>;

export function updateActivity(
  store: LocalStore,
  id: string,
  changes: ActivityChanges,
): ActivityRow {
  return inTransaction(store, (tx) => {
    requireActivity(tx, store, id);
    tx.update(activities)
      .set({ ...changes, updated_at: timestamp(store) })
      .where(eq(activities.id, id))
      .run();
    return recordChange<ActivityRow>(tx, store, 'activities', activities, id, 'upsert');
  });
}

// Deletes the activity and its sets and times (each marked deleted_at and queued as a delete).
export function deleteActivity(store: LocalStore, id: string): void {
  inTransaction(store, (tx) => {
    requireActivity(tx, store, id);
    const deletedAt = timestamp(store);
    const children = [
      { table: 'gym_sets' as const, drizzleTable: gymSets },
      { table: 'swim_entries' as const, drizzleTable: swimEntries },
    ];
    for (const { table, drizzleTable } of children) {
      const rows = tx
        .select({ id: drizzleTable.id })
        .from(drizzleTable)
        .where(and(eq(drizzleTable.activity_id, id), isNull(drizzleTable.deleted_at)))
        .all();
      for (const row of rows) {
        tx.update(drizzleTable)
          .set({ deleted_at: deletedAt, updated_at: deletedAt })
          .where(eq(drizzleTable.id, row.id))
          .run();
        recordChange(tx, store, table, drizzleTable, row.id, 'delete');
      }
    }
    tx.update(activities)
      .set({ deleted_at: deletedAt, updated_at: deletedAt })
      .where(eq(activities.id, id))
      .run();
    recordChange(tx, store, 'activities', activities, id, 'delete');
  });
}

// An activity with its sets (in exercise and set order) and swim times (in order), without
// deleted rows. Null when missing or deleted.
export function getActivityWithEntries(store: LocalStore, id: string): ActivityWithEntries | null {
  const activity = store.db
    .select()
    .from(activities)
    .where(and(eq(activities.id, id), isNull(activities.deleted_at)))
    .get();
  if (!activity) return null;

  return {
    activity,
    gymSets: store.db
      .select()
      .from(gymSets)
      .where(and(eq(gymSets.activity_id, id), isNull(gymSets.deleted_at)))
      .orderBy(asc(gymSets.exercise_position), asc(gymSets.set_number))
      .all(),
    swimEntries: store.db
      .select()
      .from(swimEntries)
      .where(and(eq(swimEntries.activity_id, id), isNull(swimEntries.deleted_at)))
      .orderBy(asc(swimEntries.position))
      .all(),
  };
}

export type DateRange = { start: LocalDate; end: LocalDate };

// Activities whose local date falls in the range (inclusive), newest first, without deleted ones.
export function listActivities(store: LocalStore, range: DateRange): ActivityRow[] {
  return store.db
    .select()
    .from(activities)
    .where(inRange(range))
    .orderBy(desc(activities.local_date), desc(activities.started_at))
    .all();
}

export function countActivities(store: LocalStore, range: DateRange): number {
  return (
    store.db.select({ total: count() }).from(activities).where(inRange(range)).get()?.total ?? 0
  );
}

function inRange(range: DateRange) {
  return and(between(activities.local_date, range.start, range.end), isNull(activities.deleted_at));
}

type Reader = Pick<LocalStore['db'], 'select'>;

// Throws unless the activity exists, belongs to this user and is not deleted.
export function requireActivity(reader: Reader, store: LocalStore, id: string): ActivityRow {
  const activity = reader.select().from(activities).where(eq(activities.id, id)).get();
  if (!activity || activity.user_id !== store.userId || activity.deleted_at !== null) {
    throw new Error(`Activity ${id} not found`);
  }
  return activity;
}
