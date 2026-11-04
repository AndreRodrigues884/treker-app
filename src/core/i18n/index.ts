import { en, type Messages } from './en';
import { pt } from './pt';

export type { Messages };

export const languages = ['en', 'pt'] as const;
export type Language = (typeof languages)[number];

const dictionaries: Record<Language, Messages> = { en, pt };

// Locale used for Intl formatting in each language.
const intlLocales: Record<Language, string> = {
  en: 'en-US',
  pt: 'pt-PT',
};

// Portuguese for any pt-* device locale, English for everything else.
export function resolveLanguage(languageTag: string | null | undefined): Language {
  const tag = languageTag?.toLowerCase() ?? '';
  return tag === 'pt' || tag.startsWith('pt-') ? 'pt' : 'en';
}

export function getMessages(language: Language): Messages {
  return dictionaries[language];
}

export function intlLocale(language: Language): string {
  return intlLocales[language];
}
