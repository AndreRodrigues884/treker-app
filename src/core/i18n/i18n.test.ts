import { en } from './en';
import {
  effectiveLanguage,
  getMessages,
  interpolate,
  isLanguagePreference,
  resolveLanguage,
} from './index';
import { pt } from './pt';

// Flattens a dictionary into [path, value] pairs, e.g. ['records.prShort', 'PR'].
function entries(value: object, prefix = ''): [string, unknown][] {
  return Object.entries(value).flatMap(([key, child]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return typeof child === 'object' && child !== null
      ? entries(child, path)
      : [[path, child] as [string, unknown]];
  });
}

const keysOf = (dictionary: object) =>
  entries(dictionary)
    .map(([path]) => path)
    .sort();

describe('dictionaries', () => {
  it('pt has exactly the same keys as en', () => {
    expect(keysOf(pt)).toEqual(keysOf(en));
  });

  it.each([
    ['en', en],
    ['pt', pt],
  ])('%s has no empty translations', (_, dictionary) => {
    for (const [path, text] of entries(dictionary)) {
      expect({ path, ok: typeof text === 'string' && text.trim().length > 0 }).toEqual({
        path,
        ok: true,
      });
    }
  });
});

describe('resolveLanguage', () => {
  it.each(['pt', 'pt-PT', 'pt-BR', 'PT-pt'])('uses Portuguese for %s', (tag) => {
    expect(resolveLanguage(tag)).toBe('pt');
  });

  it.each(['en-US', 'en-GB', 'es-ES', 'fr', 'ptx', '', null, undefined])(
    'uses English for %p',
    (tag) => {
      expect(resolveLanguage(tag)).toBe('en');
    },
  );
});

describe('getMessages', () => {
  it('returns the dictionary for each language', () => {
    expect(getMessages('en').records.prLabel).toBe('Personal record');
    expect(getMessages('pt').records.prLabel).toBe('Recorde pessoal');
  });
});

describe('interpolate', () => {
  it('fills placeholders', () => {
    expect(interpolate('Resend in {seconds} s', { seconds: 42 })).toBe('Resend in 42 s');
    expect(interpolate('{a} and {a}', { a: 'x' })).toBe('x and x');
  });

  it('leaves unknown placeholders visible', () => {
    expect(interpolate('Hi, {name}', {})).toBe('Hi, {name}');
  });
});

describe('placeholders', () => {
  // Every translation must use the same {placeholders} as English.
  const placeholdersOf = (text: unknown) =>
    typeof text === 'string' ? (text.match(/\{\w+\}/g) ?? []).sort() : [];

  it('pt uses the same placeholders as en', () => {
    const ptEntries = new Map(entries(pt));
    for (const [path, text] of entries(en)) {
      expect({ path, placeholders: placeholdersOf(ptEntries.get(path)) }).toEqual({
        path,
        placeholders: placeholdersOf(text),
      });
    }
  });
});

describe('language preference', () => {
  it('auto follows the phone', () => {
    expect(effectiveLanguage('auto', 'pt-PT')).toBe('pt');
    expect(effectiveLanguage('auto', 'de-DE')).toBe('en');
  });

  it('an explicit choice wins over the phone', () => {
    expect(effectiveLanguage('en', 'pt-PT')).toBe('en');
    expect(effectiveLanguage('pt', 'en-US')).toBe('pt');
  });

  it('recognizes stored values', () => {
    expect(isLanguagePreference('auto')).toBe(true);
    expect(isLanguagePreference('pt')).toBe(true);
    expect(isLanguagePreference('fr')).toBe(false);
    expect(isLanguagePreference(null)).toBe(false);
  });
});
