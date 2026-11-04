// Safe area insets are native; the library ships a mock with zero insets for tests.
jest.mock(
  'react-native-safe-area-context',
  () => require('react-native-safe-area-context/jest/mock').default,
);

// In-memory AsyncStorage provided by the library. Tests that care call AsyncStorage.clear().
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

// Reanimated (used by the side menu) runs on the JS thread in tests. Needs the resolver in
// test-utils/jest-resolver.js (Reanimated + Worklets chained with React Native's).
require('react-native-reanimated').setUpTests();
