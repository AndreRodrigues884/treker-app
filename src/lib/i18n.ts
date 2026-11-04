import { useLocales } from 'expo-localization';

import { getMessages, resolveLanguage, type Language, type Messages } from '@/core/i18n';

export type I18n = {
  language: Language;
  t: Messages;
};

// Follows the phone's preferred language and re-renders when it changes in the system settings.
export function useI18n(): I18n {
  const [primaryLocale] = useLocales();
  const language = resolveLanguage(primaryLocale?.languageTag);
  return { language, t: getMessages(language) };
}
