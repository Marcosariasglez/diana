/// <reference types="jest" />

// Mock react-native-worklets (modulo nativo no disponible en jest).
jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));

// Mock react-native-reanimated (mock oficial: useSharedValue, useAnimatedStyle,
// withTiming, withSpring, etc. funcionan de forma sincrona).
jest.mock('react-native-reanimated', () => ({
  ...require('react-native-reanimated/mock'),
  useReducedMotion: () => false,
}));

// Mock react-native-gesture-handler: Gesture.* devuelve un builder encadenable.
jest.mock('react-native-gesture-handler', () => {
  const makeGesture = (): any => {
    const g: any = new Proxy(
      {},
      { get: () => () => g },
    );
    return g;
  };
  return {
    Gesture: { Pan: makeGesture, Tap: makeGesture },
    GestureDetector: ({ children }: { children: import('react').ReactNode }) => children,
    GestureHandlerRootView: ({ children }: { children: import('react').ReactNode }) => children,
  };
});

// Mock @react-native-async-storage/async-storage
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

// Mock expo-haptics
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  selectionAsync: jest.fn(),
}));

// Mock expo-clipboard
jest.mock('expo-clipboard', () => ({
  setStringAsync: jest.fn(),
  getStringAsync: jest.fn(),
  getStringsAsync: jest.fn(),
  clearClipboardAsync: jest.fn(),
  hasStringsAsync: jest.fn(),
}));
