import { classifyRequestError, isNetworkError } from './index';

describe('classifyRequestError', () => {
  it.each([
    [{ message: 'TypeError: Network request failed' }],
    [new TypeError('Network request failed')],
    [{ name: 'AuthRetryableFetchError', status: 0 }],
    [{ message: 'Failed to fetch' }],
  ])('treats %p as no connection', (error) => {
    expect(isNetworkError(error)).toBe(true);
    expect(classifyRequestError(error)).toBe('network');
  });

  it.each([
    [{ code: '23514', message: 'new row violates check constraint' }],
    [{ code: '42501', message: 'permission denied' }],
    [null],
    ['boom'],
  ])('treats %p as a generic error', (error) => {
    expect(classifyRequestError(error)).toBe('generic');
  });
});
