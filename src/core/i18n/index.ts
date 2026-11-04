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

// Fills {name} placeholders: interpolate('Hi, {name}', { name: 'Ana' }) -> 'Hi, Ana'.
// Unknown placeholders are left as they are so missing values are easy to spot.
export function interpolate(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (placeholder, key: string) =>
    key in values ? String(values[key]) : placeholder,
  );
}
