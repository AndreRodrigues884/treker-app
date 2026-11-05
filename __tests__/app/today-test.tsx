import { act, fireEvent, screen } from 'expo-router/testing-library';

import { addDays, localDateOf, weekRange } from '@/core/dates';
import { en } from '@/core/i18n/en';
import { deleteActivity, startActivity } from '@/features/activities/repository';
import { getDeviceTimezone } from '@/lib/device';
import { openLocalStore, waitingEntries } from '@/lib/local-db';

import { renderApp, resetStorage } from '../../test-utils/render-app';
import { onboardedProfile, resetSupabaseMock, TEST_USER_ID } from '../../test-utils/supabase-mock';

jest.mock('@/lib/supabase/client', () => require('../../test-utils/supabase-mock').clientModule);

const progress = (done: number, target: number) =>
  en.today.weeklyProgress.replace('{done}', String(done)).replace('{target}', String(target));

async function setUp() {
  resetSupabaseMock({ signedIn: true, profile: onboardedProfile({ weekly_target: 3 }) });
  await resetStorage();
  const store = openLocalStore(TEST_USER_ID);
  const timezone = getDeviceTimezone();
  const today = localDateOf(new Date(), timezone);
  const { start } = weekRange(today);
  return { store, timezone, today, start };
}

describe('Today: workouts this week', () => {
  it("counts this week's workouts from the local database, without deleted ones", async () => {
    const { store, timezone, today, start } = await setUp();
    startActivity(store, { type: 'gym', timezone, localDate: today });
    startActivity(store, { type: 'swim', timezone, localDate: start });
    // Last week, and a deleted one this week: not counted.
    startActivity(store, { type: 'gym', timezone, localDate: addDays(start, -1) });
    const deleted = startActivity(store, { type: 'gym', timezone, localDate: today });
    deleteActivity(store, deleted.id);

    await renderApp('/');

    expect(screen.getAllByText(progress(2, 3)).length).toBeGreaterThan(0);
  });

  it('updates by itself when a workout is added', async () => {
    const { store, timezone, today } = await setUp();
    await renderApp('/');
    expect(screen.getAllByText(progress(0, 3)).length).toBeGreaterThan(0);

    await act(async () => {
      startActivity(store, { type: 'gym', timezone, localDate: today });
    });

    expect(screen.getAllByText(progress(1, 3)).length).toBeGreaterThan(0);
  });
});

describe('dev screen: local database', () => {
  it('shows rows per table and the outbox, and creates a test workout', async () => {
    const { store } = await setUp();
    await renderApp('/dev/local-db');

    expect(screen.getByLabelText('activities: 0')).toBeOnTheScreen();
    expect(screen.getByText('Nothing waiting to be sent.')).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Create test workout (3 sets)' }));

    expect(screen.getByLabelText('activities: 1')).toBeOnTheScreen();
    expect(screen.getByLabelText('gym_sets: 3')).toBeOnTheScreen();
    // Exercise, activity and 3 sets, in sending order.
    expect(waitingEntries(store.db).map((e) => e.table_name)).toEqual([
      'exercises',
      'activities',
      'gym_sets',
      'gym_sets',
      'gym_sets',
    ]);
    expect(screen.getByText('Outbox: 5 waiting')).toBeOnTheScreen();
  });

  it('deletes the local database and downloads the profile again', async () => {
    const { store, timezone, today } = await setUp();
    startActivity(store, { type: 'gym', timezone, localDate: today });
    await renderApp('/dev/local-db');
    expect(screen.getByLabelText('activities: 1')).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Delete local database' }));

    expect(screen.getByLabelText('activities: 0')).toBeOnTheScreen();
    expect(screen.getByLabelText('profiles: 1')).toBeOnTheScreen();
  });
});
