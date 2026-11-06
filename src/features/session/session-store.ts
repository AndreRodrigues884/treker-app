import { useEffect, useSyncExternalStore } from 'react';

import { parseSession, type GymSession } from '@/core/session';
import { readJson, removeKey, storageKeys, writeJson } from '@/lib/storage';

// The gym session in progress, one per athlete, kept on the phone (AsyncStorage) until it is
// saved on the server or discarded. Every change is written straight away, so closing the app, or
// the phone killing it, loses nothing: the next start reads it back and offers to continue.

type State = {
  userId: string | null;
  // undefined while the stored draft is being read.
  session: GymSession | null | undefined;
};

let state: State = { userId: null, session: undefined };
const listeners = new Set<() => void>();
let loading: Promise<void> | null = null;

function emit() {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// Reads the stored draft of this athlete (once).
export function loadSession(userId: string): Promise<void> {
  if (state.userId === userId && (state.session !== undefined || loading)) {
    return loading ?? Promise.resolve();
  }
  state = { userId, session: undefined };
  emit();
  loading = readJson(storageKeys.gymSession(userId)).then((stored) => {
    if (state.userId === userId && state.session === undefined) {
      state = { userId, session: parseSession(stored, userId) };
      emit();
    }
    loading = null;
  });
  return loading;
}

/**
 * The athlete's session in progress: `session` is null when there is none and undefined while it
 * is being read from the phone.
 */
export function useActiveSession(userId: string): GymSession | null | undefined {
  useEffect(() => {
    void loadSession(userId);
  }, [userId]);
  return useSyncExternalStore(subscribe, () =>
    state.userId === userId ? state.session : undefined,
  );
}

export function getActiveSession(userId: string): GymSession | null | undefined {
  return state.userId === userId ? state.session : undefined;
}

// Replaces the session (null: none) and writes it to the phone.
export async function setActiveSession(userId: string, session: GymSession | null): Promise<void> {
  state = { userId, session };
  emit();
  if (session) await writeJson(storageKeys.gymSession(userId), session);
  else await removeKey(storageKeys.gymSession(userId));
}

export function updateActiveSession(
  userId: string,
  change: (session: GymSession) => GymSession,
): Promise<void> {
  const current = getActiveSession(userId);
  if (!current) return Promise.resolve();
  return setActiveSession(userId, change(current));
}

// For tests: forget what is in memory, like the app being closed (the phone storage stays).
export function resetSessionStore(): void {
  state = { userId: null, session: undefined };
  loading = null;
  emit();
}
