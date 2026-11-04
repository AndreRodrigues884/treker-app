// Jest resolver that chains the two the project needs instead of replacing one with the other:
// 1. Reanimated's (which includes react-native-worklets'), required by the side menu in tests;
// 2. React Native's, which the jest-expo preset uses by default.
const reanimatedResolver = require('react-native-reanimated/jest/resolver');
const reactNativeResolver = require('@react-native/jest-preset/jest/resolver');

module.exports = (request, options) =>
  reanimatedResolver(request, {
    ...options,
    defaultResolver: (nextRequest, nextOptions) =>
      reactNativeResolver(nextRequest, {
        ...nextOptions,
        defaultResolver: options.defaultResolver,
      }),
  });
