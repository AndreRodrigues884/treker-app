// Safe area insets are native; the library ships a mock with zero insets for tests.
jest.mock(
  'react-native-safe-area-context',
  () => require('react-native-safe-area-context/jest/mock').default,
);
