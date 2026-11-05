import { QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react-native';
import { fireEvent, screen } from 'expo-router/testing-library';
import type { ReactNode } from 'react';

import { addDays, localDateOf, weekRange } from '@/core/dates';
import { en } from '@/core/i18n/en';
import { useTrainingMutation, useWorkoutsThisWeek } from '@/features/activities/queries';
import { startActivity } from '@/features/activities/repository';
import { AuthProvider, useAuth } from '@/features/auth/auth-provider';
import { createQueryClient } from '@/lib/data/query-client';
import { getDeviceTimezone } from '@/lib/device';

import { currentQueryClient, renderApp, resetStorage } from '../../test-utils/render-app';
import {
  goOffline,
  onboardedProfile,
  resetSupabaseMock,
  serverRows,
  TEST_USER_ID,
} from '../../test-utils/supabase-mock';

jest.mock('@/lib/supabase/client', () => require('../../test-utils/supabase-mock').clientModule);

const progress = (done: number, target: number) =>
  en.today.weeklyProgress.replace('{done}', String(done)).replace('{target}', String(target));

function thisWeek() {
  const today = localDateOf(new Date(), getDeviceTimezone());
  return { today, ...weekRange(today) };
}

function serverActivity(localDate: string, overrides: Record<string, unknown> = {}) {
  serverRows('activities').push({
    id: `activity-${serverRows('activities').length}`,
    user_id: TEST_USER_ID,
    type: 'gym',
    local_date: localDate,
    deleted_at: null,
    ...overrides,
  });
}

beforeEach(async () => {
  resetSupabaseMock({ signedIn: true, profile: onboardedProfile({ weekly_target: 3 }) });
  await resetStorage();
});

describe('Today: workouts this week', () => {
  it("counts the athlete's workouts this week, without deleted ones or other weeks", async () => {
    const { today, start } = thisWeek();
    serverActivity(today);
    serverActivity(start, { type: 'swim' });
    serverActivity(addDays(start, -1));
    serverActivity(today, { deleted_at: '2026-11-01T10:00:00Z' });
    serverActivity(today, { user_id: 'bbbbbbbb-0000-0000-0000-000000000000' });

    await renderApp('/');

    await waitFor(() => expect(screen.getAllByText(progress(2, 3)).length).toBeGreaterThan(0));
  });

  it('shows a translated error with "Try again" when the count cannot be loaded', async () => {
    await renderApp('/');
    // The profile loaded; the count fails, then works again.
    goOffline();
    await currentQueryClient().refetchQueries();

    await waitFor(() => expect(screen.getByText(en.common.errors.network)).toBeOnTheScreen());

    goOffline(false);
    serverActivity(thisWeek().today);
    await fireEvent.press(screen.getByRole('button', { name: en.common.retry }));

    await waitFor(() => expect(screen.getAllByText(progress(1, 3)).length).toBeGreaterThan(0));
  });
});

describe('saving a workout refreshes Today', () => {
  it('a training write invalidates the weekly count', async () => {
    const queryClient = createQueryClient({ retry: false });
    // Like the app, the data hooks only run once someone is signed in.
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
      () => ({ count: useWorkoutsThisWeek(), start: useTrainingMutation(startActivity) }),
      { wrapper },
    );
    await waitFor(() => expect(result.current?.count.data).toBe(0));

    await result.current.start.mutateAsync({ type: 'gym', timezone: getDeviceTimezone() });

    await waitFor(() => expect(result.current.count.data).toBe(1));
  });
});
