/**
 * backupService ユニットテスト
 * backupAllMemos, restoreFromBackup, shouldAutoBackup の全シナリオを検証
 */

const firestoreMock = require('@react-native-firebase/firestore');
const authMock = require('@react-native-firebase/auth');

// backupService は shareService の ensureSignedIn を使うため auth モックが必要
beforeEach(() => {
  jest.clearAllMocks();
  (authMock as jest.Mock).mockReturnValue({
    currentUser: { uid: 'test-uid-123' },
    signInAnonymously: jest.fn(),
    onAuthStateChanged: jest.fn(cb => {
      cb({ uid: 'test-uid-123' });
      return () => {};
    }),
  });
});

// ============================================================
// backupAllMemos
// ============================================================
describe('backupAllMemos', () => {
  it('メモを Firestore に保存し backupAt タイムスタンプを返す', async () => {
    const mockSet = jest.fn().mockResolvedValue(undefined);
    (firestoreMock as jest.Mock).mockReturnValue({
      collection: jest.fn(() => ({
        doc: jest.fn(() => ({
          set: mockSet,
          get: jest.fn(),
        })),
      })),
    });

    const { backupAllMemos } = require('../src/services/backupService');
    const memos = [
      { id: 'memo-1', title: 'テスト', items: [], locations: [] },
    ];

    const result = await backupAllMemos(memos, 'device-abc');

    expect(typeof result).toBe('number');
    expect(mockSet).toHaveBeenCalledTimes(1);
    const savedDoc = mockSet.mock.calls[0][0];
    expect(savedDoc.deviceId).toBe('device-abc');
    expect(savedDoc.ownerUid).toBe('test-uid-123');
    expect(savedDoc.memos).toHaveLength(1);
    expect(savedDoc.memos[0].title).toBe('テスト');
  });

  it('undefined フィールドを JSON ラウンドトリップで除去する', async () => {
    const mockSet = jest.fn().mockResolvedValue(undefined);
    (firestoreMock as jest.Mock).mockReturnValue({
      collection: jest.fn(() => ({
        doc: jest.fn(() => ({
          set: mockSet,
          get: jest.fn(),
        })),
      })),
    });

    const { backupAllMemos } = require('../src/services/backupService');
    const memos = [
      {
        id: 'memo-1',
        title: 'Test',
        items: [{ id: 'item-1', name: 'りんご', isChecked: false, checkedAt: undefined }],
        locations: [],
      },
    ];

    await backupAllMemos(memos, 'device-abc');

    const savedDoc = mockSet.mock.calls[0][0];
    const savedItem = savedDoc.memos[0].items[0];
    expect(savedItem).not.toHaveProperty('checkedAt');
  });
});

// ============================================================
// restoreFromBackup
// ============================================================
describe('restoreFromBackup', () => {
  it('バックアップが存在する場合 BackupDoc を返す', async () => {
    const backupData = {
      memos: [{ id: 'memo-1', title: '復元テスト', items: [], locations: [] }],
      backupAt: 1700000000000,
      deviceId: 'device-abc',
      ownerUid: 'test-uid-123',
    };

    (firestoreMock as jest.Mock).mockReturnValue({
      collection: jest.fn(() => ({
        doc: jest.fn(() => ({
          get: jest.fn().mockResolvedValue({
            exists: true,
            data: () => backupData,
          }),
        })),
      })),
    });

    const { restoreFromBackup } = require('../src/services/backupService');
    const result = await restoreFromBackup('device-abc');

    expect(result).not.toBeNull();
    expect(result!.memos).toHaveLength(1);
    expect(result!.memos[0].title).toBe('復元テスト');
  });

  it('バックアップが存在しない場合 null を返す', async () => {
    (firestoreMock as jest.Mock).mockReturnValue({
      collection: jest.fn(() => ({
        doc: jest.fn(() => ({
          get: jest.fn().mockResolvedValue({
            exists: false,
            data: () => undefined,
          }),
        })),
      })),
    });

    const { restoreFromBackup } = require('../src/services/backupService');
    const result = await restoreFromBackup('device-xyz');

    expect(result).toBeNull();
  });
});

// ============================================================
// shouldAutoBackup
// ============================================================
describe('shouldAutoBackup', () => {
  it('lastBackupAt が null の場合 true を返す', () => {
    const { shouldAutoBackup } = require('../src/services/backupService');
    expect(shouldAutoBackup(null)).toBe(true);
  });

  it('24時間以上経過していれば true を返す', () => {
    const { shouldAutoBackup } = require('../src/services/backupService');
    const oneDayAgo = Date.now() - 25 * 60 * 60 * 1000;
    expect(shouldAutoBackup(oneDayAgo)).toBe(true);
  });

  it('24時間未満であれば false を返す', () => {
    const { shouldAutoBackup } = require('../src/services/backupService');
    const recentBackup = Date.now() - 1 * 60 * 60 * 1000; // 1時間前
    expect(shouldAutoBackup(recentBackup)).toBe(false);
  });
});
