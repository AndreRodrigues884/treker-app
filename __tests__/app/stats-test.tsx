// Phase 1d: progress in a workout, the saved workout screen and the Statistics screen.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, screen, waitFor } from 'expo-router/testing-library';

import { addDays, localDateOf } from '@/core/dates';
import { en } from '@/core/i18n/en';
import { statsRangeStart } from '@/core/progress';
import { resetEditStore } from '@/features/session/edit-store';
import { resetSessionStore } from '@/features/session/session-store';
import { resetStrengthChoice } from '@/features/stats/strength-choice';
import { getDeviceTimezone } from '@/lib/device';
import { storageKeys } from '@/lib/storage';

import { renderApp, resetStorage } from '../../test-utils/render-app';
import {
  onboardedProfile,
  resetSupabaseMock,
  seedLibraryExercises,
  serverRows,
  supabaseMock,
  TEST_USER_ID,
} from '../../test-utils/supabase-mock';

jest.mock('@/lib/supabase/client', () => require('../../test-utils/supabase-mock').clientModule);
// The bar chart draws with SVG; here each bar is a pressable with a test id, so a test can tap one
// as the athlete does. Everything else of the library is the real one.
jest.mock('react-native-gifted-charts', () => {
  const { createElement } = require('react');
  const { Pressable, View } = require('react-native');
  return {
    ...jest.requireActual('react-native-gifted-charts'),
    BarChart: ({ data }: { data: { onPress?: () => void }[] }) =>
      createElement(
        View,
        null,
        data.map((bar, index) =>
          createElement(Pressable, { key: index, testID: `bar-${index}`, onPress: bar.onPress }),
        ),
      ),
  };
});

const today = localDateOf(new Date(), getDeviceTimezone());
const daysAgo = (days: number) => addDays(today, -days);
const p = en.progress;
// The Statistics screen's first data (several requests) can take longer than the default 1 s.
const slow = { timeout: 5000 };

type SetInput = { exercise: string; weight?: number; reps?: number; seconds?: number };

// A saved workout, through the (mock) save_gym_session, so records are rebuilt like on the server.
async function saveWorkout(
  id: string,
  localDate: string,
  sets: SetInput[],
  templateId: string | null = null,
) {
  await supabaseMock.rpc('save_gym_session', {
    p_session: {
      id,
      local_date: localDate,
      timezone: 'UTC',
      started_at: `${localDate}T09:00:00.000Z`,
      ended_at: null,
      title: templateId ? 'Push A' : id,
      template_id: templateId,
      sets: sets.map((set, index) => ({
        id: `${id}-set-${index + 1}`,
        exercise_id: set.exercise,
        exercise_position: [...new Set(sets.map((item) => item.exercise))].indexOf(set.exercise),
        set_number: index + 1,
        weight_kg: set.weight ?? null,
        reps: set.reps ?? null,
        duration_s: set.seconds ?? null,
        difficulty: null,
        is_warmup: false,
      })),
    },
  });
  supabaseMock.rpc.mockClear();
}

function addTemplate(id: string, name: string, exerciseIds: string[]) {
  serverRows('workout_templates').push({
    id,
    user_id: TEST_USER_ID,
    name,
    notes: null,
    deleted_at: null,
    updated_at: '2026-11-01T10:00:00Z',
  });
  exerciseIds.forEach((exerciseId, position) =>
    serverRows('workout_template_exercises').push({
      id: `${id}-${position}`,
      user_id: TEST_USER_ID,
      template_id: id,
      exercise_id: exerciseId,
      position,
      target_sets: 1,
      target_reps_min: 8,
      target_reps_max: 8,
      target_seconds: null,
      notes: null,
      deleted_at: null,
    }),
  );
}

beforeEach(async () => {
  resetSessionStore();
  resetEditStore();
  resetStrengthChoice();
  resetSupabaseMock({ signedIn: true, profile: onboardedProfile({ weekly_target: 3 }) });
  seedLibraryExercises([
    { id: 'bench', name_en: 'Barbell Bench Press', name_pt: 'Supino plano com barra' },
    { id: 'deadlift', name_en: 'Deadlift', name_pt: 'Peso morto', muscle_group: 'back' },
    { id: 'squat', name_en: 'Back Squat', name_pt: 'Agachamento', muscle_group: 'quads' },
    { id: 'row', name_en: 'Barbell Row', name_pt: 'Remada', muscle_group: 'back' },
    { id: 'press', name_en: 'Overhead Press', name_pt: 'Press militar', muscle_group: 'shoulders' },
    { id: 'curl', name_en: 'Barbell Curl', name_pt: 'Curl', muscle_group: 'biceps' },
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
  await resetStorage();
});

describe('progress in a workout', () => {
  it('the detail shows the summary, and an arrow with before and today beside each exercise', async () => {
    await saveWorkout('w1', daysAgo(14), [
      { exercise: 'bench', weight: 100, reps: 8 },
      { exercise: 'plank', seconds: 60 },
    ]);
    await saveWorkout('w2', daysAgo(7), [
      { exercise: 'bench', weight: 100, reps: 9 },
      { exercise: 'plank', seconds: 50 },
      { exercise: 'deadlift', weight: 150, reps: 5 },
    ]);
    await renderApp('/activities/w2');

    // Deadlift is new, so 2 exercises were compared; 1 went up.
    expect(await screen.findByText(p.summaryOneUp.replace('{total}', '2'))).toBeOnTheScreen();
    expect(
      screen.getByLabelText(/^Barbell Bench Press: up, from 126\.7\skg to 130\skg \(Est\. 1RM\)$/),
    ).toBeOnTheScreen();
    expect(screen.getByLabelText('Plank: down, from 60 s to 50 s (Best time)')).toBeOnTheScreen();
    expect(
      screen.getByLabelText(/^Deadlift: first time, 175\skg \(Est\. 1RM\)$/),
    ).toBeOnTheScreen();
    // The set lines keep only their own information (the arrow is beside the exercise).
    expect(
      screen.getByLabelText(new RegExp(`^Set 1, 100\\skg × 9, ${en.records.prLabel}$`)),
    ).toBeOnTheScreen();
  });

  it('a workout with only new exercises says so instead of a count', async () => {
    await saveWorkout('w1', daysAgo(3), [{ exercise: 'bench', weight: 100, reps: 5 }]);
    await renderApp('/activities/w1');
    expect(await screen.findByLabelText(p.allFirst)).toBeOnTheScreen();
  });

  it('finishing: progress on the spot against last time, then the official one after saving', async () => {
    addTemplate('push-a', 'Push A', ['bench']);
    // Last time: 97.5 x 6 = 117 kg.
    await saveWorkout('last', daysAgo(7), [{ exercise: 'bench', weight: 97.5, reps: 6 }], 'push-a');

    // Workouts → Push A → Start.
    await renderApp('/workouts');
    await fireEvent.press(await screen.findByRole('button', { name: /^Open Push A, / }));
    await screen.findByRole('header', { name: 'Push A' });
    await fireEvent.press(screen.getByRole('button', { name: en.savedWorkout.start }));

    // 105 x 5 = 122.5 kg.
    await fireEvent.press(screen.getByRole('button', { name: /^Set 1, / }));
    await fireEvent.changeText(
      screen.getByLabelText(en.session.weight.replace('{unit}', 'kg')),
      '105',
    );
    await fireEvent.changeText(screen.getByLabelText(en.session.repsDone), '5');
    await fireEvent.press(screen.getByRole('button', { name: en.session.ok }));
    await fireEvent.press(screen.getByRole('button', { name: en.session.finish }));
    await screen.findByRole('header', { name: en.session.finishTitle });

    const single = p.summarySingle.replace('{up}', '1');
    expect(screen.getByText(single)).toBeOnTheScreen();
    expect(screen.getByText(p.liveHint)).toBeOnTheScreen();
    expect(
      screen.getByLabelText(/^Barbell Bench Press: up, from 117\skg to 122\.5\skg \(Est\. 1RM\)$/),
    ).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: en.session.save }));
    await screen.findByRole('header', { name: en.session.savedTitle });
    // From the server (session_progress) this time.
    expect(await screen.findByText(single)).toBeOnTheScreen();
    expect(screen.getByText(p.hint)).toBeOnTheScreen();
    expect(supabaseMock.rpc).toHaveBeenCalledWith('session_progress', {
      p_activity_id: expect.any(String),
    });
  });
});

describe('the saved workout screen', () => {
  it('how many times, the last date, Start and Edit, the result of each workout and a bar chart per exercise', async () => {
    addTemplate('push-a', 'Push A', ['bench']);
    // 126.67 (first), 130 (up), 120.33 (down).
    await saveWorkout('w1', daysAgo(21), [{ exercise: 'bench', weight: 100, reps: 8 }], 'push-a');
    await saveWorkout('w2', daysAgo(14), [{ exercise: 'bench', weight: 100, reps: 9 }], 'push-a');
    await saveWorkout('w3', daysAgo(7), [{ exercise: 'bench', weight: 95, reps: 8 }], 'push-a');

    await renderApp('/template/push-a');
    expect(await screen.findByRole('header', { name: 'Push A' })).toBeOnTheScreen();
    expect(await screen.findByText(/^Done 3 times · Last time: /)).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: en.savedWorkout.start })).toBeOnTheScreen();

    // The strip: one result per workout, oldest first.
    const strip = await screen.findAllByLabelText(/: (First time|Up|Down|Same)$/);
    expect(strip.map((item) => String(item.props.accessibilityLabel).split(': ')[1])).toEqual([
      'First time',
      'Up',
      'Down',
    ]);
    // The chart, in words.
    expect(
      screen.getByLabelText(
        /^Barbell Bench Press, Est\. 1RM, last 3 workouts: .+ 126\.7\skg First time, .+ 130\skg Up, .+ 120\.3\skg Down\.$/,
      ),
    ).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: en.savedWorkout.edit }));
    expect(
      await screen.findByRole('header', { name: en.templateEditor.editTitle }),
    ).toBeOnTheScreen();
  });

  it('one chart for all the exercises: the chips change it, and tapping a bar shows its exact value', async () => {
    addTemplate('push-a', 'Push A', ['bench', 'plank']);
    await saveWorkout(
      'w1',
      daysAgo(14),
      [
        { exercise: 'bench', weight: 100, reps: 8 },
        { exercise: 'plank', seconds: 60 },
      ],
      'push-a',
    );
    await saveWorkout(
      'w2',
      daysAgo(7),
      [
        { exercise: 'bench', weight: 100, reps: 9 },
        { exercise: 'plank', seconds: 75 },
      ],
      'push-a',
    );
    await renderApp('/template/push-a');

    // A single chart, for the first exercise; the latest workout's value at first.
    const chart = await screen.findByLabelText(/^Barbell Bench Press, Est\. 1RM, last 2 workouts/);
    expect(chart).toBeOnTheScreen();
    expect(screen.getAllByRole('image')).toHaveLength(1);
    expect(screen.getByLabelText(/^.+: 130\skg, Up$/)).toBeOnTheScreen();
    expect(screen.getByLabelText(/^Best: 130\skg$/)).toBeOnTheScreen();

    // Tapping the first bar (the phone's hover) shows its exact value. The chart draws once it
    // knows its width.
    await fireEvent(chart, 'layout', { nativeEvent: { layout: { width: 320, height: 240 } } });
    await fireEvent.press(screen.getByTestId('bar-0', { includeHiddenElements: true }));
    expect(screen.getByLabelText(/^.+: 126\.7\skg, First time$/)).toBeOnTheScreen();

    // Another exercise in the same chart.
    await fireEvent.press(screen.getByRole('togglebutton', { name: 'Plank' }));
    expect(
      screen.getByLabelText(
        /^Plank, Best time, last 2 workouts: .+ 60 s First time, .+ 75 s Up\.$/,
      ),
    ).toBeOnTheScreen();
    expect(screen.getAllByRole('image')).toHaveLength(1);
    expect(screen.getByLabelText(/^.+: 75 s, Up$/)).toBeOnTheScreen();
  });

  it('without workouts yet: an empty state', async () => {
    addTemplate('core', 'Core', ['plank']);
    await renderApp('/template/core');
    expect(await screen.findByText(en.savedWorkout.emptyTitle)).toBeOnTheScreen();
    expect(screen.getByText(en.savedWorkout.never)).toBeOnTheScreen();
  });
});

// Two workouts where the set counts are bench 6, deadlift 5, squat 4, row 3, press 2, curl 1 (and
// planks, which have no 1RM).
async function strengthWorkouts() {
  const plan: [string, [number, number]][] = [
    ['bench', [3, 3]],
    ['deadlift', [3, 2]],
    ['squat', [2, 2]],
    ['row', [2, 1]],
    ['press', [1, 1]],
    ['curl', [0, 1]],
  ];
  for (const [index, day] of [20, 10].entries()) {
    await saveWorkout(`w${index}`, daysAgo(day), [
      ...plan.flatMap(([exercise, counts]) =>
        Array.from({ length: counts[index] ?? 0 }, () => ({
          exercise,
          weight: (exercise === 'curl' ? 30 : 100) + index * 10,
          reps: 5,
        })),
      ),
      { exercise: 'plank', seconds: 60 },
      { exercise: 'plank', seconds: 60 },
    ]);
  }
}

describe('the Statistics screen', () => {
  it('is in the menu between Records and Profile', async () => {
    await renderApp('/');
    await fireEvent.press(await screen.findByRole('button', { name: en.nav.openMenu }));
    const buttons = screen.getAllByRole('button');
    const at = (name: string) => buttons.indexOf(screen.getByRole('button', { name }));
    expect(at(en.nav.records)).toBeLessThan(at(en.nav.stats));
    expect(at(en.nav.stats)).toBeLessThan(at(en.nav.profile));
    await fireEvent.press(screen.getByRole('button', { name: en.nav.stats }));
    expect(await screen.findByText(en.stats.perWeek)).toBeOnTheScreen();
  });

  it('the period changes every section; workouts per week with the goal', async () => {
    await saveWorkout('w1', daysAgo(60), [{ exercise: 'bench', weight: 100, reps: 5 }]);
    await saveWorkout('w2', daysAgo(9), [{ exercise: 'bench', weight: 100, reps: 5 }]);
    await saveWorkout('w3', daysAgo(2), [{ exercise: 'bench', weight: 100, reps: 6 }]);
    await renderApp('/stats');

    // 3 months by default.
    expect(
      await screen.findByLabelText(
        /^3 workouts in the last 3 months, an average of .+ a week\. Your goal is 3 a week\.$/,
      ),
    ).toBeOnTheScreen();
    expect(screen.getByLabelText(`${en.stats.goal}: 3 a week`)).toBeOnTheScreen();
    expect(screen.getByText('Workouts logged per muscle group · last 3 months')).toBeOnTheScreen();
    // The saved workouts done most are no longer on this screen.
    expect(screen.queryByText(en.stats.topWorkouts)).not.toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('togglebutton', { name: en.stats.ranges['4w'] }));
    expect(
      await screen.findByLabelText(
        /^2 workouts in the last 4 weeks, an average of .+ a week\. Your goal is 3 a week\.$/,
      ),
    ).toBeOnTheScreen();
    expect(screen.getByText('Workouts logged per muscle group · last 4 weeks')).toBeOnTheScreen();
    for (const fn of ['weekly_summary', 'volume_by_muscle_group']) {
      expect(supabaseMock.rpc).toHaveBeenCalledWith(fn, {
        p_from: statsRangeStart('4w', today),
        p_to: today,
      });
    }

    // "All": from the first workout, without a start date.
    await fireEvent.press(screen.getByRole('togglebutton', { name: en.stats.ranges.all }));
    expect(await screen.findByLabelText(/^3 workouts since the first workout, /)).toBeOnTheScreen();
    expect(supabaseMock.rpc).toHaveBeenCalledWith('weekly_summary', { p_from: null, p_to: today });
  });

  it('strength: one chart for the exercises done most; the chips switch it', async () => {
    await strengthWorkouts();
    await renderApp('/stats');

    // The 5 done most as chips (not the plank, which has no 1RM; not the curl, done least), and a
    // single chart, for the first one.
    expect(
      await screen.findByLabelText(
        /^Barbell Bench Press went up from 116\.7\skg to 128\.3\skg/,
        {},
        slow,
      ),
    ).toBeOnTheScreen();
    expect(screen.getByLabelText(/^Current: 128\.3\skg$/)).toBeOnTheScreen();
    for (const name of ['Deadlift', 'Back Squat', 'Barbell Row', 'Overhead Press']) {
      expect(screen.getByRole('togglebutton', { name })).toBeOnTheScreen();
      expect(screen.queryByLabelText(new RegExp(`^${name} went up from `))).not.toBeOnTheScreen();
    }
    expect(screen.queryByRole('togglebutton', { name: 'Barbell Curl' })).not.toBeOnTheScreen();

    // Another chip, the same chart.
    await fireEvent.press(screen.getByRole('togglebutton', { name: 'Deadlift' }));
    expect(screen.getByLabelText(/^Deadlift went up from /)).toBeOnTheScreen();
    expect(screen.queryByLabelText(/^Barbell Bench Press went up from /)).not.toBeOnTheScreen();
  });

  it('strength: the choice kept on the phone; one workout is not enough for a line', async () => {
    await strengthWorkouts();
    await AsyncStorage.setItem(
      storageKeys.strengthExercises(TEST_USER_ID),
      JSON.stringify(['curl', 'bench']),
    );
    await renderApp('/stats');

    expect(
      await screen.findByRole('togglebutton', { name: 'Barbell Curl' }, slow),
    ).toBeOnTheScreen();
    expect(screen.queryByRole('togglebutton', { name: 'Deadlift' })).not.toBeOnTheScreen();
    expect(await screen.findByText(en.stats.empty, {}, slow)).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('togglebutton', { name: 'Barbell Bench Press' }));
    expect(screen.getByLabelText(/^Barbell Bench Press went up from /)).toBeOnTheScreen();
  });

  it('workouts per muscle group, the most trained first', async () => {
    await saveWorkout('w1', daysAgo(5), [
      { exercise: 'bench', weight: 100, reps: 5 },
      { exercise: 'deadlift', weight: 150, reps: 5 },
      { exercise: 'plank', seconds: 60 },
    ]);
    await saveWorkout('w2', daysAgo(3), [{ exercise: 'bench', weight: 100, reps: 5 }]);
    await renderApp('/stats');

    // Each row is labelled, and so is its bar: one label per row is enough here.
    const rows = (await screen.findAllByLabelText(/^(Chest|Back|Core): \d workouts?$/, {}, slow))
      .map((row) => row.props.accessibilityLabel as string)
      .filter((label, index, all) => all.indexOf(label) === index);
    expect(rows).toEqual(['Chest: 2 workouts', 'Back: 1 workout', 'Core: 1 workout']);
  });

  it('deleting a workout refreshes the statistics', async () => {
    await saveWorkout('w1', daysAgo(9), [{ exercise: 'bench', weight: 100, reps: 5 }], null);
    await saveWorkout('w2', daysAgo(2), [{ exercise: 'bench', weight: 100, reps: 6 }], null);
    await renderApp('/stats');
    expect(await screen.findAllByLabelText('Chest: 2 workouts', {}, slow)).not.toHaveLength(0);

    // Menu → Profile → the latest workout → Delete.
    await fireEvent.press(screen.getByRole('button', { name: en.nav.openMenu }));
    await fireEvent.press(screen.getByRole('button', { name: en.nav.profile }));
    await fireEvent.press(await screen.findByRole('button', { name: /^Open w2, / }));
    await fireEvent.press(await screen.findByRole('button', { name: en.workout.delete }));
    await fireEvent.press(screen.getByRole('button', { name: en.workout.deleteConfirm }));
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: /^Open w2, / })).not.toBeOnTheScreen(),
    );

    await fireEvent.press(screen.getByRole('button', { name: en.nav.openMenu }));
    await fireEvent.press(screen.getByRole('button', { name: en.nav.stats }));
    expect(await screen.findAllByLabelText('Chest: 1 workout', {}, slow)).not.toHaveLength(0);
  });

  it('a new athlete gets useful empty states', async () => {
    await renderApp('/stats');
    expect(await screen.findAllByText(en.stats.empty, {}, slow)).toHaveLength(2);
    expect(screen.getByText(en.stats.strengthNone)).toBeOnTheScreen();
  });
  // Last in the file: coming back from the chooser leaves the test navigator mid-transition.
  it('strength: the athlete chooses up to 5 exercises in the library', async () => {
    await strengthWorkouts();
    await renderApp('/stats');
    await fireEvent.press(
      await screen.findByRole('button', { name: en.stats.chooseExercises }, slow),
    );
    await screen.findByRole('header', { name: en.strengthPicker.title });
    // Starts from the 5 done most.
    expect(screen.getByText('5 of 5 chosen')).toBeOnTheScreen();
    expect(screen.getByRole('checkbox', { name: /^Barbell Bench Press, / })).toBeChecked();

    // A sixth is refused; untick one, then the curl fits.
    await fireEvent.press(screen.getByRole('checkbox', { name: /^Barbell Curl, / }));
    expect(screen.getByText(en.strengthPicker.limit)).toBeOnTheScreen();
    expect(screen.getByRole('checkbox', { name: /^Barbell Curl, / })).not.toBeChecked();

    await fireEvent.press(screen.getByRole('checkbox', { name: /^Overhead Press, / }));
    await fireEvent.press(screen.getByRole('checkbox', { name: /^Barbell Curl, / }));
    expect(screen.queryByText(en.strengthPicker.limit)).not.toBeOnTheScreen();
    expect(screen.getByRole('checkbox', { name: /^Barbell Curl, / })).toBeChecked();
    expect(screen.getByText('5 of 5 chosen')).toBeOnTheScreen();

    // Kept on the phone, for this user.
    await waitFor(async () =>
      expect(
        JSON.parse(
          (await AsyncStorage.getItem(storageKeys.strengthExercises(TEST_USER_ID))) ?? '[]',
        ),
      ).toEqual(['bench', 'deadlift', 'squat', 'row', 'curl']),
    );

    // Back on Statistics: the chips and the request follow the choice.
    await fireEvent.press(screen.getByRole('button', { name: en.strengthPicker.done }));
    expect(await screen.findByRole('togglebutton', { name: 'Barbell Curl' })).toBeOnTheScreen();
    expect(screen.queryByRole('togglebutton', { name: 'Overhead Press' })).not.toBeOnTheScreen();
    await waitFor(() =>
      expect(supabaseMock.rpc).toHaveBeenCalledWith('one_rep_max_series', {
        p_exercise_ids: ['bench', 'deadlift', 'squat', 'row', 'curl'],
        p_from: statsRangeStart('3m', today),
      }),
    );
  });
});
