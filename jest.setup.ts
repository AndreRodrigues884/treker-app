// Safe area insets are native; the library ships a mock with zero insets for tests.
jest.mock(
  'react-native-safe-area-context',
  () => require('react-native-safe-area-context/jest/mock').default,
);

// In-memory AsyncStorage provided by the library. Tests that care call AsyncStorage.clear().
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
