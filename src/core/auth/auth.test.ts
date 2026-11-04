import {
  CODE_EXPIRY_SECONDS,
  classifySendCodeError,
  classifyVerifyError,
  normalizeCode,
  secondsUntilResend,
  validateCode,
  validateEmail,
} from './index';

describe('validateEmail', () => {
  it('accepts an email and normalizes it', () => {
    expect(validateEmail('  Ana.Silva@Example.COM ')).toEqual({
      ok: true,
      value: 'ana.silva@example.com',
    });
  });

  it.each(['', 'ana', 'ana@', '@example.com', 'ana @example.com'])('rejects %p', (input) => {
    expect(validateEmail(input)).toEqual({ ok: false, error: 'invalidEmail' });
  });
});

describe('validateCode', () => {
  it('accepts 6 digits', () => {
    expect(validateCode('012345')).toEqual({ ok: true, value: '012345' });
  });

  it('accepts pasted codes with spaces or dashes', () => {
    expect(validateCode(' 123 456 ')).toEqual({ ok: true, value: '123456' });
    expect(validateCode('123-456')).toEqual({ ok: true, value: '123456' });
  });

  it.each(['', '12345', 'abcdef', '12a45'])('rejects %p', (input) => {
    expect(validateCode(input)).toEqual({ ok: false, error: 'invalidCodeFormat' });
  });
});

describe('normalizeCode', () => {
  it('keeps at most 6 digits', () => {
    expect(normalizeCode('1234567')).toBe('123456');
  });
});

describe('secondsUntilResend', () => {
  const sentAt = 1_000_000;

  it('waits 60 seconds after sending', () => {
    expect(secondsUntilResend(sentAt, sentAt)).toBe(60);
    expect(secondsUntilResend(sentAt, sentAt + 500)).toBe(60);
    expect(secondsUntilResend(sentAt, sentAt + 59_001)).toBe(1);
  });

  it('allows resending after 60 seconds', () => {
    expect(secondsUntilResend(sentAt, sentAt + 60_000)).toBe(0);
    expect(secondsUntilResend(sentAt, sentAt + 120_000)).toBe(0);
  });
});

describe('classifySendCodeError', () => {
  it('detects no network', () => {
    expect(classifySendCodeError({ name: 'AuthRetryableFetchError', status: 0 })).toBe('network');
  });

  it('detects rate limits', () => {
    expect(classifySendCodeError({ status: 429, code: 'over_email_send_rate_limit' })).toBe(
      'tooManyAttempts',
    );
  });

  it('falls back to a generic error', () => {
    expect(classifySendCodeError({ status: 500 })).toBe('generic');
  });
});

describe('classifyVerifyError', () => {
  const sentAt = 1_000_000;
  const otpError = { status: 403, code: 'otp_expired' };

  it('a rejected code within its validity is a wrong code', () => {
    expect(classifyVerifyError(otpError, sentAt, sentAt + 30_000)).toBe('wrongCode');
  });

  it('a rejected code after its validity is an expired code', () => {
    expect(classifyVerifyError(otpError, sentAt, sentAt + CODE_EXPIRY_SECONDS * 1000)).toBe(
      'expiredCode',
    );
  });

  it('detects too many attempts', () => {
    expect(
      classifyVerifyError({ status: 429, code: 'over_request_rate_limit' }, sentAt, sentAt),
    ).toBe('tooManyAttempts');
  });

  it('detects no network', () => {
    expect(
      classifyVerifyError({ name: 'AuthRetryableFetchError', status: 0 }, sentAt, sentAt),
    ).toBe('network');
  });
});
