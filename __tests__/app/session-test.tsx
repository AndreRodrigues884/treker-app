// Phase 1b: the gym session, from "+" to the saved workout in the Profile.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, screen, waitFor } from 'expo-router/testing-library';

import { en } from '@/core/i18n/en';
import { resetSessionStore } from '@/features/session/session-store';
import { storageKeys } from '@/lib/storage';

import { renderApp, resetStorage } from '../../test-utils/render-app';
import { dragEndParams } from '../../test-utils/sortables-mock';
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

const s = en.session;
const nbsp = (text: string) => text.replace(/ (?=kg)/g, ' ');

beforeEach(async () => {
  resetSessionStore();
  resetSupabaseMock({ signedIn: true, profile: onboardedProfile({ weekly_target: 3 }) });
  seedLibraryExercises([
    { id: 'bench', name_en: 'Barbell Bench Press', name_pt: 'Supino plano com barra' },
    {
      id: 'plank',
      name_en: 'Plank',
      name_pt: 'Prancha',
      unit: 'seconds',
      tracks_load: false,
      muscle_group: 'core',
      equipment: 'bodyweight',
    },
  ]);
  // A saved workout: bench press, 3 sets of 8.
  serverRows('workout_templates').push({
    id: 'push-a',
    user_id: TEST_USER_ID,
    name: 'Push A',
    deleted_at: null,
    updated_at: '2026-11-01T10:00:00Z',
  });
  serverRows('workout_template_exercises').push({
    id: 'push-a-1',
    user_id: TEST_USER_ID,
    template_id: 'push-a',
    exercise_id: 'bench',
    position: 0,
    target_sets: 3,
    target_reps_min: 8,
    target_reps_max: 8,
    target_seconds: null,
    deleted_at: null,
  });
  // Last time: 97.5 x 6 at RPE 8, then 95 x 6. The bench press record is 110 kg.
  serverRows('activities').push({
    id: 'last-week',
    user_id: TEST_USER_ID,
    type: 'gym',
    title: 'Push A',
    local_date: '2026-10-01',
    started_at: '2026-10-01T09:00:00Z',
    ended_at: '2026-10-01T10:00:00Z',
    deleted_at: null,
  });
  for (const [number, weight, difficulty] of [
    [1, 97.5, 'hard'],
    [2, 95, null],
  ] as const) {
    serverRows('gym_sets').push({
      id: `last-${number}`,
      user_id: TEST_USER_ID,
      activity_id: 'last-week',
      exercise_id: 'bench',
      exercise_position: 0,
      set_number: number,
      weight_kg: weight,
      reps: 6,
      duration_s: null,
      difficulty,
      is_warmup: false,
      deleted_at: null,
    });
  }
  serverRows('personal_records').push({
    id: 'old-record',
    user_id: TEST_USER_ID,
    type: 'gym',
    activity_id: 'last-week',
    gym_set_id: 'last-1',
    exercise_id: 'bench',
    value: 110,
    local_date: '2026-10-01',
  });
  await resetStorage();
});

// "+" → Gym → Push A.
async function startPushA() {
  await renderApp('/');
  await fireEvent.press(await screen.findByRole('button', { name: en.nav.start }));
  await fireEvent.press(await screen.findByRole('radio', { name: en.onboarding.sports.gym }));
  await fireEvent.press(
    await screen.findByRole('radio', { name: `Push A. ${en.workouts.exerciseCountOne}` }),
  );
  await screen.findByRole('header', { name: 'Push A' });
}

// A set's square ("Set 1, not done", "Set 1, done, Easy, …"), and the open set's fields.
const setSquare = (set: number) =>
  screen.getByRole('button', { name: new RegExp(`^Set ${set}, `) });
const weightField = () => screen.getByLabelText(s.weight.replace('{unit}', 'kg'));
const repsField = () => screen.getByLabelText(s.repsDone);

// Taps a set, changes what is given, and confirms with OK.
async function doSet(
  set: number,
  changes: { weight?: string; reps?: string; difficulty?: 'easy' | 'medium' | 'hard' } = {},
) {
  await fireEvent.press(setSquare(set));
  if (changes.weight !== undefined) await fireEvent.changeText(weightField(), changes.weight);
  if (changes.reps !== undefined) await fireEvent.changeText(repsField(), changes.reps);
  if (changes.difficulty) {
    await fireEvent.press(screen.getByRole('radio', { name: s.difficulty[changes.difficulty] }));
  }
  await fireEvent.press(screen.getByRole('button', { name: s.ok }));
}

async function storedDraft() {
  const raw = await AsyncStorage.getItem(storageKeys.gymSession(TEST_USER_ID));
  return raw === null ? null : JSON.parse(raw);
}

describe('a gym session from start to the Profile', () => {
  it('fills the sets from last time, marks a PR, rests, and saves in one request', async () => {
    await startPushA();

    // The plan, and one square per set.
    expect(screen.getByText('3 × 8 reps')).toBeOnTheScreen();
    expect(screen.getByLabelText('0 of 3 sets done')).toBeOnTheScreen();

    // Set 1 opens with last time (97.5 kg × 6, hard) and those values.
    await fireEvent.press(setSquare(1));
    expect(screen.getByText('Last time: 97.5 kg · 6 reps')).toBeOnTheScreen();
    // "Hard" twice: the badge of last time, and the choice for this set.
    expect(screen.getAllByText(s.difficulty.hard)).toHaveLength(2);
    expect(weightField()).toHaveDisplayValue('97.5');
    expect(repsField()).toHaveDisplayValue('6');
    await fireEvent.press(screen.getByRole('button', { name: en.common.cancel }));

    // Set 3 has no last time: the target (8 reps, no weight).
    await fireEvent.press(setSquare(3));
    expect(weightField()).toHaveDisplayValue('');
    expect(repsField()).toHaveDisplayValue('8');
    await fireEvent.press(screen.getByRole('button', { name: en.common.cancel }));

    // 100 x 6 = 120 kg estimated: beats the 110 kg record. Easy: the square turns green.
    await doSet(1, { weight: '100', difficulty: 'easy' });

    expect(
      await screen.findByRole('button', {
        name: `Set 1, done, ${s.difficulty.easy}, ${en.records.prLabel}`,
      }),
    ).toBeOnTheScreen();
    expect(screen.getByLabelText('1 of 3 sets done')).toBeOnTheScreen();

    // No rest timer in v1: nothing on screen after a set.
    expect(screen.queryByLabelText(/^Rest: /)).not.toBeOnTheScreen();

    // The draft is on the phone the whole time.
    expect((await storedDraft()).exercises[0].sets[0]).toMatchObject({
      weight: 100,
      difficulty: 'easy',
      done: true,
    });

    // Finish: the summary counts only the done set.
    await fireEvent.press(screen.getByRole('button', { name: s.finish }));
    await screen.findByRole('header', { name: s.finishTitle });
    expect(screen.getByLabelText(`${en.workout.sets}: 1`)).toBeOnTheScreen();
    expect(screen.getByLabelText(`${en.workout.volume}: 600 kg`)).toBeOnTheScreen();
    expect(screen.getByLabelText(s.title)).toHaveDisplayValue('Push A');

    await fireEvent.press(screen.getByRole('button', { name: s.save }));

    // The official records from the server.
    await screen.findByRole('header', { name: s.savedTitle });
    expect(
      screen.getByLabelText(
        // With the best it beat (last time's 97.5 x 6 = 117 kg).
        `${en.records.prLabel}: Barbell Bench Press, ${en.workout.oneRepMax.replace('{value}', '120 kg')}, ${en.session.previousRecord.replace('{value}', '117 kg')}`,
      ),
    ).toBeOnTheScreen();

    // One request with only the done set, in kg; the draft is gone.
    const calls = supabaseMock.rpc.mock.calls.filter(([fn]) => fn === 'save_gym_session');
    expect(calls).toHaveLength(1);
    const payload = (calls[0]![1] as { p_session: Record<string, unknown> }).p_session;
    expect(payload).toMatchObject({
      title: 'Push A',
      template_id: 'push-a',
      sets: [
        expect.objectContaining({
          exercise_id: 'bench',
          weight_kg: 100,
          reps: 6,
          difficulty: 'easy',
        }),
      ],
    });
    expect(await storedDraft()).toBeNull();

    // Back to Today, which counts it; then the Profile lists it.
    await fireEvent.press(screen.getByRole('button', { name: s.close }));
    expect(await screen.findAllByText('1 of 3 workouts this week')).not.toHaveLength(0);
    expect(screen.queryByText(s.inProgress)).not.toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: en.nav.openMenu }));
    await fireEvent.press(screen.getByRole('button', { name: en.nav.profile }));
    expect(
      await screen.findByRole('button', { name: /^Open Push A, .*1 set · 600 kg$/ }),
    ).toBeOnTheScreen();
  });

  it('"Finish" is across the bottom of the screen', async () => {
    await startPushA();
    const finish = screen.getByRole('button', { name: s.finish });
    expect(finish).toBeOnTheScreen();
    await fireEvent.press(finish);
    expect(await screen.findByRole('header', { name: s.finishTitle })).toBeOnTheScreen();
  });

  it('says what is missing instead of marking an empty set as done', async () => {
    await startPushA();
    await doSet(1, { reps: '' });

    expect(screen.getByText(s.problems.reps)).toBeOnTheScreen();
    expect(setSquare(1)).toHaveAccessibleName('Set 1, not done');
  });
});

describe('editing the workout', () => {
  it('the pencil changes the sets and target; dragging reorders; removing asks when sets are done', async () => {
    await startPushA();

    // Pencil: 3 x 8 becomes 4 x 5.
    await fireEvent.press(
      screen.getByRole('button', { name: s.editPlan.replace('{name}', 'Barbell Bench Press') }),
    );
    await fireEvent.press(screen.getByRole('button', { name: en.templateEditor.moreSets }));
    for (let i = 0; i < 3; i += 1) {
      await fireEvent.press(screen.getByRole('button', { name: en.templateEditor.fewerReps }));
    }
    await fireEvent.press(screen.getByRole('button', { name: s.ok }));
    expect(screen.getByText('4 × 5 reps')).toBeOnTheScreen();
    expect(setSquare(4)).toHaveAccessibleName('Set 4, not done');

    // A second exercise from the library, then drag it to the top.
    await fireEvent.press(screen.getByRole('button', { name: s.addExercise }));
    await fireEvent.press(await screen.findByRole('checkbox', { name: /^Plank, / }));
    await fireEvent.press(
      screen.getByRole('button', { name: en.exercises.add.replace('{count}', '1') }),
    );
    await screen.findByRole('header', { name: 'Plank' });
    const grid = screen.getByTestId('sortable-grid');
    await fireEvent(grid, 'dragEnd', dragEndParams(grid.props.items, 1, 0));
    const headers = screen
      .getAllByRole('header')
      .map((header) => String(header.props.children))
      .filter((name) => name === 'Plank' || name === 'Barbell Bench Press');
    expect(headers).toEqual(['Plank', 'Barbell Bench Press']);

    // Removing an exercise with a done set asks first. (Set 1 of the bench press, now second.)
    await fireEvent.press(screen.getAllByRole('button', { name: /^Set 1, / })[1]!);
    await fireEvent.press(screen.getByRole('button', { name: s.ok }));
    await fireEvent.press(
      screen.getByRole('button', {
        name: s.removeExercise.replace('{name}', 'Barbell Bench Press'),
      }),
    );
    expect(screen.getByText(s.removeBody)).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: s.removeConfirm }));
    await waitFor(() =>
      expect(screen.queryByRole('header', { name: 'Barbell Bench Press' })).not.toBeOnTheScreen(),
    );
    expect((await storedDraft()).exercises.map((e: { id: string }) => e.id)).toEqual(['plank']);
  });
});

describe('the workout in progress', () => {
  it('is offered on Today after the app was closed, and continues where it was', async () => {
    await startPushA();
    await doSet(1);
    await waitFor(async () => expect((await storedDraft()).exercises[0].sets[0].done).toBe(true));

    // The app is closed: nothing in memory, the draft stays on the phone.
    resetSessionStore();
    await renderApp('/');

    expect(await screen.findByText(s.inProgress)).toBeOnTheScreen();
    expect(screen.getByText(/^Push A · 1\smin ago$/)).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: s.continue }));
    await screen.findByRole('header', { name: 'Push A' });
    expect(setSquare(1)).toHaveAccessibleName(/^Set 1, done/);
  });

  it('"+" opens the workout in progress instead of starting another', async () => {
    await startPushA();
    await fireEvent.press(screen.getByRole('button', { name: en.common.back }));

    await fireEvent.press(await screen.findByRole('button', { name: en.nav.start }));

    expect(await screen.findByRole('header', { name: 'Push A' })).toBeOnTheScreen();
    expect(screen).toHavePathname('/session');
  });

  it('can be discarded from Today, after a confirmation', async () => {
    await startPushA();
    await fireEvent.press(screen.getByRole('button', { name: en.common.back }));

    await fireEvent.press(await screen.findByRole('button', { name: s.discard }));
    expect(screen.getByText(s.discardBody)).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: s.discardWorkout }));

    await waitFor(() => expect(screen.queryByText(s.inProgress)).not.toBeOnTheScreen());
    expect(await storedDraft()).toBeNull();
    expect(serverRows('activities')).toHaveLength(1);
  });
});

describe('finishing', () => {
  it('without a connection: shows the error, keeps the draft, and "Try again" does not duplicate', async () => {
    await startPushA();
    await doSet(1);
    await doSet(2);
    await fireEvent.press(screen.getByRole('button', { name: s.finish }));
    await screen.findByRole('header', { name: s.finishTitle });

    goOffline();
    await fireEvent.press(screen.getByRole('button', { name: s.save }));

    expect(await screen.findByText(s.errors.network)).toBeOnTheScreen();
    expect(await storedDraft()).not.toBeNull();
    expect(serverRows('activities')).toHaveLength(1);

    goOffline(false);
    await fireEvent.press(screen.getByRole('button', { name: en.common.retry }));
    await screen.findByRole('header', { name: s.savedTitle });

    // Both attempts sent the same request (same ids, same end time).
    const payloads = supabaseMock.rpc.mock.calls
      .filter(([fn]) => fn === 'save_gym_session')
      .map(([, args]) => JSON.stringify((args as { p_session: unknown }).p_session));
    expect(payloads).toHaveLength(2);
    expect(payloads[0]).toBe(payloads[1]);
    // Saved once: one new activity with its two sets.
    expect(serverRows('activities')).toHaveLength(2);
    expect(serverRows('gym_sets')).toHaveLength(4);
    expect(await storedDraft()).toBeNull();
  });

  it('warns when no set is done, and the workout can be discarded', async () => {
    await startPushA();
    await fireEvent.press(screen.getByRole('button', { name: s.finish }));

    expect(await screen.findByText(s.noDoneSets)).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: s.save })).toBeDisabled();

    await fireEvent.press(screen.getByRole('button', { name: s.discardWorkout }));
    const dialog = screen.getByText(s.discardBody);
    expect(dialog).toBeOnTheScreen();
    const confirm = screen.getAllByRole('button', { name: s.discardWorkout });
    await fireEvent.press(confirm[confirm.length - 1]!);

    await waitFor(() => expect(screen).toHavePathname('/'));
    expect(await storedDraft()).toBeNull();
  });
});
