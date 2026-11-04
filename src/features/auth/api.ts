import { classifySendCodeError, classifyVerifyError, type AuthErrorKey } from '@/core/auth';
import { supabase } from '@/lib/supabase/client';

// Sends a 6-digit sign-in code. Emails without an account get one, so the answer never reveals
// whether an email is registered.
export async function sendEmailCode(email: string): Promise<{ error: AuthErrorKey | null }> {
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true },
  });
  return { error: error ? classifySendCodeError(error) : null };
}

// On success Supabase stores the session and AuthProvider moves the user on.
export async function verifyEmailCode(
  email: string,
  code: string,
  codeSentAtMs: number,
): Promise<{ error: AuthErrorKey | null }> {
  const { error } = await supabase.auth.verifyOtp({ email, token: code, type: 'email' });
  return { error: error ? classifyVerifyError(error, codeSentAtMs, Date.now()) : null };
}
