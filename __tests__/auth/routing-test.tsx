import { fireEvent, screen, waitFor } from 'expo-router/testing-library';

import { en } from '@/core/i18n/en';

import { renderApp, resetStorage } from '../../test-utils/render-app';
import {
  goOffline,
  onboardedProfile,
  profileRow,
  resetSupabaseMock,
  supabaseMock,
} from '../../test-utils/supabase-mock';

jest.mock('@/lib/supabase/client', () => require('../../test-utils/supabase-mock').clientModule);

describe('route protection', () => {
  it('shows the intro to a signed-out user the first time', async () => {
    resetSupabaseMock({ signedIn: false });
    await resetStorage({ introSeen: false });
    await renderApp('/');

    expect(screen).toHavePathname('/welcome');
  });

  it('opens on the email screen once the intro was seen', async () => {
    resetSupabaseMock({ signedIn: false });
    await resetStorage({ introSeen: true });
    await renderApp('/');

    expect(screen).toHavePathname('/sign-in');
    expect(screen.getByRole('header', { name: en.auth.emailTitle })).toBeOnTheScreen();
    // The logo, for screen readers too.
    expect(screen.getByRole('image', { name: 'Treker' })).toBeOnTheScreen();
  });

  it('sends a signed-in user without onboarding to the questionnaire', async () => {
    resetSupabaseMock({ signedIn: true, profile: profileRow() });
    await resetStorage();
    await renderApp('/');

    expect(screen).toHavePathname('/onboarding');
  });

  it('sends an onboarded user to the app, on the Today tab', async () => {
    resetSupabaseMock({ signedIn: true, profile: onboardedProfile() });
    await resetStorage();
    await renderApp('/sign-in');

    expect(screen).toHavePathname('/');
    expect(screen.getByRole('header', { name: 'Hi, Ana' })).toBeOnTheScreen();
  });

  it('signs out a stored session whose account no longer exists, instead of opening the app', async () => {
    // A valid token on the phone, but the server has no profile for it (the account was deleted
    // elsewhere, or the local database was reset).
    resetSupabaseMock({ signedIn: true, profile: null });
    await resetStorage({ introSeen: true });
    await renderApp('/');

    await waitFor(() => expect(screen).toHavePathname('/sign-in'));
    expect(supabaseMock.auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
    expect(screen.queryByRole('button', { name: en.nav.openMenu })).not.toBeOnTheScreen();
  });

  it('can always sign out from Profile, even when the profile could not be loaded', async () => {
    resetSupabaseMock({ signedIn: true, profile: onboardedProfile() });
    await resetStorage();
    goOffline();
    await renderApp('/profile');

    // Offline the athlete still gets in, and Profile still offers signing out.
    await fireEvent.press(await screen.findByRole('button', { name: en.profile.signOut }));

    await waitFor(() => expect(screen).toHavePathname('/sign-in'));
    expect(supabaseMock.auth.signOut).toHaveBeenCalled();
  });

  it('signing out opens the email screen, not the intro', async () => {
    resetSupabaseMock({ signedIn: true, profile: onboardedProfile() });
    await resetStorage({ introSeen: true });
    await renderApp('/profile');

    await fireEvent.press(screen.getByRole('button', { name: en.profile.signOut }));

    expect(supabaseMock.auth.signOut).toHaveBeenCalled();
    expect(screen).toHavePathname('/sign-in');
  });
});

describe('sign-in flow', () => {
  it('a correct code takes a new user to the questionnaire', async () => {
    resetSupabaseMock({ signedIn: false, profile: profileRow() });
    await resetStorage();
    await renderApp('/sign-in');

    await fireEvent.changeText(screen.getByLabelText(en.auth.emailLabel), 'Ana@Example.com');
    await fireEvent.press(screen.getByRole('button', { name: en.auth.sendCode }));

    expect(supabaseMock.auth.signInWithOtp).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'ana@example.com' }),
    );
    expect(screen).toHavePathname('/verify');

    // Typing the 6th digit submits the code.
    await fireEvent.changeText(screen.getByLabelText(en.auth.codeLabel), '123456');

    expect(supabaseMock.auth.verifyOtp).toHaveBeenCalledWith({
      email: 'ana@example.com',
      token: '123456',
      type: 'email',
    });
    expect(screen).toHavePathname('/onboarding');
    expect(screen.getByRole('header', { name: en.onboarding.name.title })).toBeOnTheScreen();
  });

  it('a correct code takes an onboarded user straight to the app', async () => {
    resetSupabaseMock({ signedIn: false, profile: onboardedProfile() });
    await resetStorage();
    await renderApp('/verify?email=ana%40example.com');

    await fireEvent.changeText(screen.getByLabelText(en.auth.codeLabel), '123456');

    expect(screen).toHavePathname('/');
  });
});
