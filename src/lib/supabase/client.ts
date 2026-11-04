// supabase-js builds request URLs with URL APIs React Native does not fully implement.
import 'react-native-url-polyfill/auto';

import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

import type { Database } from './database.types';
import { secureSessionStorage } from './secure-session-storage';

// Expo inlines EXPO_PUBLIC_ variables at build time, so they must be read with these exact names.
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
// The public publishable key. It is safe in the app because RLS protects every table. Never put
// the secret/service_role key here.
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    'Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY. Copy .env.example to .env (see docs/auth.md).',
  );
}

export const supabase = createClient<Database>(supabaseUrl, supabaseKey, {
  auth: {
    storage: secureSessionStorage,
    autoRefreshToken: true,
    persistSession: true,
    // Sign-in uses codes typed in the app, never links opened in a browser.
    detectSessionInUrl: false,
  },
});

/**
 * Refreshes the session token only while the app is in the foreground: timers don't run reliably
 * in the background, and refreshing resumes as soon as the app is active again. Returns a function
 * that stops listening.
 */
export function startAutoRefreshWhileActive(): () => void {
  if (Platform.OS === 'web') return () => {};

  const update = (state: string | null | undefined) => {
    if (state === 'active') {
      supabase.auth.startAutoRefresh();
    } else {
      supabase.auth.stopAutoRefresh();
    }
  };

  update(AppState.currentState);
  const subscription = AppState.addEventListener('change', update);
  return () => {
    subscription.remove();
    supabase.auth.stopAutoRefresh();
  };
}
