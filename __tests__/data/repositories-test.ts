// The repositories against the mocked Supabase client (RLS and constraints are tested in pgTAP).
import { classifyRequestError } from '@/core/errors';
import {
  countActivities,
  deleteActivity,
  finishActivity,
  getActivityWithEntries,
  listActivities,
  listActivityRecords,
  listActivitySummaries,
  startActivity,
} from '@/features/activities/repository';
import {
  createCustomExercise,
  deleteCustomExercise,
  findCustomExerciseByName,
  listExercises,
  updateCustomExercise,
} from '@/features/exercises/repository';
import { addSet, deleteSet, listSets, updateSet } from '@/features/gym/repository';
import { completeOnboarding, getProfile, updateProfile } from '@/features/profile/repository';
import {
  getExerciseProgress,
  getExerciseStats,
  listExerciseHistory,
  listGymRecords,
} from '@/features/records/repository';
import {
  getCurrentGymRecords,
  getLastPerformance,
  saveGymSession,
  updateGymSession,
} from '@/features/session/repository';
import { addSwimEntry, deleteSwimEntry } from '@/features/swim/repository';
import {
  deleteTemplate,
  getTemplate,
  listTemplates,
  saveTemplate,
} from '@/features/templates/repository';
import { addExercises, emptyTemplate, moveItemBy, removeItem } from '@/core/templates';
import type { DataContext } from '@/lib/data/context';

import {
  goOffline,
  onboardedProfile,
  resetSupabaseMock,
  seedLibraryExercises,
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
    expect(supabaseMock.rpc).toHaveBeenCalledWith('delete_activity', {
      p_activity_id: activity.id,
    });
    expect(supabaseMock.writes).toHaveLength(writesBefore);
    expect(await countActivities(ctx, week)).toBe(0);
    expect(await getActivityWithEntries(ctx, activity.id)).toBeNull();
    // Its sets are deleted too (marked, not removed), at the same time as the activity.
    const storedSet = serverRows<{ id: string; deleted_at: string | null }>('gym_sets').find(
      (row) => row.id === set.id,
    );
    const storedActivity = serverRows<{ id: string; deleted_at: string | null }>('activities').find(
      (row) => row.id === activity.id,
    );
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

describe('workout summaries and records', () => {
  it('pages by cursor through Postgres list_activity_summaries, with nulls kept', async () => {
    await startActivity(ctx, { type: 'gym', timezone: 'UTC', localDate: '2026-11-03' });
    const swim = await startActivity(ctx, {
      type: 'swim',
      timezone: 'UTC',
      localDate: '2026-11-04',
    });

    const first = await listActivitySummaries(ctx, { limit: 1 });
    expect(supabaseMock.rpc).toHaveBeenLastCalledWith('list_activity_summaries', { p_limit: 1 });
    expect(first).toEqual([
      expect.objectContaining({
        id: swim.id,
        type: 'swim',
        localDate: '2026-11-04',
        durationS: null,
        setCount: 0,
        volumeKg: null,
        distanceM: 0,
      }),
    ]);

    const second = await listActivitySummaries(ctx, {
      limit: 1,
      before: { localDate: '2026-11-04', startedAt: swim.started_at, id: swim.id },
    });
    expect(supabaseMock.rpc).toHaveBeenLastCalledWith('list_activity_summaries', {
      p_limit: 1,
      p_before_date: '2026-11-04',
      p_before_id: swim.id,
      p_before_started_at: swim.started_at,
    });
    expect(second.map((row) => [row.localDate, row.volumeKg])).toEqual([['2026-11-03', 0]]);
  });

  it("reads a workout's records", async () => {
    serverRows('personal_records').push(
      { id: 'r1', user_id: TEST_USER_ID, activity_id: 'a1', type: 'gym', value: 100 },
      { id: 'r2', user_id: TEST_USER_ID, activity_id: 'a2', type: 'gym', value: 90 },
    );
    expect((await listActivityRecords(ctx, 'a1')).map((r) => r.id)).toEqual(['r1']);
  });
});

describe('gym session', () => {
  const payload = {
    id: 'session-1',
    local_date: '2026-11-05',
    timezone: 'Europe/Madrid',
    started_at: '2026-11-05T09:00:00.000Z',
    ended_at: null,
    title: 'Push A',
    template_id: null,
    sets: [
      {
        id: 'set-1',
        exercise_id: 'bench',
        exercise_position: 0,
        set_number: 1,
        weight_kg: 100,
        reps: 5,
        duration_s: null,
        difficulty: 'hard' as const,
        is_warmup: false,
      },
    ],
  };

  beforeEach(() => {
    seedLibraryExercises([{ id: 'bench', name_en: 'Bench Press', name_pt: 'Supino' }]);
  });

  it('saves the workout in one request, returns its records, and a retry duplicates nothing', async () => {
    const records = await saveGymSession(ctx, payload);
    expect(supabaseMock.rpc).toHaveBeenCalledWith('save_gym_session', { p_session: payload });
    expect(supabaseMock.writes).toHaveLength(0);
    expect(records.map((r) => [r.exercise_id, r.value])).toEqual([['bench', 116.67]]);

    await saveGymSession(ctx, payload);
    expect(serverRows('activities')).toHaveLength(1);
    expect(serverRows('gym_sets')).toHaveLength(1);
  });

  it('reads last time per exercise and the current records', async () => {
    await saveGymSession(ctx, payload);

    expect(await getLastPerformance(ctx, ['bench', 'unknown'])).toEqual({
      bench: [
        {
          workSetIndex: 1,
          weightKg: 100,
          reps: 5,
          durationS: null,
          difficulty: 'hard' as const,
          localDate: '2026-11-05',
        },
      ],
    });
    expect(await getLastPerformance(ctx, [])).toEqual({});
    expect(await getCurrentGymRecords(ctx)).toEqual({ bench: 116.67 });
  });
});

describe('editing a workout and reading progress', () => {
  const workout = (id: string, localDate: string, weightKg: number) => ({
    id,
    local_date: localDate,
    timezone: 'UTC',
    started_at: `${localDate}T09:00:00.000Z`,
    ended_at: null,
    title: id,
    template_id: null,
    sets: [
      {
        id: `${id}-1`,
        exercise_id: 'bench',
        exercise_position: 0,
        set_number: 1,
        weight_kg: weightKg,
        reps: 5,
        duration_s: null,
        difficulty: 'easy' as const,
        is_warmup: false,
      },
    ],
  });

  beforeEach(async () => {
    seedLibraryExercises([{ id: 'bench', name_en: 'Bench Press', name_pt: 'Supino' }]);
    await saveGymSession(ctx, workout('w1', '2026-10-01', 100));
    await saveGymSession(ctx, workout('w2', '2026-10-08', 110));
  });

  it('updates a workout in one request; the records follow', async () => {
    const { ended_at: _ended, ...update } = workout('w2', '2026-10-08', 90);
    expect(await updateGymSession(ctx, update)).toEqual([]);
    expect(supabaseMock.rpc).toHaveBeenLastCalledWith('update_gym_session', { p_session: update });
    expect((await listGymRecords(ctx)).map((r) => [r.exerciseId, r.valueKg, r.weightKg])).toEqual([
      ['bench', 116.67, 100],
    ]);
  });

  it('reads stats, progress from a date and the history by cursor', async () => {
    expect(await getExerciseStats(ctx, 'bench')).toMatchObject({ set_count: 2 });
    expect(
      (await getExerciseProgress(ctx, 'bench', '2026-10-05')).map((p) => [p.localDate, p.isRecord]),
    ).toEqual([['2026-10-08', true]]);
    const first = await listExerciseHistory(ctx, 'bench', { limit: 1 });
    expect(first.map((e) => [e.activityId, e.sets[0]?.difficulty])).toEqual([['w2', 'easy']]);
    const next = await listExerciseHistory(ctx, 'bench', {
      limit: 1,
      before: { localDate: '2026-10-08', startedAt: '2026-10-08T09:00:00.000Z', id: 'w2' },
    });
    expect(next.map((e) => e.activityId)).toEqual(['w1']);
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

describe('custom exercises: edit and delete', () => {
  it('lists the library and own exercises, edits and deletes an own one in one request', async () => {
    seedLibraryExercises([{ id: 'bench', name_en: 'Bench Press', name_pt: 'Supino' }]);
    const mine = await createCustomExercise(ctx, {
      name: 'Zercher squat',
      muscleGroup: 'quads',
      equipment: 'barbell',
    });

    const values = {
      name: 'Zercher squat (pause)',
      muscleGroup: 'quads' as const,
      equipment: 'barbell' as const,
      unit: 'reps' as const,
      tracksLoad: true,
      addsBodyweight: false,
    };
    const updated = await updateCustomExercise(ctx, mine.id, values);
    expect(updated).toMatchObject({
      name_en: 'Zercher squat (pause)',
      name_pt: 'Zercher squat (pause)',
    });

    const writes = supabaseMock.writes.length;
    await deleteCustomExercise(ctx, mine.id);
    await deleteCustomExercise(ctx, mine.id);

    expect(supabaseMock.rpc).toHaveBeenCalledWith('delete_custom_exercise', {
      p_exercise_id: mine.id,
    });
    expect(supabaseMock.writes).toHaveLength(writes);
    // Deleted ones are still listed (logged workouts need their names); the library hides them.
    const listed = await listExercises(ctx);
    expect(listed.map((e) => [e.id, e.deleted_at !== null])).toEqual([
      ['bench', false],
      [mine.id, true],
    ]);
    // A library exercise cannot be deleted.
    await expect(deleteCustomExercise(ctx, 'bench')).rejects.toMatchObject({ code: 'P0002' });
  });
});

describe('saved workouts', () => {
  function pushDay() {
    return addExercises(
      { ...emptyTemplate(ctx.newId()), name: 'Push A' },
      [
        { id: 'bench', unit: 'reps' },
        { id: 'plank', unit: 'seconds' },
      ],
      ctx.newId,
    );
  }

  it('saves the template and its list in one request, in order', async () => {
    const draft = pushDay();
    await saveTemplate(ctx, draft);

    expect(supabaseMock.rpc).toHaveBeenCalledTimes(1);
    expect(supabaseMock.writes).toHaveLength(0);
    const read = await getTemplate(ctx, draft.id);
    expect(read?.template.name).toBe('Push A');
    expect(read?.exercises.map((e) => [e.exercise_id, e.position])).toEqual([
      ['bench', 0],
      ['plank', 1],
    ]);
  });

  it('repeating a save (a retry) never duplicates; saving again replaces the list', async () => {
    const draft = pushDay();
    await saveTemplate(ctx, draft);
    await saveTemplate(ctx, draft);
    expect(serverRows('workout_templates')).toHaveLength(1);
    expect(serverRows('workout_template_exercises')).toHaveLength(2);

    const reordered = removeItem(moveItemBy(draft, draft.items[1].id, -1), draft.items[0].id);
    await saveTemplate(ctx, reordered);

    const [listed] = await listTemplates(ctx);
    expect(listed.exercises.map((e) => e.exercise_id)).toEqual(['plank']);
    // The removed row is marked, not removed.
    expect(serverRows('workout_template_exercises')).toHaveLength(2);
  });

  it('deleting marks deleted_at and hides the template', async () => {
    const draft = pushDay();
    await saveTemplate(ctx, draft);
    await deleteTemplate(ctx, draft.id);

    expect(await listTemplates(ctx)).toEqual([]);
    expect(await getTemplate(ctx, draft.id)).toBeNull();
    expect(
      serverRows<{ deleted_at: string | null }>('workout_templates')[0].deleted_at,
    ).not.toBeNull();
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
