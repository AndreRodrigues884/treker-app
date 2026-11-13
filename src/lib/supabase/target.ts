// Which Supabase the app was started against: the online project (https://<ref>.supabase.co) or
// the local one (http://<PC's IP>:54321). Read from the same EXPO_PUBLIC_ variable as the client,
// so it can never disagree with where requests really go.
export type SupabaseTarget = 'local' | 'online';

export function supabaseTargetOf(url: string | undefined): SupabaseTarget {
  if (!url) return 'local';
  try {
    return new URL(url).hostname.endsWith('.supabase.co') ? 'online' : 'local';
  } catch {
    return 'local';
  }
}

export const supabaseTarget = supabaseTargetOf(process.env.EXPO_PUBLIC_SUPABASE_URL);
