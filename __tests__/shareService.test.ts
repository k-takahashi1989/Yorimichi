/**
 * shareService ユニットテスト
 * sanitizeItem / sanitizeLocation の間接検証（updateSharedMemoItems / Locations 経由）
 * isPresenceActive の直接テスト
 */
import {
  updateSharedMemoItems,
  updateSharedMemoLocations,
  isPresenceActive,
  uploadSharedMemo,
} from '../src/services/shareService';
import { ShoppingItem, MemoLocation, Memo } from '../src/types';

// moduleNameMapper により __mocks__/@react-native-firebase/firestore.js が使われる
const firestoreMock = require('@react-native-firebase/firestore');
const mockDoc: jest.Mocked<any> = firestoreMock._mockDoc;
const mockTxUpdate: jest.Mock = firestoreMock._mockTxUpdate;

beforeEach(() => {
  jest.clearAllMocks();
  // auth は currentUser を返してサインイン済み扱いにする
  const authMock = require('@react-native-firebase/auth');
  (authMock as jest.Mock).mockReturnValue({
    currentUser: { uid: 'test-uid' },
    signInAnonymously: jest.fn(),
    // waitForAuthReady() が onAuthStateChanged を呼ぶため、即時コールバックを返す
    onAuthStateChanged: jest.fn(cb => { cb({ uid: 'test-uid' }); return () => {}; }),
  });
});

// ============================================================
// sanitizeItem — updateSharedMemoItems 経由で検証
// ============================================================
describe('sanitizeItem (via updateSharedMemoItems)', () => {
  it('checkedAt が undefined のとき、Firestore に送るオブジェクトに checkedAt を含まない', async () => {
    const items: ShoppingItem[] = [
      { id: 'i1', name: '牛乳', isChecked: false }, // checkedAt なし
    ];

    await updateSharedMemoItems('share-1', items);

    const [updateArg] = mockDoc.update.mock.calls[0];
    const sent = updateArg.items[0];
    expect(sent).toEqual({ id: 'i1', name: '牛乳', isChecked: false });
    expect(Object.prototype.hasOwnProperty.call(sent, 'checkedAt')).toBe(false);
  });

  it('checkedAt が設定されているとき、Firestore に送るオブジェクトに checkedAt を含む', async () => {
    const ts = 1_700_000_000_000;
    const items: ShoppingItem[] = [
      { id: 'i2', name: '卵', isChecked: true, checkedAt: ts },
    ];

    await updateSharedMemoItems('share-1', items);

    const [updateArg] = mockDoc.update.mock.calls[0];
    const sent = updateArg.items[0];
    expect(sent.checkedAt).toBe(ts);
  });

  it('複数アイテムが混在しても各々正しく処理される', async () => {
    const ts = 1_700_000_000_000;
    const items: ShoppingItem[] = [
      { id: 'i1', name: 'パン', isChecked: false },
      { id: 'i2', name: 'バター', isChecked: true, checkedAt: ts },
    ];

    await updateSharedMemoItems('share-1', items);

    const [updateArg] = mockDoc.update.mock.calls[0];
    expect(Object.prototype.hasOwnProperty.call(updateArg.items[0], 'checkedAt')).toBe(false);
    expect(updateArg.items[1].checkedAt).toBe(ts);
  });
});

// ============================================================
// sanitizeLocation — updateSharedMemoLocations 経由で検証
// ============================================================
describe('sanitizeLocation (via updateSharedMemoLocations)', () => {
  it('address が undefined のとき、Firestore に送るオブジェクトに address を含まない', async () => {
    const locs: MemoLocation[] = [
      { id: 'l1', label: 'スーパー', latitude: 35.0, longitude: 139.0, radius: 200 },
    ];

    await updateSharedMemoLocations('share-1', locs);

    const [updateArg] = mockDoc.update.mock.calls[0];
    const sent = updateArg.locations[0];
    expect(Object.prototype.hasOwnProperty.call(sent, 'address')).toBe(false);
    expect(sent).toMatchObject({ id: 'l1', label: 'スーパー', latitude: 35.0, longitude: 139.0, radius: 200 });
  });

  it('address が設定されているとき、Firestore に送るオブジェクトに address を含む', async () => {
    const locs: MemoLocation[] = [
      { id: 'l2', label: 'コンビニ', latitude: 35.1, longitude: 139.1, radius: 100, address: '東京都渋谷区' },
    ];

    await updateSharedMemoLocations('share-1', locs);

    const [updateArg] = mockDoc.update.mock.calls[0];
    expect(updateArg.locations[0].address).toBe('東京都渋谷区');
  });
});

// ============================================================
// uploadSharedMemo — sanitize が set() に正しく適用されるか確認
// ============================================================
describe('uploadSharedMemo', () => {
  const baseMemo: Memo = {
    id: 'm1',
    title: 'テストメモ',
    items: [
      { id: 'i1', name: 'りんご', isChecked: false }, // checkedAt なし
    ],
    locations: [
      { id: 'l1', label: 'スーパー', latitude: 35.0, longitude: 139.0, radius: 200 }, // address なし
    ],
    notificationEnabled: true,
    createdAt: 1_700_000_000_000,
    updatedAt: 1_700_000_000_000,
  };

  it('新規共有: Firestore の add が呼ばれ、sanitize 済みデータが渡される', async () => {
    const shareId = await uploadSharedMemo(baseMemo, 'device-1');

    expect(shareId).toBe('mock-doc-id');
    const addArg = firestoreMock._mockCollection.add.mock.calls[0][0];
    expect(Object.prototype.hasOwnProperty.call(addArg.items[0], 'checkedAt')).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(addArg.locations[0], 'address')).toBe(false);
  });

  it('既存共有 (shareId あり): set が呼ばれる', async () => {
    const memoWithShare: Memo = { ...baseMemo, shareId: 'existing-share-id' };
    await uploadSharedMemo(memoWithShare, 'device-1');

    expect(mockDoc.set).toHaveBeenCalledTimes(1);
    expect(firestoreMock._mockCollection.add).not.toHaveBeenCalled();
  });
});

// ============================================================
// isPresenceActive
// ============================================================
describe('isPresenceActive', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('他デバイスが30秒以内に編集中のとき true を返す', () => {
    const now = Date.now();
    jest.setSystemTime(now);
    const presences = {
      'device-other': { deviceId: 'device-other', editingAt: now - 10_000 }, // 10秒前
    };
    expect(isPresenceActive(presences, 'device-mine')).toBe(true);
  });

  it('自分のプレゼンスのみのとき false を返す', () => {
    const now = Date.now();
    jest.setSystemTime(now);
    const presences = {
      'device-mine': { deviceId: 'device-mine', editingAt: now - 5_000 },
    };
    expect(isPresenceActive(presences, 'device-mine')).toBe(false);
  });

  it('他デバイスが30秒以上前に編集した場合は false を返す', () => {
    const now = Date.now();
    jest.setSystemTime(now);
    const presences = {
      'device-other': { deviceId: 'device-other', editingAt: now - 31_000 }, // 31秒前
    };
    expect(isPresenceActive(presences, 'device-mine')).toBe(false);
  });

  it('空のプレゼンスマップのとき false を返す', () => {
    expect(isPresenceActive({}, 'device-mine')).toBe(false);
  });

  it('複数デバイスのうち1つがアクティブなら true を返す', () => {
    const now = Date.now();
    jest.setSystemTime(now);
    const presences = {
      'device-a': { deviceId: 'device-a', editingAt: now - 35_000 }, // 期限切れ
      'device-b': { deviceId: 'device-b', editingAt: now - 5_000 },  // アクティブ
    };
    expect(isPresenceActive(presences, 'device-mine')).toBe(true);
  });
});
