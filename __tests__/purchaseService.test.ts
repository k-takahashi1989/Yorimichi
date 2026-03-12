/**
 * purchaseService ユニットテスト
 * initPurchases, getPremiumOffering, purchasePackage, restorePurchases,
 * checkEntitlementActive の全シナリオを検証
 */

// __mocks__/react-native-purchases.js から直接モックオブジェクトを取得
const purchasesMock = require('react-native-purchases');
const MockPurchases = purchasesMock.default;
const { PURCHASES_ERROR_CODE } = purchasesMock;

// react-native-config は moduleNameMapper で固定されるため、直接パッチする
const configMock = require('react-native-config');

beforeEach(() => {
  jest.clearAllMocks();
  configMock.REVENUECAT_ANDROID_API_KEY = 'test-api-key';
});

afterEach(() => {
  delete configMock.REVENUECAT_ANDROID_API_KEY;
});

const {
  initPurchases,
  getPremiumOffering,
  purchasePackage,
  restorePurchases,
  checkEntitlementActive,
} = require('../src/services/purchaseService');

// ============================================================
// initPurchases
// ============================================================
describe('initPurchases', () => {
  it('API キーがあれば Purchases.configure を呼ぶ', () => {
    initPurchases();
    expect(MockPurchases.configure).toHaveBeenCalledWith({ apiKey: 'test-api-key' });
  });

  it('API キーが未設定の場合 configure を呼ばない', () => {
    configMock.REVENUECAT_ANDROID_API_KEY = '';
    initPurchases();
    expect(MockPurchases.configure).not.toHaveBeenCalled();
  });
});

// ============================================================
// getPremiumOffering
// ============================================================
describe('getPremiumOffering', () => {
  it('current offering がある場合 monthly/annual を返す', async () => {
    const mockMonthly = { identifier: '$rc_monthly', product: { price: 500 } };
    const mockAnnual = { identifier: '$rc_annual', product: { price: 4800 } };

    MockPurchases.getOfferings.mockResolvedValue({
      current: {
        monthly: mockMonthly,
        annual: mockAnnual,
      },
    });

    const result = await getPremiumOffering();

    expect(result).not.toBeNull();
    expect(result!.monthly).toBe(mockMonthly);
    expect(result!.annual).toBe(mockAnnual);
  });

  it('current offering がない場合 null を返す', async () => {
    MockPurchases.getOfferings.mockResolvedValue({ current: null });

    const result = await getPremiumOffering();
    expect(result).toBeNull();
  });

  it('getOfferings がエラーを投げた場合 null を返す', async () => {
    MockPurchases.getOfferings.mockRejectedValue(new Error('Network error'));

    const result = await getPremiumOffering();
    expect(result).toBeNull();
  });
});

// ============================================================
// purchasePackage
// ============================================================
describe('purchasePackage', () => {
  const mockPackage = { identifier: '$rc_annual', product: { price: 4800 } };

  it('購入成功時に success:true と hasPremium を返す', async () => {
    MockPurchases.purchasePackage.mockResolvedValue({
      customerInfo: {
        entitlements: { active: { premium: { isActive: true } } },
      },
    });

    const result = await purchasePackage(mockPackage as any);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.hasPremium).toBe(true);
    }
  });

  it('premium エンタイトルメントがない場合 hasPremium:false を返す', async () => {
    MockPurchases.purchasePackage.mockResolvedValue({
      customerInfo: {
        entitlements: { active: {} },
      },
    });

    const result = await purchasePackage(mockPackage as any);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.hasPremium).toBe(false);
    }
  });

  it('ユーザーがキャンセルした場合 cancelled:true を返す', async () => {
    const cancelError = {
      code: PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR,
      message: 'User cancelled',
    };
    MockPurchases.purchasePackage.mockRejectedValue(cancelError);

    const result = await purchasePackage(mockPackage as any);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.cancelled).toBe(true);
    }
  });

  it('その他のエラーの場合 cancelled:false を返す', async () => {
    const storeError = {
      code: PURCHASES_ERROR_CODE.STORE_PROBLEM_ERROR,
      message: 'Store problem',
    };
    MockPurchases.purchasePackage.mockRejectedValue(storeError);

    const result = await purchasePackage(mockPackage as any);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.cancelled).toBe(false);
      expect(result.error).toBe('Store problem');
    }
  });
});

// ============================================================
// restorePurchases
// ============================================================
describe('restorePurchases', () => {
  it('復元成功時に success:true と hasPremium を返す', async () => {
    MockPurchases.restorePurchases.mockResolvedValue({
      entitlements: { active: { premium: { isActive: true } } },
    });

    const result = await restorePurchases();

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.hasPremium).toBe(true);
    }
  });

  it('premium がない場合 hasPremium:false を返す', async () => {
    MockPurchases.restorePurchases.mockResolvedValue({
      entitlements: { active: {} },
    });

    const result = await restorePurchases();

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.hasPremium).toBe(false);
    }
  });

  it('エラー時に success:false を返す', async () => {
    MockPurchases.restorePurchases.mockRejectedValue(new Error('Restore failed'));

    const result = await restorePurchases();

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe('Restore failed');
    }
  });
});

// ============================================================
// checkEntitlementActive
// ============================================================
describe('checkEntitlementActive', () => {
  it('premium エンタイトルメントがあれば true を返す', async () => {
    MockPurchases.getCustomerInfo.mockResolvedValue({
      entitlements: { active: { premium: { isActive: true } } },
    });

    const result = await checkEntitlementActive();
    expect(result).toBe(true);
  });

  it('premium エンタイトルメントがなければ false を返す', async () => {
    MockPurchases.getCustomerInfo.mockResolvedValue({
      entitlements: { active: {} },
    });

    const result = await checkEntitlementActive();
    expect(result).toBe(false);
  });

  it('getCustomerInfo がエラーを投げた場合はエラーを伝播させる', async () => {
    MockPurchases.getCustomerInfo.mockRejectedValue(new Error('Auth error'));

    await expect(checkEntitlementActive()).rejects.toThrow('Auth error');
  });
});
