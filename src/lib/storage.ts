import AsyncStorage from '@react-native-async-storage/async-storage';

// Small JSON values kept on the phone. Not for secrets (the session has its own encrypted
// storage) nor for workout data (the offline database comes in step 6). Failures are swallowed:
// losing one of these values only means asking again.

export const storageKeys = {
  introSeen: 'treker.intro-seen',
  onboardingDraft: (userId: string) => `treker.onboarding-draft.${userId}`,
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
