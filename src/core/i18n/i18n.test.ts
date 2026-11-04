import { en } from './en';
import { getMessages, resolveLanguage } from './index';
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
