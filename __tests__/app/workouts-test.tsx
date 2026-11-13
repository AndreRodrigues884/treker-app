// Phase 1a: the exercise library, custom exercises and saved workouts, through the real routes.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act } from '@testing-library/react-native';
import { Alert, type AlertButton } from 'react-native';
import { fireEvent, screen, waitFor, within } from 'expo-router/testing-library';

import { en } from '@/core/i18n/en';
import { pt } from '@/core/i18n/pt';
import { resetSessionStore } from '@/features/session/session-store';
import { resetDraftStore } from '@/features/templates/draft-store';
import { storageKeys } from '@/lib/storage';
import { colors } from '@/theme';

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

const LIBRARY = [
  {
    id: 'bench',
    name_en: 'Barbell Bench Press',
    name_pt: 'Supino plano com barra',
    muscle_group: 'chest' as const,
    equipment: 'barbell' as const,
  },
  {
    id: 'incline',
    name_en: 'Incline Dumbbell Bench Press',
    name_pt: 'Supino inclinado com halteres',
    muscle_group: 'chest' as const,
    equipment: 'dumbbell' as const,
  },
  {
    id: 'press',
    name_en: 'Overhead Press',
    name_pt: 'Desenvolvimento militar',
    muscle_group: 'shoulders' as const,
    equipment: 'barbell' as const,
  },
  {
    id: 'pull-up',
    name_en: 'Pull-up',
    name_pt: 'Elevações na barra',
    muscle_group: 'back' as const,
    equipment: 'bodyweight' as const,
    adds_bodyweight: true,
  },
  {
    id: 'plank',
    name_en: 'Plank',
    name_pt: 'Prancha',
    muscle_group: 'core' as const,
    equipment: 'bodyweight' as const,
    unit: 'seconds' as const,
    tracks_load: false,
  },
];

const ex = en.exercises;
const editor = en.templateEditor;

// The accessible name of a library row: "Name, Muscle · Equipment".
const row = (name: string, meta: string) => new RegExp(`^${name}, .*${meta}`);
const checkbox = (name: string) =>
  screen.getByRole('checkbox', { name: new RegExp(`^${name}(, ${ex.yours})?, `) });

beforeEach(async () => {
  resetSessionStore();
  resetSupabaseMock({ signedIn: true, profile: onboardedProfile() });
  seedLibraryExercises(LIBRARY);
  resetDraftStore();
  await resetStorage();
});

async function openPicker() {
  await renderApp('/workouts');
  await fireEvent.press(await screen.findByRole('button', { name: en.workouts.new }));
  await fireEvent.press(await screen.findByRole('button', { name: editor.addExercises }));
  await screen.findByRole('header', { name: ex.pickTitle });
}

async function pickAndAdd(names: string[]) {
  for (const name of names) await fireEvent.press(checkbox(name));
  await fireEvent.press(
    screen.getByRole('button', { name: ex.add.replace('{count}', String(names.length)) }),
  );
  await screen.findByRole('header', { name: editor.newTitle });
}

// A new template "Push A" with these exercises, saved.
async function createTemplate(names: string[], name = 'Push A') {
  await openPicker();
  await pickAndAdd(names);
  await fireEvent.changeText(screen.getByLabelText(editor.name), name);
  await fireEvent.press(screen.getByRole('button', { name: en.common.save }));
  await screen.findByRole('button', { name: en.workouts.new });
}

// The card of a saved workout in the list: its accessible name is "Open <name>, <count>".
const cardName = (name: string, count?: string) =>
  new RegExp(`^${en.workouts.open.replace('{name}', name)}, ${count ?? '.+'}$`);

// From the list: the saved workout's screen, then its "Edit".
async function openEditor(name: string) {
  await fireEvent.press(await findCard(name));
  await screen.findByRole('header', { name });
  await fireEvent.press(screen.getByRole('button', { name: en.savedWorkout.edit }));
}
const findCard = (name: string, count?: string) =>
  screen.findByRole('button', { name: cardName(name, count) });

function savedPayloads() {
  return supabaseMock.rpc.mock.calls
    .filter(([fn]) => fn === 'save_workout_template')
    .map(
      ([, args]) =>
        (
          args as {
            p_template: {
              id: string;
              name: string;
              exercises: { id: string; exercise_id: string }[];
            };
          }
        ).p_template,
    );
}

describe('exercise library', () => {
  it('searches without accents or case, in the app language ("supino" finds "Supino")', async () => {
    await AsyncStorage.setItem(storageKeys.language, JSON.stringify('pt'));
    await renderApp('/exercises');

    await screen.findByText('Supino plano com barra');
    await fireEvent.changeText(screen.getByLabelText(pt.exercises.search), 'SUPINO');

    expect(screen.getByText('Supino plano com barra')).toBeOnTheScreen();
    expect(screen.getByText('Supino inclinado com halteres')).toBeOnTheScreen();
    expect(screen.queryByText('Prancha')).not.toBeOnTheScreen();

    await fireEvent.changeText(screen.getByLabelText(pt.exercises.search), 'elevacoes');
    expect(screen.getByText('Elevações na barra')).toBeOnTheScreen();
    expect(screen.queryByText('Supino plano com barra')).not.toBeOnTheScreen();
  });

  it('filters by muscle group and by equipment', async () => {
    await renderApp('/exercises');
    await screen.findByText('Plank');

    await fireEvent.press(screen.getByRole('togglebutton', { name: ex.muscleGroups.chest }));
    expect(screen.getByText('Barbell Bench Press')).toBeOnTheScreen();
    expect(screen.getByText('Incline Dumbbell Bench Press')).toBeOnTheScreen();
    expect(screen.queryByText('Plank')).not.toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('togglebutton', { name: ex.equipmentTypes.dumbbell }));
    expect(screen.queryByText('Barbell Bench Press')).not.toBeOnTheScreen();
    expect(screen.getByText('Incline Dumbbell Bench Press')).toBeOnTheScreen();
    expect(screen.getByText(ex.results.replace('{count}', '1'))).toBeOnTheScreen();
  });

  it("marks the athlete's own exercises and lists them first", async () => {
    serverRows('exercises').push({
      ...LIBRARY[0],
      id: 'mine',
      slug: null,
      owner_id: TEST_USER_ID,
      name_en: 'Zercher squat',
      name_pt: 'Zercher squat',
      muscle_group: 'quads',
      unit: 'reps',
      tracks_load: true,
      adds_bodyweight: false,
      archived: false,
      deleted_at: null,
    });
    await renderApp('/exercises');

    const mine = await screen.findByRole('button', { name: row(`Zercher squat, ${ex.yours}`, '') });
    const names = screen.getAllByText(/^(Zercher squat|Barbell Bench Press|Plank)$/);
    expect(names[0]).toHaveTextContent('Zercher squat');
    expect(within(mine).getByText(ex.yours)).toBeOnTheScreen();
  });

  it('picks several exercises at once, with a counter and "Add (N)"', async () => {
    await openPicker();
    const add = (count: number) =>
      screen.getByRole('button', { name: ex.add.replace('{count}', String(count)) });

    expect(add(0)).toBeDisabled();
    await fireEvent.press(checkbox('Overhead Press'));
    await fireEvent.press(checkbox('Barbell Bench Press'));
    expect(checkbox('Overhead Press')).toBeChecked();
    expect(screen.getByText(ex.selected.replace('{count}', '2'))).toBeOnTheScreen();

    await fireEvent.press(add(2));

    // Back in the editor, in the order they were ticked.
    await screen.findByRole('header', { name: editor.newTitle });
    expect(savedOrderFromScreen()).toEqual(['Overhead Press', 'Barbell Bench Press']);
  });

  it('offers to create the exercise typed when the search finds nothing, and ticks it', async () => {
    await openPicker();
    await fireEvent.changeText(screen.getByLabelText(ex.search), 'Landmine press');

    expect(screen.getByText(ex.emptyTitle)).toBeOnTheScreen();
    await fireEvent.press(
      screen.getByRole('button', { name: ex.createNamed.replace('{name}', 'Landmine press') }),
    );

    await screen.findByRole('header', { name: en.exerciseForm.newTitle });
    expect(screen.getByLabelText(en.exerciseForm.name)).toHaveDisplayValue('Landmine press');
    await fireEvent.press(screen.getByRole('togglebutton', { name: ex.muscleGroups.shoulders }));
    await fireEvent.press(screen.getByRole('togglebutton', { name: ex.equipmentTypes.barbell }));
    await fireEvent.press(screen.getByRole('button', { name: en.common.save }));

    // Back in the multiple choice, with the new exercise ticked.
    await screen.findByRole('header', { name: ex.pickTitle });
    await fireEvent.changeText(screen.getByLabelText(ex.search), '');
    await waitFor(() => expect(checkbox('Landmine press')).toBeChecked());
    expect(screen.getByRole('button', { name: ex.add.replace('{count}', '1') })).toBeEnabled();
    expect(serverRows('exercises').find((r) => r.name_en === 'Landmine press')).toMatchObject({
      owner_id: TEST_USER_ID,
      muscle_group: 'shoulders',
      equipment: 'barbell',
    });
  });
});

describe('creating an exercise while building a workout', () => {
  it('"New exercise" in "Add exercises" comes back ticked, and the workout is kept', async () => {
    await openPicker();
    await pickAndAdd(['Barbell Bench Press']);
    await fireEvent.changeText(screen.getByLabelText(editor.name), 'Push A');

    await fireEvent.press(screen.getByRole('button', { name: editor.addExercises }));
    await screen.findByRole('header', { name: ex.pickTitle });
    await fireEvent.press(screen.getByRole('button', { name: ex.create }));

    await screen.findByRole('header', { name: en.exerciseForm.newTitle });
    expect(screen.getByLabelText(en.exerciseForm.name)).toHaveDisplayValue('');
    await fireEvent.changeText(screen.getByLabelText(en.exerciseForm.name), 'Landmine press');
    await fireEvent.press(screen.getByRole('togglebutton', { name: ex.muscleGroups.shoulders }));
    await fireEvent.press(screen.getByRole('togglebutton', { name: ex.equipmentTypes.barbell }));
    await fireEvent.press(screen.getByRole('button', { name: en.common.save }));

    // Back in "Add exercises" with the new exercise ticked.
    await screen.findByRole('header', { name: ex.pickTitle });
    await waitFor(() => expect(checkbox('Landmine press')).toBeChecked());
    await fireEvent.press(screen.getByRole('button', { name: ex.add.replace('{count}', '1') }));

    // The same workout, with the new exercise added at the end.
    await screen.findByRole('header', { name: editor.newTitle });
    expect(screen.getByLabelText(editor.name)).toHaveDisplayValue('Push A');
    expect(savedOrderFromScreen()).toEqual(['Barbell Bench Press', 'Landmine press']);
  });
});

describe('custom exercises', () => {
  const form = en.exerciseForm;

  it('validates the form and explains each option in one line', async () => {
    await renderApp('/exercises/new');
    await screen.findByRole('header', { name: form.newTitle });

    await fireEvent.press(screen.getByRole('button', { name: en.common.save }));

    expect(screen.getByText(form.errors.nameRequired)).toBeOnTheScreen();
    expect(screen.getAllByText(form.errors.required)).toHaveLength(2);
    expect(supabaseMock.writes).toHaveLength(0);
    expect(
      screen.getByRole('checkbox', { name: `${form.tracksLoad}. ${form.tracksLoadHint}` }),
    ).toBeChecked();
  });

  it('shows "adds bodyweight" only for bodyweight exercises in reps that use weight', async () => {
    await renderApp('/exercises/new');
    await screen.findByRole('header', { name: form.newTitle });
    const addsBodyweight = () =>
      screen.queryByRole('checkbox', {
        name: `${form.addsBodyweight}. ${form.addsBodyweightHint}`,
      });

    expect(addsBodyweight()).not.toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('togglebutton', { name: ex.equipmentTypes.bodyweight }));
    expect(addsBodyweight()).toBeOnTheScreen();

    await fireEvent.press(
      screen.getByRole('radio', { name: `${ex.units.seconds}. ${form.unitSecondsHint}` }),
    );
    expect(addsBodyweight()).not.toBeOnTheScreen();
  });

  it('edits and deletes an own exercise, after a dialog that says what happens', async () => {
    serverRows('exercises').push({
      id: 'mine',
      owner_id: TEST_USER_ID,
      slug: null,
      name_en: 'Zercher squat',
      name_pt: 'Zercher squat',
      muscle_group: 'quads',
      equipment: 'barbell',
      unit: 'reps',
      tracks_load: true,
      adds_bodyweight: false,
      archived: false,
      deleted_at: null,
    });
    serverRows('workout_templates').push({
      id: 't1',
      user_id: TEST_USER_ID,
      name: 'Legs',
      deleted_at: null,
      updated_at: '2026-11-01',
    });
    serverRows('workout_template_exercises').push({
      id: 'r1',
      user_id: TEST_USER_ID,
      template_id: 't1',
      exercise_id: 'mine',
      position: 0,
      deleted_at: null,
    });

    // The library opens the exercise's screen; its form is behind "Edit exercise".
    await renderApp('/exercises');
    await fireEvent.press(
      await screen.findByRole('button', { name: row(`Zercher squat, ${ex.yours}`, '') }),
    );
    await fireEvent.press(await screen.findByRole('button', { name: en.exercise.editExercise }));
    await screen.findByRole('header', { name: form.editTitle });
    expect(screen.getByText(form.changesRecords)).toBeOnTheScreen();

    await fireEvent.changeText(screen.getByLabelText(form.name), 'Zercher squat (pause)');
    await fireEvent.press(screen.getByRole('button', { name: en.common.save }));
    // Back on the exercise's screen, with the new name.
    await screen.findByRole('header', { name: 'Zercher squat (pause)' });

    await fireEvent.press(screen.getByRole('button', { name: en.exercise.editExercise }));
    const deleteButton = await screen.findByRole('button', { name: form.delete });
    // Red with white text.
    expect(deleteButton).toHaveStyle({ backgroundColor: colors.dangerSolid });
    expect(within(deleteButton).getByText(form.delete)).toHaveStyle({ color: colors.onDanger });

    // The dialog says what happens; "Cancel" keeps the exercise.
    await fireEvent.press(deleteButton);
    expect(
      screen.getByRole('header', {
        name: form.deleteTitle.replace('{name}', 'Zercher squat (pause)'),
      }),
    ).toBeOnTheScreen();
    expect(screen.getByText(form.deleteBody)).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: en.common.cancel }));
    expect(screen.queryByText(form.deleteBody)).not.toBeOnTheScreen();
    expect(supabaseMock.rpc).not.toHaveBeenCalledWith('delete_custom_exercise', expect.anything());

    await fireEvent.press(deleteButton);
    await fireEvent.press(screen.getByRole('button', { name: form.deleteConfirm }));

    // Back in the library, without it.
    await screen.findByRole('header', { name: ex.title });
    await waitFor(() => expect(screen.queryByText('Zercher squat (pause)')).not.toBeOnTheScreen());
    expect(supabaseMock.rpc).toHaveBeenCalledWith('delete_custom_exercise', {
      p_exercise_id: 'mine',
    });
    expect(serverRows('exercises').find((r) => r.id === 'mine')?.deleted_at).not.toBeNull();
    // It left the saved workout too.
    expect(
      serverRows('workout_template_exercises').find((r) => r.id === 'r1')?.deleted_at,
    ).not.toBeNull();
  });

  it('keeps the exercise and offers "Try again" when deleting fails without a connection', async () => {
    serverRows('exercises').push({
      id: 'mine',
      owner_id: TEST_USER_ID,
      slug: null,
      name_en: 'Zercher squat',
      name_pt: 'Zercher squat',
      muscle_group: 'quads',
      equipment: 'barbell',
      unit: 'reps',
      tracks_load: true,
      adds_bodyweight: false,
      archived: false,
      deleted_at: null,
    });
    await renderApp('/exercises/mine');
    await fireEvent.press(await screen.findByRole('button', { name: form.delete }));

    goOffline();
    await fireEvent.press(screen.getByRole('button', { name: form.deleteConfirm }));

    expect(await screen.findByText(form.deleteErrors.network)).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: form.editTitle })).toBeOnTheScreen();

    goOffline(false);
    await fireEvent.press(screen.getByRole('button', { name: en.common.retry }));
    await waitFor(() =>
      expect(serverRows('exercises').find((r) => r.id === 'mine')?.deleted_at).not.toBeNull(),
    );
  });
});

describe('saved workouts', () => {
  it('shows each saved workout on one line: "Name - N exercises" and a red bin', async () => {
    await createTemplate(['Barbell Bench Press', 'Overhead Press', 'Plank']);

    const card = await findCard('Push A', en.workouts.exerciseCount.replace('{count}', '3'));
    expect(within(card).getByText('Push A - 3 exercises')).toBeOnTheScreen();
    // No exercise names and no duplicate button.
    expect(screen.queryByText(/Barbell Bench Press/)).not.toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: /duplicate/i })).not.toBeOnTheScreen();
    expect(
      screen.getByRole('button', { name: en.workouts.deleteNamed.replace('{name}', 'Push A') }),
    ).toBeOnTheScreen();
  });

  it('creates a workout with targets in one request, then edits it with the same ids', async () => {
    await openPicker();
    await pickAndAdd(['Barbell Bench Press', 'Plank']);

    // Validation before saving.
    await fireEvent.press(screen.getByRole('button', { name: en.common.save }));
    expect(screen.getByText(editor.errors.nameRequired)).toBeOnTheScreen();

    await fireEvent.changeText(screen.getByLabelText(editor.name), 'Push A');
    await fireEvent.press(screen.getAllByRole('button', { name: editor.moreSets })[0]);
    await fireEvent.press(screen.getAllByRole('button', { name: editor.moreReps })[0]);
    // Seconds go up in steps of 5.
    await fireEvent.press(screen.getByRole('button', { name: editor.moreSeconds }));
    await fireEvent.press(screen.getByRole('button', { name: en.common.save }));
    await findCard('Push A');

    const [created] = savedPayloads();
    expect(created.name).toBe('Push A');
    expect(created.exercises).toEqual([
      expect.objectContaining({
        exercise_id: 'bench',
        target_sets: 4,
        target_reps_min: 11,
        target_reps_max: 11,
        target_seconds: null,
      }),
      expect.objectContaining({
        exercise_id: 'plank',
        target_sets: 3,
        target_reps_min: null,
        target_seconds: 35,
      }),
    ]);
    expect(serverRows('workout_template_exercises')).toHaveLength(2);

    // Editing (list → the saved workout → Edit): same template id and row ids, new name.
    await openEditor('Push A');
    await screen.findByRole('header', { name: editor.editTitle });
    expect(screen.getByLabelText(editor.name)).toHaveDisplayValue('Push A');
    await fireEvent.changeText(screen.getByLabelText(editor.name), 'Push B');
    await fireEvent.press(screen.getByRole('button', { name: en.common.save }));
    // Back on the saved workout's screen, with the new name; then the list.
    await screen.findByRole('header', { name: 'Push B' });
    await fireEvent.press(screen.getByRole('button', { name: en.common.back }));
    await findCard('Push B');

    const edited = savedPayloads()[1];
    expect(edited.id).toBe(created.id);
    expect(edited.exercises.map((e) => e.id)).toEqual(created.exercises.map((e) => e.id));
    expect(serverRows('workout_templates')).toHaveLength(1);
    expect(serverRows('workout_template_exercises')).toHaveLength(2);
  });

  it('shows each exercise with only its equipment under the name, and "3 sets" / "10 reps"', async () => {
    await openPicker();
    await pickAndAdd(['Pull-up', 'Barbell Bench Press']);

    const grid = screen.getByTestId('sortable-grid');
    expect(within(grid).getByText(ex.equipmentTypes.bodyweight)).toBeOnTheScreen();
    expect(within(grid).getByText(ex.equipmentTypes.barbell)).toBeOnTheScreen();
    // No muscle group, no position, no "Sets" / "Reps" titles: only the values.
    expect(within(grid).queryByText(/Back|Chest|1 of 2/)).not.toBeOnTheScreen();
    expect(within(grid).queryByText(editor.sets)).not.toBeOnTheScreen();
    expect(within(grid).queryByText(editor.reps)).not.toBeOnTheScreen();
    expect(within(grid).getAllByText(editor.setsValue.replace('{count}', '3'))).toHaveLength(2);
    expect(within(grid).getAllByText(editor.repsValue.replace('{count}', '10'))).toHaveLength(2);
    expect(
      screen.getByRole('button', { name: editor.remove.replace('{name}', 'Pull-up') }),
    ).toBeOnTheScreen();
  });

  it('reorders exercises by dragging and with the up/down buttons', async () => {
    await openPicker();
    await pickAndAdd(['Barbell Bench Press', 'Overhead Press', 'Plank']);
    await fireEvent.changeText(screen.getByLabelText(editor.name), 'Push A');

    // Drag the first exercise to the end: Press, Plank, Bench.
    expect(savedOrderFromScreen()).toEqual(['Barbell Bench Press', 'Overhead Press', 'Plank']);
    const grid = screen.getByTestId('sortable-grid');
    await fireEvent(grid, 'dragEnd', dragEndParams(grid.props.items, 0, 2));
    expect(savedOrderFromScreen()).toEqual(['Overhead Press', 'Plank', 'Barbell Bench Press']);

    // Buttons, for screen readers: Bench up -> Press, Bench, Plank.
    await fireEvent.press(
      screen.getByRole('button', { name: editor.moveUp.replace('{name}', 'Barbell Bench Press') }),
    );
    expect(savedOrderFromScreen()).toEqual(['Overhead Press', 'Barbell Bench Press', 'Plank']);
    expect(
      screen.getByRole('button', { name: editor.moveUp.replace('{name}', 'Overhead Press') }),
    ).toBeDisabled();
    expect(
      screen.getByRole('button', { name: editor.moveDown.replace('{name}', 'Plank') }),
    ).toBeDisabled();

    await fireEvent.press(screen.getByRole('button', { name: en.common.save }));
    await findCard('Push A');
    expect(savedPayloads()[0].exercises.map((e) => e.exercise_id)).toEqual([
      'press',
      'bench',
      'plank',
    ]);
    const stored = serverRows<{ exercise_id: string; position: number }>(
      'workout_template_exercises',
    );
    expect([...stored].sort((a, b) => a.position - b.position).map((r) => r.exercise_id)).toEqual([
      'press',
      'bench',
      'plank',
    ]);
  });

  it('deletes a workout with the bin, after confirming, by marking deleted_at', async () => {
    await createTemplate(['Barbell Bench Press'], 'Push A');
    await createTemplate(['Plank'], 'Core');
    const [, core] = savedPayloads();

    await fireEvent.press(
      screen.getByRole('button', { name: en.workouts.deleteNamed.replace('{name}', 'Core') }),
    );
    expect(
      screen.getByText(en.workouts.deleteQuestion.replace('{name}', 'Core')),
    ).toBeOnTheScreen();

    // Cancel keeps it.
    await fireEvent.press(screen.getByRole('button', { name: en.common.cancel }));
    expect(
      screen.queryByText(en.workouts.deleteQuestion.replace('{name}', 'Core')),
    ).not.toBeOnTheScreen();

    await fireEvent.press(
      screen.getByRole('button', { name: en.workouts.deleteNamed.replace('{name}', 'Core') }),
    );
    await fireEvent.press(screen.getByRole('button', { name: en.workouts.deleteConfirm }));

    await waitFor(() =>
      expect(screen.queryByRole('button', { name: cardName('Core') })).not.toBeOnTheScreen(),
    );
    expect(screen.getByRole('button', { name: cardName('Push A') })).toBeOnTheScreen();
    const deleted = serverRows<{ id: string; deleted_at: string | null }>('workout_templates').find(
      (t) => t.id === core.id,
    );
    expect(deleted?.deleted_at).not.toBeNull();
  });

  it('keeps the workout being edited after a network error, and "Try again" does not duplicate', async () => {
    await openPicker();
    await pickAndAdd(['Barbell Bench Press', 'Overhead Press']);
    await fireEvent.changeText(screen.getByLabelText(editor.name), 'Push A');

    goOffline();
    await fireEvent.press(screen.getByRole('button', { name: en.common.save }));

    expect(await screen.findByText(editor.errors.network)).toBeOnTheScreen();
    expect(screen.getByLabelText(editor.name)).toHaveDisplayValue('Push A');
    expect(savedOrderFromScreen()).toEqual(['Barbell Bench Press', 'Overhead Press']);
    expect(serverRows('workout_templates')).toHaveLength(0);

    // A first retry that also fails, then one that works.
    await fireEvent.press(screen.getByRole('button', { name: en.common.retry }));
    expect(await screen.findByText(editor.errors.network)).toBeOnTheScreen();
    goOffline(false);
    await fireEvent.press(screen.getByRole('button', { name: en.common.retry }));

    await findCard('Push A');
    const payloads = savedPayloads();
    expect(new Set(payloads.map((p) => p.id)).size).toBe(1);
    expect(new Set(payloads.map((p) => p.exercises.map((e) => e.id).join()))).toHaveProperty(
      'size',
      1,
    );
    expect(serverRows('workout_templates')).toHaveLength(1);
    expect(serverRows('workout_template_exercises')).toHaveLength(2);
  });
});

describe('leaving the template editor', () => {
  const alert = () => jest.spyOn(Alert, 'alert').mockImplementation(() => {});

  // Presses one of the buttons of the last dialog shown.
  async function answer(spy: jest.SpyInstance, text: string) {
    const buttons = spy.mock.calls.at(-1)?.[2] as AlertButton[];
    await act(async () => buttons.find((button) => button.text === text)?.onPress?.());
  }

  afterEach(() => jest.restoreAllMocks());

  it('leaves straight away when nothing changed', async () => {
    const spy = alert();
    await renderApp('/workouts');
    await fireEvent.press(await screen.findByRole('button', { name: en.workouts.new }));
    await screen.findByRole('header', { name: editor.newTitle });

    await fireEvent.press(screen.getByRole('button', { name: en.common.back }));

    await screen.findByRole('button', { name: en.workouts.new });
    expect(spy).not.toHaveBeenCalled();
  });

  it('asks before discarding changes: "Keep editing" stays, "Discard" leaves without saving', async () => {
    const spy = alert();
    await openPicker();
    await pickAndAdd(['Barbell Bench Press']);
    await fireEvent.changeText(screen.getByLabelText(editor.name), 'Push A');

    await fireEvent.press(screen.getByRole('button', { name: en.common.back }));

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0]?.slice(0, 2)).toEqual([editor.discardTitle, editor.discardBody]);
    expect((spy.mock.calls[0]?.[2] as AlertButton[]).map((b) => [b.text, b.style])).toEqual([
      [editor.keepEditing, 'cancel'],
      [editor.discard, 'destructive'],
    ]);

    // Keep editing: still in the editor, with the changes.
    await answer(spy, editor.keepEditing);
    expect(screen.getByRole('header', { name: editor.newTitle })).toBeOnTheScreen();
    expect(screen.getByLabelText(editor.name)).toHaveDisplayValue('Push A');

    // Discard: leaves, and nothing was saved.
    await fireEvent.press(screen.getByRole('button', { name: en.common.back }));
    expect(spy).toHaveBeenCalledTimes(2);
    await answer(spy, editor.discard);

    await screen.findByText(en.workouts.emptyTitle);
    expect(savedPayloads()).toHaveLength(0);
    expect(serverRows('workout_templates')).toHaveLength(0);
  });

  it('a change undone counts as no change; editing a saved workout asks only when it differs', async () => {
    const spy = alert();
    await createTemplate(['Barbell Bench Press']);
    await openEditor('Push A');
    await screen.findByRole('header', { name: editor.editTitle });

    await fireEvent.press(screen.getByRole('button', { name: editor.moreSets }));
    await fireEvent.press(screen.getByRole('button', { name: editor.fewerSets }));
    await fireEvent.press(screen.getByRole('button', { name: en.common.back }));

    // Back on the saved workout's screen without a question.
    await screen.findByRole('button', { name: en.savedWorkout.edit });
    expect(spy).not.toHaveBeenCalled();
  });

  it('does not ask after saving', async () => {
    const spy = alert();
    await createTemplate(['Barbell Bench Press']);

    expect(await findCard('Push A')).toBeOnTheScreen();
    expect(spy).not.toHaveBeenCalled();
  });
});

describe('"+" → Gym', () => {
  it('lists the saved workouts and "Empty workout"; choosing one opens the session', async () => {
    await createTemplate(['Barbell Bench Press']);

    await fireEvent.press(screen.getByRole('button', { name: en.nav.start }));
    await fireEvent.press(await screen.findByRole('radio', { name: en.onboarding.sports.gym }));

    expect(
      await screen.findByRole('radio', { name: `Push A. ${en.workouts.exerciseCountOne}` }),
    ).toBeOnTheScreen();
    expect(
      screen.getByRole('radio', {
        name: `${en.session.emptyWorkout}. ${en.start.emptyWorkoutHint}`,
      }),
    ).toBeOnTheScreen();

    await fireEvent.press(
      screen.getByRole('radio', { name: `Push A. ${en.workouts.exerciseCountOne}` }),
    );
    // The session starts with the saved workout's exercise.
    expect(await screen.findByRole('header', { name: 'Push A' })).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: 'Barbell Bench Press' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: en.session.finish })).toBeOnTheScreen();
  });
});

// The exercise names of the editor's cards, in the order shown.
function savedOrderFromScreen(): string[] {
  const grid = screen.getByTestId('sortable-grid');
  return within(grid)
    .getAllByRole('header')
    .map((header) => String(header.props.children));
}
