import type { OnboardingDraft } from '@/core/onboarding';
import { readJson, removeKey, storageKeys, writeJson } from '@/lib/storage';

// The questionnaire in progress, kept on the phone per user so closing the app midway continues
// where it stopped. Read it back with resumeDraft from src/core/onboarding.

export function loadDraft(userId: string): Promise<unknown> {
  return readJson(storageKeys.onboardingDraft(userId));
}

export function saveDraft(userId: string, draft: OnboardingDraft): Promise<void> {
  return writeJson(storageKeys.onboardingDraft(userId), draft);
}

export function clearDraft(userId: string): Promise<void> {
  return removeKey(storageKeys.onboardingDraft(userId));
}
