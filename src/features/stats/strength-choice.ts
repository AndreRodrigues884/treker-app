// The exercises the strength chart (Statistics) shows, chosen by the athlete: kept on the phone,
// per user (AsyncStorage), and shared by the Statistics screen and the chooser. Null until the
// athlete chooses: the chart then shows the exercises done most (defaultStrengthExercises).
import { useEffect, useSyncExternalStore } from 'react';

import { parseStrengthChoice } from '@/core/progress';
import { readJson, storageKeys, writeJson } from '@/lib/storage';

type State = { userId: string | null; loaded: boolean; choice: string[] | null };

let state: State = { userId: null, loaded: false, choice: null };
const listeners = new Set<() => void>();

function emit(next: State) {
  state = next;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

async function load(userId: string) {
  const choice = parseStrengthChoice(await readJson(storageKeys.strengthExercises(userId)));
  if (state.userId === userId && !state.loaded) emit({ userId, loaded: true, choice });
}

/** The athlete's choice (null: not chosen yet) and whether it was read from the phone. */
export function useStrengthChoice(userId: string): { loaded: boolean; choice: string[] | null } {
  const current = useSyncExternalStore(subscribe, () => state);
  useEffect(() => {
    if (state.userId !== userId) {
      emit({ userId, loaded: false, choice: null });
      void load(userId);
    }
  }, [userId]);
  return current.userId === userId
    ? { loaded: current.loaded, choice: current.choice }
    : { loaded: false, choice: null };
}

export async function setStrengthChoice(userId: string, choice: readonly string[]): Promise<void> {
  emit({ userId, loaded: true, choice: [...choice] });
  await writeJson(storageKeys.strengthExercises(userId), choice);
}

// Tests start from an empty store.
export function resetStrengthChoice(): void {
  state = { userId: null, loaded: false, choice: null };
}
