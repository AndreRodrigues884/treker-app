// Local databases for tests. expo-sqlite is replaced by test-utils/expo-sqlite-mock.ts (Node's
// SQLite) in jest.setup.ts, so these are real SQLite databases.
import { getProfile, saveProfileFromServer } from '@/features/profile/repository';
import {
  closeAllLocalStores,
  openLocalStore,
  waitingEntries,
  type LocalStore,
} from '@/lib/local-db';
import type { Tables } from '@/lib/supabase/database.types';

import { resetDatabases } from './expo-sqlite-mock';

export const USER_A = 'aaaaaaaa-0000-0000-0000-000000000000';
export const USER_B = 'bbbbbbbb-0000-0000-0000-000000000000';

// Call in beforeEach: closes and deletes every local database.
export function resetLocalDatabases(): void {
  closeAllLocalStores();
  resetDatabases();
}

// A store whose clock can be moved with advance().
export function testStore(
  userId = USER_A,
  start = new Date('2026-11-04T10:00:00Z'),
): LocalStore & { advance: (ms: number) => void } {
  let now = start.getTime();
  const store = openLocalStore(userId, { now: () => new Date(now) });
  return Object.assign(store, {
    advance: (ms: number) => {
      now += ms;
    },
  });
}

export function serverProfile(
  userId = USER_A,
  overrides: Partial<Tables<'profiles'>> = {},
): Tables<'profiles'> {
  return {
    id: userId,
    display_name: 'Ana',
    weight_unit: 'kg',
    pool_unit: 'm',
    timezone: 'Europe/Lisbon',
    locale: 'pt',
    bodyweight_kg: 70,
    visibility: 'private',
    created_at: '2026-11-01T10:00:00Z',
    updated_at: '2026-11-01T10:00:00Z',
    onboarded_at: '2026-11-01T10:00:00Z',
    sports: ['gym'],
    gym_focus: 'strength',
    swim_style: null,
    default_pool_length: null,
    weekly_target: 3,
    ...overrides,
  };
}

export function seedProfile(store: LocalStore, overrides: Partial<Tables<'profiles'>> = {}) {
  saveProfileFromServer(store, serverProfile(store.userId, overrides));
}

// The app's local copy of a user's profile and outbox, as the screens left them.
export function localProfile(userId = USER_A) {
  return getProfile(openLocalStore(userId));
}

export function localOutbox(userId = USER_A) {
  return waitingEntries(openLocalStore(userId).db);
}
