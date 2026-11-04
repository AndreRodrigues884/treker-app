import { fireEvent, screen } from 'expo-router/testing-library';

import { en } from '@/core/i18n/en';

import { renderApp } from '../../test-utils/render-app';
import { profileRow, resetSupabaseMock, supabaseMock } from '../../test-utils/supabase-mock';

jest.mock('@/lib/supabase/client', () => require('../../test-utils/supabase-mock').clientModule);

describe('route protection', () => {
  it('sends a signed-out user to the email screen', async () => {
    resetSupabaseMock({ signedIn: false });
    await renderApp('/');

    expect(screen).toHavePathname('/sign-in');
    expect(screen.getByRole('header', { name: en.auth.emailTitle })).toBeOnTheScreen();
  });

  it('sends a signed-in user without onboarding to onboarding', async () => {
    resetSupabaseMock({ signedIn: true, profile: profileRow() });
    await renderApp('/');

    expect(screen).toHavePathname('/onboarding');
  });

  it('sends an onboarded user to the app', async () => {
    resetSupabaseMock({
      signedIn: true,
      profile: profileRow({ display_name: 'Ana', onboarded_at: '2026-11-04T10:00:00Z' }),
    });
    await renderApp('/sign-in');

    expect(screen).toHavePathname('/');
    expect(screen.getByText('Hi, Ana')).toBeOnTheScreen();
  });
});

describe('sign-in flow', () => {
  it('a correct code takes a new user to onboarding, then to the app', async () => {
    resetSupabaseMock({ signedIn: false, profile: profileRow() });
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

    await fireEvent.changeText(screen.getByLabelText(en.onboarding.nameLabel), 'Ana');
    await fireEvent.press(screen.getByRole('button', { name: en.onboarding.continue }));

    expect(screen).toHavePathname('/');
    expect(screen.getByText('Hi, Ana')).toBeOnTheScreen();
  });

  it('a correct code takes an onboarded user straight to the app', async () => {
    resetSupabaseMock({
      signedIn: false,
      profile: profileRow({ display_name: 'Ana', onboarded_at: '2026-11-04T10:00:00Z' }),
    });
    await renderApp('/verify?email=ana%40example.com');

    await fireEvent.changeText(screen.getByLabelText(en.auth.codeLabel), '123456');

    expect(screen).toHavePathname('/');
  });

  it('signing out goes back to the email screen', async () => {
    resetSupabaseMock({
      signedIn: true,
      profile: profileRow({ display_name: 'Ana', onboarded_at: '2026-11-04T10:00:00Z' }),
    });
    await renderApp('/');

    await fireEvent.press(screen.getByRole('button', { name: en.home.signOut }));

    expect(supabaseMock.auth.signOut).toHaveBeenCalled();
    expect(screen).toHavePathname('/sign-in');
  });
});
