// The write rules every repository follows: atomic row + outbox, one waiting entry per row,
// soft deletes, sending order and one database per user.
import { eq } from 'drizzle-orm';

import {
  countActivities,
  deleteActivity,
  getActivityWithEntries,
  listActivities,
  startActivity,
  updateActivity,
} from '@/features/activities/repository';
import { createCustomExercise } from '@/features/exercises/repository';
import { addSet, deleteSet, listSets, updateSet } from '@/features/gym/repository';
import { getProfile, saveProfileFromServer, updateProfile } from '@/features/profile/repository';
import { addSwimEntry } from '@/features/swim/repository';

import {
  resetLocalDatabases,
  seedProfile,
  serverProfile,
  testStore,
  USER_A,
  USER_B,
} from '../../../test-utils/local-store';
import { databaseExists } from '../../../test-utils/expo-sqlite-mock';

import { databaseNameFor, deleteLocalStore, type LocalStore } from './database';
import * as outboxModule from './outbox';
import { waitingEntries } from './outbox';
import { activities, gymSets, outbox } from './schema';

beforeEach(resetLocalDatabases);
afterEach(() => jest.restoreAllMocks());

function gymWorkout(store: LocalStore) {
  const exercise = createCustomExercise(store, {
    name: 'Bench press',
    muscleGroup: 'chest',
    equipment: 'barbell',
  });
  const activity = startActivity(store, { type: 'gym', timezone: 'Europe/Lisbon' });
  return { exercise, activity };
}

function outboxRows(store: LocalStore) {
  return store.db.select().from(outbox).all();
}

describe('row and outbox are written together', () => {
  it('every write leaves its outbox entry', () => {
    const store = testStore();
    const { exercise, activity } = gymWorkout(store);
    const set = addSet(store, {
      activityId: activity.id,
      exerciseId: exercise.id,
      exercisePosition: 0,
      setNumber: 1,
      weightKg: 100,
      reps: 5,
    });

    const entry = waitingEntries(store.db).find((e) => e.row_id === set.id);
    expect(entry).toMatchObject({ table_name: 'gym_sets', operation: 'upsert', status: 'pending' });
    expect(entry?.payload).toEqual(set);
  });

  it('if the outbox entry fails, the row is not written either', () => {
    const store = testStore();
    jest.spyOn(outboxModule, 'enqueue').mockImplementation(() => {
      throw new Error('disk full');
    });

    expect(() => startActivity(store, { type: 'gym', timezone: 'Europe/Lisbon' })).toThrow(
      'disk full',
    );
    expect(store.db.select().from(activities).all()).toEqual([]);
    expect(outboxRows(store)).toEqual([]);
  });

  it('if the row fails, no outbox entry is left', () => {
    const store = testStore();
    const activity = startActivity(store, { type: 'gym', timezone: 'Europe/Lisbon' });
    const before = outboxRows(store).length;

    // The exercise does not exist: the foreign key rejects the set.
    expect(() =>
      addSet(store, {
        activityId: activity.id,
        exerciseId: 'no-such-exercise',
        exercisePosition: 0,
        setNumber: 1,
        reps: 5,
      }),
    ).toThrow();
    expect(store.db.select().from(gymSets).all()).toEqual([]);
    expect(outboxRows(store)).toHaveLength(before);
  });
});

describe('one waiting entry per row', () => {
  it('several edits before sending leave only the latest state', () => {
    const store = testStore();
    const { exercise, activity } = gymWorkout(store);
    const set = addSet(store, {
      activityId: activity.id,
      exerciseId: exercise.id,
      exercisePosition: 0,
      setNumber: 1,
      weightKg: 100,
      reps: 5,
    });
    updateSet(store, set.id, { reps: 6 });
    updateSet(store, set.id, { reps: 7 });
    const latest = updateSet(store, set.id, { weight_kg: 102.5 });

    const entries = outboxRows(store).filter((e) => e.row_id === set.id);
    expect(entries).toHaveLength(1);
    expect(entries[0].payload).toEqual(latest);
    expect(entries[0].payload).toMatchObject({ reps: 7, weight_kg: 102.5 });
  });

  it('an entry already being sent is left alone; the new change gets its own entry', () => {
    const store = testStore();
    const activity = startActivity(store, { type: 'gym', timezone: 'Europe/Lisbon' });
    store.db.update(outbox).set({ status: 'sending' }).where(eq(outbox.row_id, activity.id)).run();

    updateActivity(store, activity.id, { title: 'Push day' });

    const entries = outboxRows(store).filter((e) => e.row_id === activity.id);
    expect(entries.map((e) => e.status).sort()).toEqual(['pending', 'sending']);
    expect(entries.find((e) => e.status === 'pending')?.payload).toMatchObject({
      title: 'Push day',
    });
  });

  it('a failed entry is replaced by the next change and retried from scratch', () => {
    const store = testStore();
    const activity = startActivity(store, { type: 'gym', timezone: 'Europe/Lisbon' });
    store.db
      .update(outbox)
      .set({ status: 'failed', attempts: 3, last_error: 'timeout' })
      .where(eq(outbox.row_id, activity.id))
      .run();

    updateActivity(store, activity.id, { notes: 'Felt strong' });

    const entries = outboxRows(store).filter((e) => e.row_id === activity.id);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ status: 'pending', attempts: 0, last_error: null });
  });
});

describe('deleting', () => {
  it('marks deleted_at and queues a delete', () => {
    const store = testStore();
    const { exercise, activity } = gymWorkout(store);
    const set = addSet(store, {
      activityId: activity.id,
      exerciseId: exercise.id,
      exercisePosition: 0,
      setNumber: 1,
      reps: 5,
      weightKg: 60,
    });
    store.advance(60_000);

    deleteSet(store, set.id);

    const row = store.db.select().from(gymSets).where(eq(gymSets.id, set.id)).get();
    expect(row?.deleted_at).toBe('2026-11-04T10:01:00.000Z');
    expect(listSets(store, activity.id)).toEqual([]);
    const entries = outboxRows(store).filter((e) => e.row_id === set.id);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ operation: 'delete' });
    expect(entries[0].payload).toMatchObject({ deleted_at: '2026-11-04T10:01:00.000Z' });
  });

  it('deleting an activity deletes its sets and times too', () => {
    const store = testStore();
    const { exercise, activity } = gymWorkout(store);
    const set = addSet(store, {
      activityId: activity.id,
      exerciseId: exercise.id,
      exercisePosition: 0,
      setNumber: 1,
      reps: 5,
    });

    deleteActivity(store, activity.id);

    expect(getActivityWithEntries(store, activity.id)).toBeNull();
    const operations = Object.fromEntries(outboxRows(store).map((e) => [e.row_id, e.operation]));
    expect(operations[activity.id]).toBe('delete');
    expect(operations[set.id]).toBe('delete');
  });
});

describe('sending order', () => {
  it('puts parents before children: exercise and activity before their sets', () => {
    const store = testStore();
    // Created in the "wrong" order on purpose: activity, then the exercise, then a set.
    const activity = startActivity(store, { type: 'gym', timezone: 'Europe/Lisbon' });
    const exercise = createCustomExercise(store, {
      name: 'Row',
      muscleGroup: 'back',
      equipment: 'cable',
    });
    const set = addSet(store, {
      activityId: activity.id,
      exerciseId: exercise.id,
      exercisePosition: 0,
      setNumber: 1,
      reps: 10,
    });
    // An edit to the activity later on keeps it ahead of its sets.
    updateActivity(store, activity.id, { title: 'Pull' });

    expect(waitingEntries(store.db).map((e) => e.row_id)).toEqual([
      exercise.id,
      activity.id,
      set.id,
    ]);
  });
});

describe('reading', () => {
  it('reads an activity with its sets in order, and lists and counts by date', () => {
    const store = testStore();
    const { exercise, activity } = gymWorkout(store);
    for (const setNumber of [2, 1, 3]) {
      addSet(store, {
        activityId: activity.id,
        exerciseId: exercise.id,
        exercisePosition: 0,
        setNumber,
        reps: 5,
      });
    }
    const swim = startActivity(store, {
      type: 'swim',
      timezone: 'Europe/Lisbon',
      localDate: '2026-11-10',
    });
    addSwimEntry(store, {
      activityId: swim.id,
      position: 0,
      stroke: 'free',
      distance: 100,
      poolLength: '25m',
      timeCs: 6245,
      kind: 'race',
    });

    const read = getActivityWithEntries(store, activity.id);
    expect(read?.gymSets.map((s) => s.set_number)).toEqual([1, 2, 3]);
    expect(read?.activity.local_date).toBe('2026-11-04');
    expect(getActivityWithEntries(store, swim.id)?.swimEntries).toHaveLength(1);

    const week = { start: '2026-11-02', end: '2026-11-08' };
    expect(listActivities(store, week).map((a) => a.id)).toEqual([activity.id]);
    expect(countActivities(store, { start: '2026-11-01', end: '2026-11-30' })).toBe(2);
  });

  it('an activity copies the profile bodyweight, like the server', () => {
    const store = testStore();
    seedProfile(store, { bodyweight_kg: 72.5 });
    expect(startActivity(store, { type: 'gym', timezone: 'UTC' }).bodyweight_kg).toBe(72.5);
  });
});

describe('profile', () => {
  it('the server copy does not overwrite changes not yet sent', () => {
    const store = testStore();
    seedProfile(store);
    updateProfile(store, { weekly_target: 5 });

    const saved = saveProfileFromServer(store, serverProfile(USER_A, { weekly_target: 2 }));

    expect(saved).toBe(false);
    expect(getProfile(store)?.weekly_target).toBe(5);
    expect(waitingEntries(store.db).map((e) => e.table_name)).toEqual(['profiles']);
  });

  it('the server copy is stored, without an outbox entry, when nothing is waiting', () => {
    const store = testStore();
    expect(saveProfileFromServer(store, serverProfile(USER_A))).toBe(true);
    expect(getProfile(store)?.display_name).toBe('Ana');
    expect(outboxRows(store)).toEqual([]);
  });
});

describe('one database per user', () => {
  it("two accounts on the same phone never see each other's data", () => {
    const ana = testStore(USER_A);
    const bruno = testStore(USER_B);
    seedProfile(ana);
    startActivity(ana, { type: 'gym', timezone: 'UTC' });

    expect(ana.databaseName).not.toBe(bruno.databaseName);
    expect(bruno.db.select().from(activities).all()).toEqual([]);
    expect(getProfile(bruno)).toBeNull();
    expect(waitingEntries(bruno.db)).toEqual([]);
  });

  it("deleting one account's database keeps the other", () => {
    testStore(USER_A);
    const bruno = testStore(USER_B);
    startActivity(bruno, { type: 'swim', timezone: 'UTC' });

    deleteLocalStore(USER_A);

    expect(databaseExists(databaseNameFor(USER_A))).toBe(false);
    expect(databaseExists(databaseNameFor(USER_B))).toBe(true);
    expect(bruno.db.select().from(activities).all()).toHaveLength(1);
  });

  it('only accepts real user ids in file names', () => {
    expect(() => databaseNameFor('../other')).toThrow();
  });
});
