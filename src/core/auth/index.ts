import { z } from 'zod';

// Sign-in by a 6-digit code sent by email. Keep these in sync with supabase/config.toml
// ([auth.email] otp_length, otp_expiry and max_frequency).
export const CODE_LENGTH = 6;
export const CODE_EXPIRY_SECONDS = 600;
export const RESEND_COOLDOWN_SECONDS = 60;

const emailSchema = z.string().trim().toLowerCase().pipe(z.email());
const codeSchema = z.string().regex(new RegExp(`^\\d{${CODE_LENGTH}}$`));

export type Validation<T, E> = { ok: true; value: T } | { ok: false; error: E };

export function validateEmail(input: string): Validation<string, 'invalidEmail'> {
  const result = emailSchema.safeParse(input);
  return result.success ? { ok: true, value: result.data } : { ok: false, error: 'invalidEmail' };
}

// Keeps only digits, so pasted codes like "123 456" or "123-456" still work.
export function normalizeCode(input: string): string {
  return input.replace(/\D/g, '').slice(0, CODE_LENGTH);
}

export function validateCode(input: string): Validation<string, 'invalidCodeFormat'> {
  const result = codeSchema.safeParse(normalizeCode(input));
  return result.success
    ? { ok: true, value: result.data }
    : { ok: false, error: 'invalidCodeFormat' };
}

// Seconds left before another code can be requested (0 when allowed).
export function secondsUntilResend(lastSentAtMs: number, nowMs: number): number {
  const elapsedSeconds = (nowMs - lastSentAtMs) / 1000;
  return Math.max(0, Math.ceil(RESEND_COOLDOWN_SECONDS - elapsedSeconds));
}

// Errors ---------------------------------------------------------------------------------------

export type AuthErrorKey = 'wrongCode' | 'expiredCode' | 'tooManyAttempts' | 'network' | 'generic';

// The parts of a Supabase AuthError this logic needs.
export type AuthErrorLike = {
  name?: string;
  status?: number;
  code?: string;
};

function isNetworkError(error: AuthErrorLike): boolean {
  // supabase-js reports failed fetches as AuthRetryableFetchError with status 0.
  return error.name === 'AuthRetryableFetchError' || error.status === 0;
}

function isRateLimited(error: AuthErrorLike): boolean {
  return error.status === 429 || (error.code?.startsWith('over_') ?? false);
}

// Sending a code. Never says whether the email already has an account: new emails get an account
// created, so both cases behave the same.
export function classifySendCodeError(error: AuthErrorLike): AuthErrorKey {
  if (isNetworkError(error)) return 'network';
  if (isRateLimited(error)) return 'tooManyAttempts';
  return 'generic';
}

/**
 * Verifying a code. Supabase answers a wrong code and an expired one with the same error
 * (otp_expired), so the time since the code was sent tells them apart.
 */
export function classifyVerifyError(
  error: AuthErrorLike,
  codeSentAtMs: number,
  nowMs: number,
): AuthErrorKey {
  if (isNetworkError(error)) return 'network';
  if (isRateLimited(error)) return 'tooManyAttempts';
  if (error.code === 'otp_expired' || error.status === 403) {
    const expired = nowMs - codeSentAtMs >= CODE_EXPIRY_SECONDS * 1000;
    return expired ? 'expiredCode' : 'wrongCode';
  }
  return 'generic';
}
