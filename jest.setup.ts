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

// expo-sqlite backed by Node's built-in SQLite, so the local database runs for real in tests.
jest.mock('expo-sqlite', () => require('./test-utils/expo-sqlite-mock'));

// expo-crypto's Jest mock has no randomUUID; local rows need real UUIDs.
jest.mock('expo-crypto', () => ({
  ...jest.requireActual('expo-crypto'),
  randomUUID: () => require('node:crypto').randomUUID(),
}));
