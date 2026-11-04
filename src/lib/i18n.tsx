import { useLocales } from 'expo-localization';
import { createContext, use, useCallback, useEffect, useState, type ReactNode } from 'react';

import {
  effectiveLanguage,
  getMessages,
  isLanguagePreference,
  resolveLanguage,
  type Language,
  type LanguagePreference,
  type Messages,
} from '@/core/i18n';
import { readJson, storageKeys, writeJson } from '@/lib/storage';

export type I18n = {
  // The language the app is shown in.
  language: Language;
  // The phone's language, shown next to "Automatic" in the settings.
  deviceLanguage: Language;
  t: Messages;
};

type LanguageSettings = {
  preference: LanguagePreference;
  setPreference: (preference: LanguagePreference) => Promise<void>;
};

// Without a provider (for example in component tests) the app follows the phone.
const LanguageContext = createContext<LanguageSettings>({
  preference: 'auto',
  setPreference: async () => {},
});

// The language chosen in the settings, kept on this phone.
export function LanguageProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<LanguagePreference | null>(null);

  useEffect(() => {
    let current = true;
    void readJson(storageKeys.language).then((stored) => {
      if (current) setPreferenceState(isLanguagePreference(stored) ? stored : 'auto');
    });
    return () => {
      current = false;
    };
  }, []);

  const setPreference = useCallback(async (next: LanguagePreference) => {
    setPreferenceState(next);
    await writeJson(storageKeys.language, next);
  }, []);

  // Rendering nothing keeps the splash screen up until the stored choice is known, so the app
  // never flashes in the wrong language.
  if (preference === null) return null;

  return <LanguageContext value={{ preference, setPreference }}>{children}</LanguageContext>;
}

export function useLanguageSettings(): LanguageSettings {
  return use(LanguageContext);
}

// Follows the language chosen in the settings, or the phone's (re-rendering when it changes in
// the system settings).
export function useI18n(): I18n {
  const [primaryLocale] = useLocales();
  const { preference } = use(LanguageContext);
  const language = effectiveLanguage(preference, primaryLocale?.languageTag);
  return {
    language,
    deviceLanguage: resolveLanguage(primaryLocale?.languageTag),
    t: getMessages(language),
  };
}
