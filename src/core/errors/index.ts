// Errors from requests to the server, reduced to what the screens tell the athlete.

export type RequestErrorKey = 'network' | 'generic';

// supabase-js reports a failed fetch (no connection, server unreachable) as a TypeError
// "Network request failed" (database) or an AuthRetryableFetchError with status 0 (auth).
export function isNetworkError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const { name, message, status } = error as { name?: string; message?: string; status?: number };
  const text = `${name ?? ''} ${message ?? ''}`;
  return (
    name === 'AuthRetryableFetchError' ||
    status === 0 ||
    /network request failed|failed to fetch|fetcherror|typeerror/i.test(text)
  );
}

export function classifyRequestError(error: unknown): RequestErrorKey {
  return isNetworkError(error) ? 'network' : 'generic';
}
