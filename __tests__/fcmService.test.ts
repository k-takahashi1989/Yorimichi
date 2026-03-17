/**
 * fcmService ユニットテスト
 * クールダウン管理、トークン登録の基本動作を検証する
 */
import { getCooldownRemaining, notifySharedMemoUpdate } from '../src/services/fcmService';

beforeEach(() => {
  jest.clearAllMocks();
  // auth をサインイン済み + onAuthStateChanged/getIdToken 付きでモック
  const authMock = require('@react-native-firebase/auth');
  (authMock as jest.Mock).mockReturnValue({
    currentUser: { uid: 'test-uid', getIdToken: jest.fn().mockResolvedValue('mock-id-token') },
    onAuthStateChanged: jest.fn((cb: (u: object | null) => void) => {
      cb({ uid: 'test-uid' });
      return () => {};
    }),
  });
  // fetch をモック（成功レスポンス）
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: jest.fn().mockResolvedValue({ result: { sent: 1 } }),
  }) as jest.Mock;
});

// ============================================================
// getCooldownRemaining
// ============================================================
describe('getCooldownRemaining', () => {
  it('初期状態（未送信）で 0 を返す', () => {
    expect(getCooldownRemaining('share-never-sent')).toBe(0);
  });
});

// ============================================================
// notifySharedMemoUpdate
// ============================================================
describe('notifySharedMemoUpdate', () => {
  it('初回は ok を返す', async () => {
    const result = await notifySharedMemoUpdate('share-new', 'テストメモ');
    expect(result.status).toBe('ok');
  });

  it('連続呼び出しは cooldown を返す', async () => {
    await notifySharedMemoUpdate('share-dup', 'テストメモ');
    const result = await notifySharedMemoUpdate('share-dup', 'テストメモ');
    expect(result.status).toBe('cooldown');
  });

  it('送信後のクールダウン残り秒数が 0 より大きい', async () => {
    await notifySharedMemoUpdate('share-cd', 'テストメモ');
    const remaining = getCooldownRemaining('share-cd');
    expect(remaining).toBeGreaterThan(0);
    expect(remaining).toBeLessThanOrEqual(300); // 5分 = 300秒
  });
});
