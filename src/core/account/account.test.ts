import { isDeleteConfirmed } from './index';

describe('isDeleteConfirmed', () => {
  it.each([
    ['DELETE', 'DELETE'],
    [' delete ', 'DELETE'],
    ['APAGAR', 'APAGAR'],
    ['Apagar', 'APAGAR'],
  ])('accepts %p for %p', (input, word) => {
    expect(isDeleteConfirmed(input, word)).toBe(true);
  });

  it.each([
    ['', 'DELETE'],
    ['DELET', 'DELETE'],
    ['DELETE ME', 'DELETE'],
    ['DELETE', 'APAGAR'],
  ])('rejects %p for %p', (input, word) => {
    expect(isDeleteConfirmed(input, word)).toBe(false);
  });
});
