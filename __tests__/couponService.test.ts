/**
 * couponService ユニットテスト
 * redeemCouponCode の全シナリオを検証
 */
import { redeemCouponCode } from '../src/services/couponService';

// moduleNameMapper により __mocks__/@react-native-firebase/firestore.js が使われる
const firestoreMock = require('@react-native-firebase/firestore');
const mockTxGet: jest.Mock = firestoreMock._mockTxGet;
const mockTxUpdate: jest.Mock = firestoreMock._mockTxUpdate;

function makeMockFirestoreInstance(txBehavior: (cb: Function) => Promise<any>) {
  (firestoreMock as jest.Mock).mockReturnValue({
    collection: jest.fn(() => ({
      doc: jest.fn(() => ({})),
    })),
    runTransaction: jest.fn(txBehavior),
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  // auth: サインイン済み
  const authMock = require('@react-native-firebase/auth');
  (authMock as jest.Mock).mockReturnValue({
    currentUser: { uid: 'test-uid' },
    signInAnonymously: jest.fn(),
  });
});

// ============================================================
// 正常系: 有効な未使用コード
// ============================================================
describe('redeemCouponCode — 正常系', () => {
  it('有効な未使用コードで ok:true と expiryMs を返す', async () => {
    jest.useFakeTimers();
    const now = new Date('2026-01-01T00:00:00Z').getTime();
    jest.setSystemTime(now);

    makeMockFirestoreInstance(async (cb: Function) => {
      const tx = {
        get: jest.fn().mockResolvedValue({
          exists: true,
          data: () => ({ used: false, durationDays: 365 }),
        }),
        update: mockTxUpdate,
      };
      return cb(tx);
    });

    const result = await redeemCouponCode('VALID-CODE', 'device-1');

    expect(result.ok).toBe(true);
    expect(result.error).toBeUndefined();
    expect(result.expiryMs).toBe(now + 365 * 24 * 60 * 60 * 1000);

    jest.useRealTimers();
  });

  it('durationDays が未指定のとき 365 日をデフォルト値として使う', async () => {
    jest.useFakeTimers();
    const now = new Date('2026-06-01T00:00:00Z').getTime();
    jest.setSystemTime(now);

    makeMockFirestoreInstance(async (cb: Function) => {
      const tx = {
        get: jest.fn().mockResolvedValue({
          exists: true,
          data: () => ({ used: false }), // durationDays なし
        }),
        update: mockTxUpdate,
      };
      return cb(tx);
    });

    const result = await redeemCouponCode('CODE365', 'device-1');

    expect(result.ok).toBe(true);
    expect(result.expiryMs).toBe(now + 365 * 24 * 60 * 60 * 1000);

    jest.useRealTimers();
  });

  it('入力コードを trim・大文字化してから検索する', async () => {
    let capturedDocId: string | undefined;

    (firestoreMock as jest.Mock).mockReturnValue({
      collection: jest.fn(() => ({
        doc: jest.fn((id: string) => {
          capturedDocId = id;
          return {};
        }),
      })),
      runTransaction: jest.fn(async (cb: Function) => {
        const tx = {
          get: jest.fn().mockResolvedValue({
            exists: true,
            data: () => ({ used: false, durationDays: 30 }),
          }),
          update: jest.fn(),
        };
        return cb(tx);
      }),
    });

    await redeemCouponCode('  lowercase-code  ', 'device-1');
    expect(capturedDocId).toBe('LOWERCASE-CODE');
  });

  it('成功時に tx.update が used:true で呼ばれる', async () => {
    const capturedUpdate = jest.fn();

    makeMockFirestoreInstance(async (cb: Function) => {
      const tx = {
        get: jest.fn().mockResolvedValue({
          exists: true,
          data: () => ({ used: false, durationDays: 90 }),
        }),
        update: capturedUpdate,
      };
      return cb(tx);
    });

    await redeemCouponCode('CODE90', 'my-device');

    expect(capturedUpdate).toHaveBeenCalledTimes(1);
    const updateArg = capturedUpdate.mock.calls[0][1];
    expect(updateArg.used).toBe(true);
    expect(updateArg.usedBy).toBe('my-device');
    expect(typeof updateArg.usedAt).toBe('number');
  });
});

// ============================================================
// 異常系: コードが存在しない
// ============================================================
describe('redeemCouponCode — コード無効', () => {
  it('ドキュメントが存在しない場合 ok:false / error:invalid を返す', async () => {
    makeMockFirestoreInstance(async (cb: Function) => {
      const tx = {
        get: jest.fn().mockResolvedValue({ exists: false, data: () => undefined }),
        update: jest.fn(),
      };
      return cb(tx);
    });

    const result = await redeemCouponCode('NO-SUCH-CODE', 'device-1');

    expect(result.ok).toBe(false);
    expect(result.expiryMs).toBeNull();
    expect(result.error).toBe('invalid');
  });
});

// ============================================================
// 異常系: 使用済みコード
// ============================================================
describe('redeemCouponCode — 使用済みコード', () => {
  it('used:true のコードは ok:false / error:already_used を返す', async () => {
    makeMockFirestoreInstance(async (cb: Function) => {
      const tx = {
        get: jest.fn().mockResolvedValue({
          exists: true,
          data: () => ({ used: true, durationDays: 365 }),
        }),
        update: jest.fn(),
      };
      return cb(tx);
    });

    const result = await redeemCouponCode('USED-CODE', 'device-1');

    expect(result.ok).toBe(false);
    expect(result.expiryMs).toBeNull();
    expect(result.error).toBe('already_used');
  });

  it('使用済みのとき tx.update を呼ばない', async () => {
    const capturedUpdate = jest.fn();

    makeMockFirestoreInstance(async (cb: Function) => {
      const tx = {
        get: jest.fn().mockResolvedValue({
          exists: true,
          data: () => ({ used: true }),
        }),
        update: capturedUpdate,
      };
      return cb(tx);
    });

    await redeemCouponCode('USED-CODE', 'device-1');
    expect(capturedUpdate).not.toHaveBeenCalled();
  });
});

// ============================================================
// 異常系: ネットワーク / Firestore エラー
// ============================================================
describe('redeemCouponCode — ネットワークエラー', () => {
  it('runTransaction が例外を投げると ok:false / error:network を返す', async () => {
    (firestoreMock as jest.Mock).mockReturnValue({
      collection: jest.fn(() => ({ doc: jest.fn(() => ({})) })),
      runTransaction: jest.fn().mockRejectedValue(new Error('Network error')),
    });

    const result = await redeemCouponCode('ANY-CODE', 'device-1');

    expect(result.ok).toBe(false);
    expect(result.expiryMs).toBeNull();
    expect(result.error).toBe('network');
  });

  it('内部 tx.get が例外を投げると ok:false / error:network を返す', async () => {
    makeMockFirestoreInstance(async (cb: Function) => {
      const tx = {
        get: jest.fn().mockRejectedValue(new Error('offline')),
        update: jest.fn(),
      };
      return cb(tx);
    });

    const result = await redeemCouponCode('ANY-CODE', 'device-1');

    expect(result.ok).toBe(false);
    expect(result.error).toBe('network');
  });
});
