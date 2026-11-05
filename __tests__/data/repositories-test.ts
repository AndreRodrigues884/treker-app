// The repositories against the mocked Supabase client (RLS and constraints are tested in pgTAP).
import { classifyRequestError } from '@/core/errors';
import {
  countActivities,
  deleteActivity,
  finishActivity,
  getActivityWithEntries,
  listActivities,
  startActivity,
} from '@/features/activities/repository';
import { createCustomExercise, findCustomExerciseByName } from '@/features/exercises/repository';
import { addSet, deleteSet, listSets, updateSet } from '@/features/gym/repository';
import { completeOnboarding, getProfile, updateProfile } from '@/features/profile/repository';
import { addSwimEntry, deleteSwimEntry } from '@/features/swim/repository';
import type { DataContext } from '@/lib/data/context';

import {
  goOffline,
  onboardedProfile,
  resetSupabaseMock,
  serverRows,
  supabaseMock,
  TEST_USER_ID,
} from '../../test-utils/supabase-mock';

jest.mock('@/lib/supabase/client', () => require('../../test-utils/supabase-mock').clientModule);

let nextId = 0;
const ctx: DataContext = {
  userId: TEST_USER_ID,
  now: () => new Date('2026-11-04T23:30:00Z'),
  newId: () => `00000000-0000-0000-0000-${String(++nextId).padStart(12, '0')}`,
};

beforeEach(() => {
  nextId = 0;
  resetSupabaseMock({ signedIn: true, profile: onboardedProfile() });
});

async function gymWorkout() {
  const exercise = await createCustomExercise(ctx, {
    name: 'Bench press',
    muscleGroup: 'chest',
    equipment: 'barbell',
  });
  const activity = await startActivity(ctx, { type: 'gym', timezone: 'Europe/Madrid' });
  return { exercise, activity };
}

describe('activities', () => {
  it('creates an activity with an id from the phone and the athlete local date', async () => {
    const activity = await startActivity(ctx, { type: 'gym', timezone: 'Europe/Madrid' });

    expect(activity.id).toBe('00000000-0000-0000-0000-000000000001');
    expect(activity.user_id).toBe(TEST_USER_ID);
    // 23:30 UTC is already the next day in Madrid.
    expect(activity.local_date).toBe('2026-11-05');
    expect(activity.started_at).toBe('2026-11-04T23:30:00.000Z');
  });

  it('repeating a create with the same id (retry after a network failure) never duplicates', async () => {
    const input = { id: ctx.newId(), type: 'swim' as const, timezone: 'UTC' };

    await startActivity(ctx, input);
    await startActivity(ctx, input);

    expect(serverRows('activities')).toHaveLength(1);
  });

  it('finishes, lists, counts and deletes activities, ignoring deleted ones', async () => {
    const { exercise, activity } = await gymWorkout();
    const set = await addSet(ctx, {
      activityId: activity.id,
      exerciseId: exercise.id,
      exercisePosition: 0,
      setNumber: 1,
      weightKg: 100,
      reps: 5,
    });
    await startActivity(ctx, { type: 'swim', timezone: 'UTC', localDate: '2026-11-09' });

    const finished = await finishActivity(ctx, activity.id);
    expect(finished.ended_at).toBe('2026-11-04T23:30:00.000Z');

    const week = { start: '2026-11-02', end: '2026-11-08' };
    expect((await listActivities(ctx, week)).map((a) => a.id)).toEqual([activity.id]);
    expect(await countActivities(ctx, { start: '2026-11-01', end: '2026-11-30' })).toBe(2);

    const writesBefore = supabaseMock.writes.length;
    await deleteActivity(ctx, activity.id);

    // One request: Postgres delete_activity marks the activity and its children together.
    expect(supabaseMock.rpc).toHaveBeenCalledTimes(1);
    expect(supabaseMock.rpc).toHaveBeenCalledWith('delete_activity', { p_activity_id: activity.id });
    expect(supabaseMock.writes).toHaveLength(writesBefore);
    expect(await countActivities(ctx, week)).toBe(0);
    expect(await getActivityWithEntries(ctx, activity.id)).toBeNull();
    // Its sets are deleted too (marked, not removed), at the same time as the activity.
    const storedSet = serverRows<{ id: string; deleted_at: string | null }>('gym_sets').find(
      (row) => row.id === set.id,
    );
    const storedActivity = serverRows<{ id: string; deleted_at: string | null }>(
      'activities',
    ).find((row) => row.id === activity.id);
    expect(storedSet?.deleted_at).not.toBeNull();
    expect(storedSet?.deleted_at).toBe(storedActivity?.deleted_at);
  });

  it('deleting again (a retry after a network failure) changes nothing', async () => {
    const activity = await startActivity(ctx, { type: 'gym', timezone: 'UTC' });
    await deleteActivity(ctx, activity.id);
    const deletedAt = serverRows<{ deleted_at: string | null }>('activities')[0].deleted_at;

    await expect(deleteActivity(ctx, activity.id)).resolves.toBeUndefined();

    expect(serverRows<{ deleted_at: string | null }>('activities')[0].deleted_at).toBe(deletedAt);
  });

  it("deleting someone else's activity fails", async () => {
    serverRows('activities').push({
      id: 'other',
      user_id: 'bbbbbbbb-0000-0000-0000-000000000000',
      deleted_at: null,
    });

    await expect(deleteActivity(ctx, 'other')).rejects.toMatchObject({ code: 'P0002' });
  });

  it("does not count other users' activities", async () => {
    serverRows('activities').push({
      id: 'other',
      user_id: 'bbbbbbbb-0000-0000-0000-000000000000',
      local_date: '2026-11-04',
      deleted_at: null,
    });
    expect(await countActivities(ctx, { start: '2026-11-02', end: '2026-11-08' })).toBe(0);
  });
});

describe('gym sets and swim times', () => {
  it('reads an activity with its sets in exercise and set order', async () => {
    const { exercise, activity } = await gymWorkout();
    for (const setNumber of [2, 1, 3]) {
      await addSet(ctx, {
        activityId: activity.id,
        exerciseId: exercise.id,
        exercisePosition: 0,
        setNumber,
        reps: 5,
      });
    }

    const read = await getActivityWithEntries(ctx, activity.id);
    expect(read?.gymSets.map((s) => s.set_number)).toEqual([1, 2, 3]);
  });

  it('edits and deletes a set (deleting marks deleted_at)', async () => {
    const { exercise, activity } = await gymWorkout();
    const set = await addSet(ctx, {
      activityId: activity.id,
      exerciseId: exercise.id,
      exercisePosition: 0,
      setNumber: 1,
      weightKg: 100,
      reps: 5,
    });

    expect((await updateSet(ctx, set.id, { reps: 6 })).reps).toBe(6);
    await deleteSet(ctx, set.id);

    expect(await listSets(ctx, activity.id)).toEqual([]);
    expect(serverRows<{ deleted_at: string | null }>('gym_sets')[0].deleted_at).not.toBeNull();
  });

  it('adds and deletes swim times', async () => {
    const swim = await startActivity(ctx, { type: 'swim', timezone: 'UTC' });
    const entry = await addSwimEntry(ctx, {
      activityId: swim.id,
      position: 0,
      stroke: 'free',
      distance: 100,
      poolLength: '25m',
      timeCs: 6245,
      kind: 'race',
    });
    expect((await getActivityWithEntries(ctx, swim.id))?.swimEntries).toHaveLength(1);

    await deleteSwimEntry(ctx, entry.id);

    expect((await getActivityWithEntries(ctx, swim.id))?.swimEntries).toEqual([]);
  });
});

describe('exercises and profile', () => {
  it('creates and finds a custom exercise', async () => {
    const created = await createCustomExercise(ctx, {
      name: ' Landmine press ',
      muscleGroup: 'shoulders',
      equipment: 'barbell',
    });

    expect(created).toMatchObject({ owner_id: TEST_USER_ID, name_en: 'Landmine press' });
    expect((await findCustomExerciseByName(ctx, 'Landmine press'))?.id).toBe(created.id);
  });

  it('reads and edits the profile, and completing onboarding sets onboarded_at', async () => {
    expect((await getProfile(ctx))?.display_name).toBe('Ana');
    expect((await updateProfile(ctx, { weekly_target: 5 })).weekly_target).toBe(5);

    const done = await completeOnboarding(ctx, {
      display_name: 'Ana',
      sports: ['swim'],
      gym_focus: null,
      swim_style: 'fitness',
      default_pool_length: '25m',
      weekly_target: 4,
      weight_unit: 'kg',
      pool_unit: 'm',
      bodyweight_kg: null,
      locale: 'pt',
      timezone: 'Europe/Lisbon',
    });
    expect(done.onboarded_at).toBe('2026-11-04T23:30:00.000Z');
  });
});

describe('errors', () => {
  it('a request without a connection throws an error the screens show as "no connection"', async () => {
    goOffline();
    const failure = await startActivity(ctx, { type: 'gym', timezone: 'UTC' }).catch(
      (error: unknown) => error,
    );
    expect(classifyRequestError(failure)).toBe('network');
  });
});
