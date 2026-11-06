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

// expo-crypto's Jest mock has no randomUUID; rows created on the phone need real UUIDs.
jest.mock('expo-crypto', () => ({
  ...jest.requireActual('expo-crypto'),
  randomUUID: () => require('node:crypto').randomUUID(),
}));

// NetInfo's own Jest mock (always connected unless a test changes it).
jest.mock('@react-native-community/netinfo', () =>
  require('@react-native-community/netinfo/jest/netinfo-mock.js'),
);

// TanStack Query batches UI updates with setTimeout(0), which act() does not wait for; a promise
// microtask is flushed by act, so screens update as soon as a request answers.
require('@tanstack/react-query').notifyManager.setScheduler((callback: () => void) => {
  void Promise.resolve().then(callback);
});

// Drag and drop does not run in Jest; see test-utils/sortables-mock.tsx.
jest.mock('react-native-sortables', () => require('./test-utils/sortables-mock'));
