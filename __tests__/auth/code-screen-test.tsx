import { act, fireEvent, screen } from 'expo-router/testing-library';

import { interpolate } from '@/core/i18n';
import { en } from '@/core/i18n/en';

import { renderApp } from '../../test-utils/render-app';
import { resetSupabaseMock, supabaseMock } from '../../test-utils/supabase-mock';

jest.mock('@/lib/supabase/client', () => require('../../test-utils/supabase-mock').clientModule);

const otpError = {
  error: {
    name: 'AuthApiError',
    status: 403,
    code: 'otp_expired',
    message: 'Token has expired or is invalid',
  },
  data: { session: null, user: null },
};

async function openCodeScreen() {
  await renderApp(`/verify?email=ana%40example.com&sentAt=${Date.now()}`);
}

beforeEach(() => {
  resetSupabaseMock({ signedIn: false });
});

describe('code screen', () => {
  it('shows the email the code was sent to', async () => {
    await openCodeScreen();

    expect(
      screen.getByText(interpolate(en.auth.codeSubtitle, { email: 'ana@example.com' })),
    ).toBeOnTheScreen();
  });

  it('shows a translated error for a wrong code and stays on the screen', async () => {
    supabaseMock.auth.verifyOtp.mockResolvedValueOnce(otpError as never);
    await openCodeScreen();

    await fireEvent.changeText(screen.getByLabelText(en.auth.codeLabel), '000000');

    expect(screen.getByRole('alert')).toHaveTextContent(en.auth.errors.wrongCode);
    expect(screen).toHavePathname('/verify');
  });

  it('asks for 6 digits before calling Supabase', async () => {
    await openCodeScreen();

    await fireEvent.changeText(screen.getByLabelText(en.auth.codeLabel), '123');
    await fireEvent.press(screen.getByRole('button', { name: en.auth.verify }));

    expect(screen.getByRole('alert')).toHaveTextContent(en.auth.errors.invalidCodeFormat);
    expect(supabaseMock.auth.verifyOtp).not.toHaveBeenCalled();
  });

  it('shows a translated error when there is no connection', async () => {
    supabaseMock.auth.verifyOtp.mockResolvedValueOnce({
      error: { name: 'AuthRetryableFetchError', status: 0, message: 'Network request failed' },
      data: { session: null, user: null },
    } as never);
    await openCodeScreen();

    await fireEvent.changeText(screen.getByLabelText(en.auth.codeLabel), '123456');

    expect(screen.getByRole('alert')).toHaveTextContent(en.auth.errors.network);
  });
});

describe('resending the code', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('is blocked for 60 seconds, then sends a new code', async () => {
    await openCodeScreen();

    const waiting = screen.getByRole('button', {
      name: interpolate(en.auth.resendIn, { seconds: 60 }),
    });
    expect(waiting).toBeDisabled();
    await fireEvent.press(waiting);
    expect(supabaseMock.auth.signInWithOtp).not.toHaveBeenCalled();

    await act(async () => {
      jest.advanceTimersByTime(30_000);
    });
    expect(
      screen.getByRole('button', { name: interpolate(en.auth.resendIn, { seconds: 30 }) }),
    ).toBeDisabled();

    await act(async () => {
      jest.advanceTimersByTime(30_000);
    });
    const resend = screen.getByRole('button', { name: en.auth.resend });
    expect(resend).toBeEnabled();

    await fireEvent.press(resend);

    expect(supabaseMock.auth.signInWithOtp).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'ana@example.com' }),
    );
    expect(screen.getByText(en.auth.codeResent)).toBeOnTheScreen();
    // The wait starts again.
    expect(
      screen.getByRole('button', { name: interpolate(en.auth.resendIn, { seconds: 60 }) }),
    ).toBeDisabled();
  });
});

describe('email screen', () => {
  it('rejects an invalid email without calling Supabase', async () => {
    await renderApp('/sign-in');

    await fireEvent.changeText(screen.getByLabelText(en.auth.emailLabel), 'ana@');
    await fireEvent.press(screen.getByRole('button', { name: en.auth.sendCode }));

    expect(screen.getByRole('alert')).toHaveTextContent(en.auth.errors.invalidEmail);
    expect(supabaseMock.auth.signInWithOtp).not.toHaveBeenCalled();
  });

  it('shows a translated error when too many codes were requested', async () => {
    supabaseMock.auth.signInWithOtp.mockResolvedValueOnce({
      error: { name: 'AuthApiError', status: 429, code: 'over_email_send_rate_limit' },
      data: {},
    } as never);
    await renderApp('/sign-in');

    await fireEvent.changeText(screen.getByLabelText(en.auth.emailLabel), 'ana@example.com');
    await fireEvent.press(screen.getByRole('button', { name: en.auth.sendCode }));

    expect(screen.getByRole('alert')).toHaveTextContent(en.auth.errors.tooManyAttempts);
    expect(screen).toHavePathname('/sign-in');
  });
});
