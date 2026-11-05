// The athlete's profile in the local database. The app reads it from here; changes are written
// here and queued in the outbox for the server (sent from step 6b on).
import { eq } from 'drizzle-orm';

import type { OnboardingProfileUpdate } from '@/core/onboarding';
import { hasWaitingChange, profiles, type LocalStore } from '@/lib/local-db';
import { inTransaction, recordChange, timestamp } from '@/lib/local-db/write';
import type { Tables } from '@/lib/supabase/database.types';

export type ProfileRow = typeof profiles.$inferSelect;

export function getProfile(store: LocalStore): ProfileRow | null {
  return store.db.select().from(profiles).where(eq(profiles.id, store.userId)).get() ?? null;
}

/**
 * Stores the profile read from the server (once per sign-in until step 6b brings full sync).
 * Skipped when the phone has changes to the profile not yet sent, so they are never overwritten
 * by an older server copy. Not queued in the outbox: it already is the server's state.
 */
export function saveProfileFromServer(store: LocalStore, row: Tables<'profiles'>): boolean {
  if (row.id !== store.userId) throw new Error('Profile of another user');
  return inTransaction(store, (tx) => {
    if (hasWaitingChange(tx, 'profiles', row.id)) return false;
    tx.insert(profiles).values(row).onConflictDoUpdate({ target: profiles.id, set: row }).run();
    return true;
  });
}

export type ProfileChanges = Partial<Omit<ProfileRow, 'id' | 'created_at' | 'updated_at'>>;

// Saves every onboarding answer and marks onboarding as done in one write. Postgres checks the
// answers are complete (profiles_onboarding_complete) when the change reaches it.
export function completeOnboarding(
  store: LocalStore,
  answers: OnboardingProfileUpdate,
): ProfileRow {
  return updateProfile(store, { ...answers, onboarded_at: timestamp(store) });
}

// Edits the profile (onboarding answers, units, bodyweight...). The profile row comes from the
// server at sign-in; without it there is nothing to edit yet.
export function updateProfile(store: LocalStore, changes: ProfileChanges): ProfileRow {
  return inTransaction(store, (tx) => {
    const existing = tx
      .select({ id: profiles.id })
      .from(profiles)
      .where(eq(profiles.id, store.userId))
      .get();
    if (!existing) throw new Error('Profile not loaded yet');
    tx.update(profiles)
      .set({ ...changes, updated_at: timestamp(store) })
      .where(eq(profiles.id, store.userId))
      .run();
    return recordChange<ProfileRow>(tx, store, 'profiles', profiles, store.userId, 'upsert');
  });
}
