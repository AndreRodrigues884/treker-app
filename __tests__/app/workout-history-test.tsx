// Phase 1 (6b): the workouts in the Profile, page by page, and the read-only workout screen.
import { QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react-native';
import { fireEvent, screen, within } from 'expo-router/testing-library';
import type { ReactNode } from 'react';

import { localDateOf } from '@/core/dates';
import { formatLocalDate } from '@/core/format';
import { en } from '@/core/i18n/en';
import {
  SUMMARY_PAGE_SIZE,
  useActivitySummaries,
  useTrainingMutation,
} from '@/features/activities/queries';
import { finishActivity, startActivity } from '@/features/activities/repository';
import { AuthProvider, useAuth } from '@/features/auth/auth-provider';
import { addSet } from '@/features/gym/repository';
import { createQueryClient } from '@/lib/data/query-client';
import { getDeviceTimezone } from '@/lib/device';

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

const w = en.workout;
const today = localDateOf(new Date(), getDeviceTimezone());
const dateText = (date: string) => formatLocalDate(date, 'en', today);
// Text with non-breaking spaces (numbers and units) as a screen reader gets it.
const plain = (text: string) => text.replace(/ /g, ' ');

function activity(id: string, overrides: Record<string, unknown> = {}) {
  serverRows('activities').push({
    id,
    user_id: TEST_USER_ID,
    type: 'gym',
    title: null,
    local_date: '2026-11-02',
    started_at: null,
    ended_at: null,
    deleted_at: null,
    ...overrides,
  });
}

function set(id: string, activityId: string, overrides: Record<string, unknown> = {}) {
  serverRows('gym_sets').push({
    id,
    user_id: TEST_USER_ID,
    activity_id: activityId,
    exercise_id: 'bench',
    exercise_position: 0,
    set_number: 1,
    weight_kg: 100,
    reps: 5,
    duration_s: null,
    rpe: null,
    is_warmup: false,
    deleted_at: null,
    ...overrides,
  });
}

// A gym session of 1 h 15 min (a warm-up, two work sets, the second a record) and a swim.
function seedTwoWorkouts() {
  activity('push', {
    title: 'Push A',
    local_date: '2026-11-05',
    started_at: '2026-11-05T10:00:00Z',
    ended_at: '2026-11-05T11:15:00Z',
  });
  set('warm', 'push', { set_number: 1, weight_kg: 60, is_warmup: true });
  set('s1', 'push', { set_number: 2 });
  set('s2', 'push', { set_number: 3 });
  set('press1', 'push', { exercise_id: 'press', exercise_position: 1, weight_kg: 50, reps: 8 });
  serverRows('personal_records').push({
    id: 'pr1',
    user_id: TEST_USER_ID,
    type: 'gym',
    activity_id: 'push',
    gym_set_id: 's2',
    swim_entry_id: null,
    exercise_id: 'bench',
    stroke: null,
    distance: null,
    pool_length: null,
    value: 116.67,
    local_date: '2026-11-05',
  });

  activity('swim', { type: 'swim', local_date: '2026-11-03' });
  serverRows('swim_entries').push(
    {
      id: 'e1',
      user_id: TEST_USER_ID,
      activity_id: 'swim',
      position: 0,
      stroke: 'free',
      distance: 50,
      pool_length: '25m',
      time_cs: 2900,
      kind: 'race',
      deleted_at: null,
    },
    {
      id: 'e2',
      user_id: TEST_USER_ID,
      activity_id: 'swim',
      position: 1,
      stroke: 'back',
      distance: 100,
      pool_length: '25yd',
      time_cs: 7000,
      kind: 'training',
      deleted_at: null,
    },
  );
  serverRows('personal_records').push({
    id: 'pr2',
    user_id: TEST_USER_ID,
    type: 'swim',
    activity_id: 'swim',
    gym_set_id: null,
    swim_entry_id: 'e1',
    exercise_id: null,
    stroke: 'free',
    distance: 50,
    pool_length: '25m',
    value: 2900,
    local_date: '2026-11-03',
  });
}

const row = (title: string) =>
  screen.getByRole('button', { name: new RegExp(`^${w.open.replace('{title}', title)}, `) });

beforeEach(async () => {
  resetSupabaseMock({ signedIn: true, profile: onboardedProfile() });
  seedLibraryExercises([
    { id: 'bench', name_en: 'Barbell Bench Press', name_pt: 'Supino plano com barra' },
    { id: 'press', name_en: 'Overhead Press', name_pt: 'Desenvolvimento militar' },
  ]);
  await resetStorage();
});

describe('workouts in the Profile', () => {
  it('shows the title, date, duration, sets and volume (or distance) of each, newest first', async () => {
    seedTwoWorkouts();
    await renderApp('/profile');

    const push = await screen.findByRole('button', {
      name: new RegExp(`^${w.open.replace('{title}', 'Push A')}`),
    });
    expect(plain(push.props.accessibilityLabel as string)).toBe(
      `Open Push A, ${dateText('2026-11-05')} · 1 h 15 min, 3 sets · 1,400 kg`,
    );
    const swim = row('Swimming');
    expect(plain(swim.props.accessibilityLabel as string)).toBe(
      `Open Swimming, ${dateText('2026-11-03')}, 2 times · 141 m`,
    );
    // Every workout row ("Open <title>, …"), not the menu button.
    const rows = screen.getAllByRole('button', { name: /^Open [^,]+, / });
    expect(rows).toHaveLength(2);
    expect(rows.indexOf(push)).toBeLessThan(rows.indexOf(swim));
  });

  it('lists two workouts on the same day by start time, the latest first', async () => {
    // Ids in the opposite order of the start times.
    activity('a-evening', {
      title: 'Evening',
      local_date: '2026-11-04',
      started_at: '2026-11-04T18:00:00Z',
    });
    activity('z-morning', {
      title: 'Morning',
      local_date: '2026-11-04',
      started_at: '2026-11-04T07:30:00Z',
    });
    await renderApp('/profile');

    const evening = await screen.findByRole('button', { name: /^Open Evening, / });
    const morning = screen.getByRole('button', { name: /^Open Morning, / });
    const rows = screen.getAllByRole('button', { name: /^Open [^,]+, / });
    expect(rows.indexOf(evening)).toBeLessThan(rows.indexOf(morning));
  });

  it('loads one page at a time by cursor, never the whole history', async () => {
    for (let day = 1; day <= SUMMARY_PAGE_SIZE + 2; day += 1) {
      activity(`a${String(day).padStart(2, '0')}`, {
        title: `Day ${day}`,
        local_date: `2026-10-${String(day).padStart(2, '0')}`,
      });
    }
    await renderApp('/profile');

    await screen.findByRole('button', { name: /^Open Day 12, / });
    expect(screen.getAllByRole('button', { name: /^Open Day / })).toHaveLength(SUMMARY_PAGE_SIZE);
    expect(screen.queryByRole('button', { name: /^Open Day 2, / })).not.toBeOnTheScreen();
    expect(supabaseMock.rpc).toHaveBeenCalledWith('list_activity_summaries', {
      p_limit: SUMMARY_PAGE_SIZE,
    });

    await fireEvent.press(screen.getByRole('button', { name: w.showMore }));

    await screen.findByRole('button', { name: /^Open Day 1, / });
    expect(screen.getAllByRole('button', { name: /^Open Day / })).toHaveLength(12);
    // The second page starts after the last row of the first (day 3).
    expect(supabaseMock.rpc).toHaveBeenLastCalledWith('list_activity_summaries', {
      p_limit: SUMMARY_PAGE_SIZE,
      p_before_date: '2026-10-03',
      p_before_id: 'a03',
    });
    // A short page: nothing more to load.
    expect(screen.queryByRole('button', { name: w.showMore })).not.toBeOnTheScreen();
  });

  it('saving training refreshes the list (the query is invalidated)', async () => {
    const queryClient = createQueryClient({ retry: false });
    function SignedIn({ children }: { children: ReactNode }) {
      return useAuth().data ? children : null;
    }
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <SignedIn>{children}</SignedIn>
        </AuthProvider>
      </QueryClientProvider>
    );
    const { result } = await renderHook(
      () => ({
        list: useActivitySummaries(),
        start: useTrainingMutation(startActivity),
        add: useTrainingMutation(addSet),
        finish: useTrainingMutation(finishActivity),
      }),
      { wrapper },
    );
    await waitFor(() => expect(result.current?.list.data?.pages.flat()).toEqual([]));

    const started = await result.current.start.mutateAsync({
      type: 'gym',
      timezone: getDeviceTimezone(),
    });
    await result.current.add.mutateAsync({
      activityId: started.id,
      exerciseId: 'bench',
      exercisePosition: 0,
      setNumber: 1,
      weightKg: 100,
      reps: 5,
    });

    await waitFor(() =>
      expect(result.current.list.data?.pages.flat()).toEqual([
        expect.objectContaining({ id: started.id, setCount: 1, volumeKg: 500 }),
      ]),
    );
  });
});

describe('the workout screen (read only)', () => {
  it('shows the totals, the exercises with their sets, and the records', async () => {
    seedTwoWorkouts();
    await renderApp('/profile');
    await fireEvent.press(
      await screen.findByRole('button', {
        name: new RegExp(`^${w.open.replace('{title}', 'Push A')}`),
      }),
    );

    expect(await screen.findByRole('header', { name: 'Push A' })).toBeOnTheScreen();
    expect(screen).toHavePathname('/activities/push');
    expect(
      screen.getByLabelText(`${w.duration}: 1 h 15 min`.replace(/ (?=min|h\b)/g, ' ')),
    ).toBeOnTheScreen();
    expect(screen.getByLabelText(`${w.sets}: 3`)).toBeOnTheScreen();
    expect(screen.getByLabelText(`${w.volume}: 1,400 kg`)).toBeOnTheScreen();

    // Exercises in order, sets in order, the warm-up and the record marked.
    // Once as an exercise, once in the records.
    expect(screen.getAllByText('Barbell Bench Press')).toHaveLength(2);
    expect(screen.getByText('Overhead Press')).toBeOnTheScreen();
    expect(screen.getByLabelText(`Set 1, 60 kg × 5, ${w.warmup}`)).toBeOnTheScreen();
    expect(screen.getByLabelText('Set 2, 100 kg × 5')).toBeOnTheScreen();
    expect(screen.getByLabelText(`Set 3, 100 kg × 5, ${en.records.prLabel}`)).toBeOnTheScreen();

    // The records section.
    expect(
      screen.getByLabelText(
        `${en.records.prLabel}: Barbell Bench Press, ${w.oneRepMax.replace('{value}', '116.7 kg')}`,
      ),
    ).toBeOnTheScreen();
    // Read only: nothing to edit or delete yet.
    expect(screen.queryByRole('button', { name: /edit|delete/i })).not.toBeOnTheScreen();
  });

  it('shows the swim times with the record, and the distance in the athlete units', async () => {
    seedTwoWorkouts();
    await renderApp('/activities/swim');

    expect(
      await screen.findByRole('header', { name: en.onboarding.sports.swim }),
    ).toBeOnTheScreen();
    expect(screen.getByLabelText(`${w.times}: 2`)).toBeOnTheScreen();
    expect(screen.getByLabelText(`${w.distance}: 141 m`)).toBeOnTheScreen();
    expect(
      screen.getByLabelText(`50 m ${w.strokes.free} · 25 m, 29.00, ${en.records.prLabel}`),
    ).toBeOnTheScreen();
    expect(screen.getByLabelText(`100 yd ${w.strokes.back} · 25 yd, 1:10.00`)).toBeOnTheScreen();
    expect(
      within(screen.getByLabelText(new RegExp(`^${en.records.prLabel}: 50`))).getByText('29.00'),
    ).toBeOnTheScreen();
  });

  it('says so when the workout no longer exists', async () => {
    await renderApp('/activities/gone');
    expect(await screen.findByText(w.notFound)).toBeOnTheScreen();
  });
});
