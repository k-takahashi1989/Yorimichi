/**
 * fcmService ユニットテスト
 * クールダウン管理、トークン登録の基本動作を検証する
 */
import { getCooldownRemaining, notifySharedMemoUpdate } from '../src/services/fcmService';

beforeEach(() => {
  jest.clearAllMocks();
  // auth をサインイン済み扱いにする
  const authMock = require('@react-native-firebase/auth');
  (authMock as jest.Mock).mockReturnValue({
    currentUser: { uid: 'test-uid' },
  });
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
    expect(result).toBe('ok');
  });

  it('連続呼び出しは cooldown を返す', async () => {
    await notifySharedMemoUpdate('share-dup', 'テストメモ');
    const result = await notifySharedMemoUpdate('share-dup', 'テストメモ');
    expect(result).toBe('cooldown');
  });

  it('送信後のクールダウン残り秒数が 0 より大きい', async () => {
    await notifySharedMemoUpdate('share-cd', 'テストメモ');
    const remaining = getCooldownRemaining('share-cd');
    expect(remaining).toBeGreaterThan(0);
    expect(remaining).toBeLessThanOrEqual(300); // 5分 = 300秒
  });
});
