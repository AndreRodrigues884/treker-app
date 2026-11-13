// Phase 1c: editing and deleting saved workouts, the exercise screen and the records screen.
import { fireEvent, screen, waitFor, within } from 'expo-router/testing-library';

import { addDays, localDateOf } from '@/core/dates';
import { en } from '@/core/i18n/en';
import { resetEditStore } from '@/features/session/edit-store';
import { resetSessionStore } from '@/features/session/session-store';
import { getDeviceTimezone } from '@/lib/device';

import { renderApp, resetStorage } from '../../test-utils/render-app';
import {
  onboardedProfile,
  resetSupabaseMock,
  seedLibraryExercises,
  serverRows,
  supabaseMock,
} from '../../test-utils/supabase-mock';

jest.mock('@/lib/supabase/client', () => require('../../test-utils/supabase-mock').clientModule);

const today = localDateOf(new Date(), getDeviceTimezone());
const daysAgo = (days: number) => addDays(today, -days);
const recordText = (kg: string) => en.exercise.recordValue.replace('{value}', `${kg} kg`);

// A saved workout, through the (mock) save_gym_session, so records are rebuilt like on the server.
async function saveWorkout(
  id: string,
  localDate: string,
  sets: { exercise: string; weight: number; reps: number; difficulty?: string }[],
  title = id,
) {
  await supabaseMock.rpc('save_gym_session', {
    p_session: {
      id,
      local_date: localDate,
      timezone: 'UTC',
      started_at: `${localDate}T09:00:00.000Z`,
      ended_at: null,
      title,
      template_id: null,
      sets: sets.map((set, index) => ({
        id: `${id}-set-${index + 1}`,
        exercise_id: set.exercise,
        exercise_position: 0,
        set_number: index + 1,
        weight_kg: set.weight,
        reps: set.reps,
        duration_s: null,
        difficulty: set.difficulty ?? null,
        is_warmup: false,
      })),
    },
  });
  supabaseMock.rpc.mockClear();
}

beforeEach(async () => {
  resetSessionStore();
  resetEditStore();
  resetSupabaseMock({
    signedIn: true,
    profile: onboardedProfile({
      weekly_target: 3,
      sports: ['gym', 'swim'],
      swim_style: 'fitness',
      default_pool_length: '25m',
    }),
  });
  seedLibraryExercises([
    { id: 'bench', name_en: 'Barbell Bench Press', name_pt: 'Supino plano com barra' },
    { id: 'deadlift', name_en: 'Deadlift', name_pt: 'Peso morto', muscle_group: 'back' },
  ]);
  await resetStorage();
});

describe('records screen', () => {
  it('one record per exercise, the most recent first, the last 7 days highlighted, with search', async () => {
    await saveWorkout('old', daysAgo(30), [{ exercise: 'deadlift', weight: 150, reps: 5 }]);
    await saveWorkout('new', daysAgo(2), [{ exercise: 'bench', weight: 110, reps: 5 }]);
    await renderApp('/records');

    const bench = await screen.findByRole('button', { name: /^Barbell Bench Press, / });
    const deadlift = screen.getByRole('button', { name: /^Deadlift, / });
    const rows = screen.getAllByRole('button', { name: /^(Barbell Bench Press|Deadlift), / });
    expect(rows.indexOf(bench)).toBeLessThan(rows.indexOf(deadlift));
    expect(bench).toHaveAccessibleName(new RegExp(`${en.records.recentLabel}$`));
    expect(deadlift).not.toHaveAccessibleName(new RegExp(en.records.recentLabel));
    expect(within(bench).getByText(recordText('128.3'))).toBeOnTheScreen();
    expect(within(bench).getByText(new RegExp('^110\\skg × 5 · '))).toBeOnTheScreen();

    // Search without case.
    await fireEvent.changeText(screen.getByLabelText(en.records.search), 'DEAD');
    expect(screen.queryByRole('button', { name: /^Barbell Bench Press, / })).not.toBeOnTheScreen();
    expect(screen.getByRole('button', { name: /^Deadlift, / })).toBeOnTheScreen();
    await fireEvent.changeText(screen.getByLabelText(en.records.search), 'squat');
    expect(screen.getByText(en.records.noResults)).toBeOnTheScreen();
  });

  it('swimming has its own tab, empty for now', async () => {
    await renderApp('/records');
    await fireEvent.press(await screen.findByRole('togglebutton', { name: en.records.swim }));
    expect(screen.getByText(en.records.swimEmptyTitle)).toBeOnTheScreen();
  });
});

describe('editing a saved workout', () => {
  it('lowering a set that was a record changes the records screen', async () => {
    await saveWorkout('w1', daysAgo(20), [{ exercise: 'bench', weight: 100, reps: 5 }], 'W1');
    await saveWorkout('w2', daysAgo(10), [{ exercise: 'bench', weight: 110, reps: 5 }], 'W2');
    await renderApp('/records');
    expect(await screen.findByText(recordText('128.3'))).toBeOnTheScreen();

    // Menu → Profile → W2 → Edit.
    await fireEvent.press(screen.getByRole('button', { name: en.nav.openMenu }));
    await fireEvent.press(screen.getByRole('button', { name: en.nav.profile }));
    await fireEvent.press(await screen.findByRole('button', { name: /^Open W2, / }));
    await fireEvent.press(await screen.findByRole('button', { name: en.workout.edit }));
    await screen.findByRole('header', { name: en.editWorkout.title });

    // Set 1 to 90 kg, easy; save.
    await fireEvent.press(screen.getByRole('button', { name: /^Set 1, done/ }));
    await fireEvent.changeText(
      screen.getByLabelText(en.session.weight.replace('{unit}', 'kg')),
      '90',
    );
    await fireEvent.press(screen.getByRole('radio', { name: en.session.difficulty.easy }));
    await fireEvent.press(screen.getByRole('button', { name: en.session.ok }));
    await fireEvent.changeText(screen.getByLabelText(en.editWorkout.name), 'W2 (light)');
    await fireEvent.press(screen.getByRole('button', { name: en.editWorkout.save }));

    // Saved: back to where the workout was opened (the Profile), with the new title.
    expect(await screen.findByRole('button', { name: /^Open W2 \(light\), / })).toBeOnTheScreen();
    expect(screen).toHavePathname('/profile');
    expect(supabaseMock.rpc).toHaveBeenCalledWith('update_gym_session', {
      p_session: expect.objectContaining({
        id: 'w2',
        title: 'W2 (light)',
        sets: [expect.objectContaining({ id: 'w2-set-1', weight_kg: 90, difficulty: 'easy' })],
      }),
    });

    // Back to the records: the record is W1's 116.7 kg now.
    await fireEvent.press(screen.getByRole('button', { name: en.nav.openMenu }));
    await fireEvent.press(screen.getByRole('button', { name: en.nav.records }));
    expect(await screen.findByText(recordText('116.7'))).toBeOnTheScreen();
    expect(screen.queryByText(recordText('128.3'))).not.toBeOnTheScreen();
  });

  it('changes the date and start time, and asks for a valid date', async () => {
    await saveWorkout('w1', daysAgo(5), [{ exercise: 'bench', weight: 100, reps: 5 }], 'W1');
    await renderApp('/activities/edit/w1');
    await screen.findByRole('header', { name: en.editWorkout.title });

    await fireEvent.changeText(screen.getByLabelText(en.editWorkout.date), 'yesterday');
    await fireEvent.press(screen.getByRole('button', { name: en.editWorkout.save }));
    expect(screen.getByText(en.editWorkout.invalidDate)).toBeOnTheScreen();
    expect(supabaseMock.rpc).not.toHaveBeenCalledWith('update_gym_session', expect.anything());

    await fireEvent.changeText(screen.getByLabelText(en.editWorkout.date), daysAgo(6));
    await fireEvent.changeText(screen.getByLabelText(en.editWorkout.time), '18:30');
    await fireEvent.press(screen.getByRole('button', { name: en.editWorkout.save }));

    await waitFor(() =>
      expect(supabaseMock.rpc).toHaveBeenCalledWith('update_gym_session', {
        p_session: expect.objectContaining({
          local_date: daysAgo(6),
          started_at: `${daysAgo(6)}T18:30:00.000Z`,
        }),
      }),
    );
  });
});

describe('from the Profile', () => {
  it('saving changes goes back to the Profile, with the workout updated', async () => {
    await saveWorkout('w1', today, [{ exercise: 'bench', weight: 100, reps: 5 }], 'Push A');
    await renderApp('/profile');

    await fireEvent.press(await screen.findByRole('button', { name: /^Open Push A, / }));
    await fireEvent.press(await screen.findByRole('button', { name: en.workout.edit }));
    await fireEvent.changeText(await screen.findByLabelText(en.editWorkout.name), 'Push B');
    await fireEvent.press(screen.getByRole('button', { name: en.editWorkout.save }));

    expect(await screen.findByRole('button', { name: /^Open Push B, / })).toBeOnTheScreen();
    expect(screen).toHavePathname('/profile');
    expect(screen.queryByRole('button', { name: /^Open Push A, / })).not.toBeOnTheScreen();
  });
});

describe('deleting a saved workout', () => {
  it('after a confirmation, it leaves the Profile and Today', async () => {
    await saveWorkout('w1', today, [{ exercise: 'bench', weight: 100, reps: 5 }], 'Push A');
    await renderApp('/profile');

    await fireEvent.press(await screen.findByRole('button', { name: /^Open Push A, / }));
    await fireEvent.press(await screen.findByRole('button', { name: en.workout.delete }));
    expect(screen.getByText(en.workout.deleteBody)).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: en.workout.deleteConfirm }));

    // Back on the Profile, without it.
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: /^Open Push A, / })).not.toBeOnTheScreen(),
    );
    expect(screen).toHavePathname('/profile');
    expect(supabaseMock.rpc).toHaveBeenCalledWith('delete_activity', { p_activity_id: 'w1' });
    expect(serverRows('personal_records')).toEqual([]);

    // Today does not count it.
    await fireEvent.press(screen.getByRole('button', { name: en.nav.openMenu }));
    await fireEvent.press(screen.getByRole('button', { name: en.nav.today }));
    expect(await screen.findAllByText('0 of 3 workouts this week')).not.toHaveLength(0);
  });
});

describe('exercise screen', () => {
  it('the record, stats and charts', async () => {
    for (let week = 11; week >= 0; week -= 1) {
      await saveWorkout(
        `w${String(week).padStart(2, '0')}`,
        daysAgo(week * 7),
        [
          {
            exercise: 'bench',
            weight: 100 + (11 - week) * 2.5,
            reps: 5,
            difficulty: 'medium',
          },
        ],
        `Week ${week}`,
      );
    }
    await renderApp('/exercise/bench');

    // The record (the latest and heaviest: 127.5 x 5) and the stats.
    expect(await screen.findByRole('header', { name: 'Barbell Bench Press' })).toBeOnTheScreen();
    expect(await screen.findByText(recordText('148.8'))).toBeOnTheScreen();
    expect(screen.getByLabelText(`${en.exercise.sets}: 12`)).toBeOnTheScreen();

    // Charts are summed up for screen readers (3 months by default).
    expect(
      await screen.findByLabelText(
        /^Estimated 1RM went up from .* to 148\.8\skg, in the last 3 months\./,
      ),
    ).toBeOnTheScreen();
    expect(screen.getByLabelText(/^Volume per workout went up/)).toBeOnTheScreen();

    // No history list on this screen (removed): the workouts are in the Profile.
    expect(screen.queryByText(en.exercise.history)).not.toBeOnTheScreen();
  });

  it('is opened from the library and from a workout', async () => {
    await saveWorkout('w1', today, [{ exercise: 'bench', weight: 100, reps: 5 }], 'Push A');
    await renderApp('/exercises');
    await fireEvent.press(await screen.findByRole('button', { name: /^Barbell Bench Press, / }));
    expect(await screen.findByRole('header', { name: 'Barbell Bench Press' })).toBeOnTheScreen();
    expect(screen).toHavePathname('/exercise/bench');

    await renderApp('/activities/w1');
    await fireEvent.press(
      await screen.findByRole('button', {
        name: en.exercise.open.replace('{name}', 'Barbell Bench Press'),
      }),
    );
    expect(screen).toHavePathname('/exercise/bench');
  });
});
