import { randomUUID } from 'expo-crypto';

// What a repository needs besides the Supabase client: who the athlete is, the clock and the id
// generator (replaceable in tests). Ids are made on the phone so that repeating a request after a
// network failure upserts the same row instead of creating a second one.
export type DataContext = {
  userId: string;
  now: () => Date;
  newId: () => string;
};

export function createDataContext(userId: string): DataContext {
  return { userId, now: () => new Date(), newId: randomUUID };
}
