/**
 * __mocks__/react-native-purchases.js
 * Jest 用モック: react-native-purchases (RevenueCat) をテスト環境で無効化する
 */

const PURCHASES_ERROR_CODE = {
  PURCHASE_CANCELLED_ERROR: 1,
  STORE_PROBLEM_ERROR: 2,
  NETWORKING_ERROR: 3,
  UNKNOWN_ERROR: 0,
};

const Purchases = {
  configure: jest.fn(),
  getOfferings: jest.fn().mockResolvedValue({ current: null }),
  purchasePackage: jest.fn().mockResolvedValue({ customerInfo: {} }),
  restorePurchases: jest.fn().mockResolvedValue({
    entitlements: { active: {} },
  }),
  getCustomerInfo: jest.fn().mockResolvedValue({
    entitlements: { active: {} },
  }),
};

module.exports = {
  __esModule: true,
  default: Purchases,
  Purchases,
  PURCHASES_ERROR_CODE,
};
