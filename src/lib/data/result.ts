// supabase-js answers { data, error } instead of throwing. Repositories turn that into a value or
// a thrown error, so TanStack Query and the screens see failures as errors.
export function unwrap<T>(result: { data: T | null; error: unknown }): T {
  if (result.error) throw result.error;
  if (result.data === null) throw new Error('No data returned');
  return result.data;
}

export function unwrapMaybe<T>(result: { data: T | null; error: unknown }): T | null {
  if (result.error) throw result.error;
  return result.data;
}

export function throwIfError(result: { error: unknown }): void {
  if (result.error) throw result.error;
}
