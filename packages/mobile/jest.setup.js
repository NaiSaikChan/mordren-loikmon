/* eslint-disable no-undef */
// Silence noisy native warnings during tests and stub native-only modules.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
)

jest.mock('expo-secure-store', () => ({
  isAvailableAsync: jest.fn(async () => true),
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => undefined),
  deleteItemAsync: jest.fn(async () => undefined),
}))

// expo-iap talks to StoreKit / Play Billing through a native module that does
// not exist under Jest. Pure purchase logic lives in src/lib/iap.ts and is tested
// with injected dependencies; this stub only keeps imports from crashing.
jest.mock('expo-iap', () => ({
  useIAP: jest.fn(() => ({
    connected: false,
    products: [],
    subscriptions: [],
    availablePurchases: [],
    activeSubscriptions: [],
    fetchProducts: jest.fn(async () => undefined),
    requestPurchase: jest.fn(async () => null),
    finishTransaction: jest.fn(async () => undefined),
    getAvailablePurchases: jest.fn(async () => undefined),
    restorePurchases: jest.fn(async () => undefined),
    getActiveSubscriptions: jest.fn(async () => undefined),
    reconnect: jest.fn(async () => false),
  })),
  initConnection: jest.fn(async () => true),
  endConnection: jest.fn(async () => true),
  fetchProducts: jest.fn(async () => []),
  requestPurchase: jest.fn(async () => null),
  finishTransaction: jest.fn(async () => undefined),
  getAvailablePurchases: jest.fn(async () => []),
  restorePurchases: jest.fn(async () => undefined),
  isUserCancelledError: jest.fn((error) => error?.code === 'user-cancelled'),
  ErrorCode: { UserCancelled: 'user-cancelled', AlreadyOwned: 'already-owned', Pending: 'pending' },
}))
