import AsyncStorage from '@react-native-async-storage/async-storage';

// Small JSON values kept on the phone. Not for secrets (the sign-in session has its own encrypted
// storage). The gym session in progress is kept here until it is saved (see
// src/features/session/session-store.ts). Failures are swallowed: losing one of these values only
// means asking again.

export const storageKeys = {
  introSeen: 'treker.intro-seen',
  language: 'treker.language',
  onboardingDraft: (userId: string) => `treker.onboarding-draft.${userId}`,
  gymSession: (userId: string) => `treker.gym-session.${userId}`,
  restNotificationsAsked: 'treker.rest-notifications-asked',
} as const;

export async function readJson(key: string): Promise<unknown> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw === null ? null : JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function writeJson(key: string, value: unknown): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Not critical; see above.
  }
}

export async function removeKey(key: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(key);
  } catch {
    // Not critical; see above.
  }
}
