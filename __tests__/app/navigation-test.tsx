import { fireEvent, screen, waitFor } from 'expo-router/testing-library';

import { en } from '@/core/i18n/en';

import { renderApp, resetStorage } from '../../test-utils/render-app';
import {
  delayProfileReads,
  onboardedProfile,
  profileRow,
  resetSupabaseMock,
} from '../../test-utils/supabase-mock';

jest.mock('@/lib/supabase/client', () => require('../../test-utils/supabase-mock').clientModule);

const nav = en.nav;
const MAIN_SCREENS = [
  ['/', nav.today],
  ['/workouts', nav.workouts],
  ['/calendar', nav.calendar],
  ['/records', nav.records],
  ['/profile', nav.profile],
] as const;

async function openApp(path = '/', profile = onboardedProfile()) {
  resetSupabaseMock({ signedIn: true, profile });
  await resetStorage();
  await renderApp(path);
}

const menuItem = (label: string) => screen.getByRole('button', { name: label });

describe('side menu', () => {
  it('lists the five screens in order with the logo, name, weekly goal and version', async () => {
    await openApp('/', onboardedProfile({ weekly_target: 4 }));

    await fireEvent.press(screen.getByRole('button', { name: nav.openMenu }));

    for (const [, label] of MAIN_SCREENS) {
      expect(menuItem(label)).toBeOnTheScreen();
    }
    // Today, Workouts, Calendar, Records, Profile.
    const buttons = screen.getAllByRole('button');
    const positions = MAIN_SCREENS.map(([, label]) => buttons.indexOf(menuItem(label)));
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
    expect(screen.getByRole('header', { name: 'Treker' })).toBeOnTheScreen();
    expect(screen.getByText('Ana')).toBeOnTheScreen();
    // Once on Today, once in the menu.
    expect(screen.getAllByText('0 of 4 workouts this week')).toHaveLength(2);
    expect(screen.getByText(/^Version /)).toBeOnTheScreen();
  });

  it('highlights the current screen and moves to the one chosen', async () => {
    await openApp();

    expect(menuItem(nav.today)).toBeSelected();
    expect(menuItem(nav.calendar)).not.toBeSelected();

    await fireEvent.press(menuItem(nav.calendar));

    expect(screen).toHavePathname('/calendar');
    expect(screen.getByText(en.calendar.emptyTitle)).toBeOnTheScreen();
    expect(menuItem(nav.calendar)).toBeSelected();
    expect(menuItem(nav.today)).not.toBeSelected();
  });

  it.each(MAIN_SCREENS)('%s has the menu button and the start button', async (path) => {
    await openApp(path);

    expect(screen).toHavePathname(path);
    expect(screen.getByRole('button', { name: nav.openMenu })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: nav.start })).toBeOnTheScreen();
  });
});

describe('start button', () => {
  it('opens /start with only the sports chosen in onboarding', async () => {
    await openApp('/records', onboardedProfile({ sports: ['gym'] }));

    await fireEvent.press(screen.getByRole('button', { name: nav.start }));

    expect(screen).toHavePathname('/start');
    expect(screen.getByRole('radio', { name: en.onboarding.sports.gym })).toBeOnTheScreen();
    expect(screen.queryByRole('radio', { name: en.onboarding.sports.swim })).not.toBeOnTheScreen();
  });

  it('offers both sports to someone who trains both', async () => {
    await openApp(
      '/',
      onboardedProfile({
        sports: ['gym', 'swim'],
        swim_style: 'competitive',
        default_pool_length: '25m',
      }),
    );

    await fireEvent.press(screen.getByRole('button', { name: nav.start }));

    expect(screen.getByRole('radio', { name: en.onboarding.sports.gym })).toBeOnTheScreen();
    expect(screen.getByRole('radio', { name: en.onboarding.sports.swim })).toBeOnTheScreen();
  });
});

describe('signing in while the profile is still loading', () => {
  // Regression for "ROUTE_NAMES_CHANGED ... was not handled": the app screens used to mount for a
  // moment between the session and the profile arriving, then unmount for users who still need
  // onboarding.
  it('never mounts the app for a user who still needs onboarding', async () => {
    resetSupabaseMock({ signedIn: false, profile: profileRow() });
    delayProfileReads(50);
    await resetStorage();
    await renderApp('/verify?email=ana%40example.com');

    await fireEvent.changeText(screen.getByLabelText(en.auth.codeLabel), '123456');

    // Still on the code screen while the profile loads.
    expect(screen).toHavePathname('/verify');
    expect(screen.queryByRole('button', { name: nav.openMenu })).not.toBeOnTheScreen();

    await waitFor(() => expect(screen).toHavePathname('/onboarding'));
    expect(screen.queryByRole('button', { name: nav.openMenu })).not.toBeOnTheScreen();
  });
});
