import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';
import { act, fireEvent, screen, waitFor } from 'expo-router/testing-library';

import { en } from '@/core/i18n/en';
import { queryKeys } from '@/lib/data/query-keys';

import { currentQueryClient, renderApp, resetStorage } from '../../test-utils/render-app';
import { onboardedProfile, resetSupabaseMock, TEST_USER_ID } from '../../test-utils/supabase-mock';

jest.mock('@/lib/supabase/client', () => require('../../test-utils/supabase-mock').clientModule);

type Listener = (state: Partial<NetInfoState>) => void;
let netListeners: Listener[] = [];

beforeEach(async () => {
  netListeners = [];
  // Capture NetInfo's listeners so the test can switch the connection off and on.
  jest.mocked(NetInfo.addEventListener).mockImplementation((listener) => {
    netListeners.push(listener as Listener);
    return () => {
      netListeners = netListeners.filter((item) => item !== listener);
    };
  });
  resetSupabaseMock({ signedIn: true, profile: onboardedProfile() });
  await resetStorage();
});

async function setConnected(isConnected: boolean) {
  await act(async () => {
    netListeners.forEach((listener) => listener({ isConnected }));
  });
}

describe('"No connection" banner', () => {
  it('appears while the phone has no network and goes away when it is back', async () => {
    await renderApp('/');
    expect(screen.queryByLabelText(en.common.offline)).not.toBeOnTheScreen();

    await setConnected(false);
    expect(screen.getByLabelText(en.common.offline)).toBeOnTheScreen();

    await setConnected(true);
    expect(screen.queryByLabelText(en.common.offline)).not.toBeOnTheScreen();
  });

  it('also shows on the sign-in screen', async () => {
    resetSupabaseMock({ signedIn: false });
    await renderApp('/sign-in');

    await setConnected(false);

    expect(screen.getByLabelText(en.common.offline)).toBeOnTheScreen();
  });
});

describe('signing out', () => {
  it("clears every cached answer, so the next account never sees this one's data", async () => {
    await renderApp('/profile');
    await waitFor(() =>
      expect(currentQueryClient().getQueryData(queryKeys.profile(TEST_USER_ID))).toBeDefined(),
    );

    await fireEvent.press(screen.getByRole('button', { name: en.profile.signOut }));

    expect(screen).toHavePathname('/sign-in');
    expect(currentQueryClient().getQueryData(queryKeys.profile(TEST_USER_ID))).toBeUndefined();
    expect(
      currentQueryClient()
        .getQueryCache()
        .findAll({ queryKey: queryKeys.user(TEST_USER_ID) }),
    ).toHaveLength(0);
  });
});
