/**
 * ノート機能 ユニットテスト
 * メモの note フィールドの保存・共有時の送信を検証する
 */
import { useMemoStore } from '../src/store/memoStore';
import { uploadSharedMemo } from '../src/services/shareService';
import { Memo } from '../src/types';

const firestoreMock = require('@react-native-firebase/firestore');

beforeEach(() => {
  jest.clearAllMocks();
  useMemoStore.setState({ memos: [] });
  // auth をサインイン済み扱いにする
  const authMock = require('@react-native-firebase/auth');
  (authMock as jest.Mock).mockReturnValue({
    currentUser: { uid: 'test-uid' },
    signInAnonymously: jest.fn(),
    onAuthStateChanged: jest.fn(cb => { cb({ uid: 'test-uid' }); return () => {}; }),
  });
});

// ============================================================
// ストアでのノート保存
// ============================================================
describe('メモストア - note フィールド', () => {
  it('updateMemo で note を保存できる', () => {
    const memo = useMemoStore.getState().addMemo('ノートテスト');
    useMemoStore.getState().updateMemo(memo.id, { note: 'テストノート内容' });
    const updated = useMemoStore.getState().getMemoById(memo.id);
    expect(updated?.note).toBe('テストノート内容');
  });

  it('note を空文字で更新できる', () => {
    const memo = useMemoStore.getState().addMemo('ノートテスト2');
    useMemoStore.getState().updateMemo(memo.id, { note: 'メモ' });
    useMemoStore.getState().updateMemo(memo.id, { note: '' });
    const updated = useMemoStore.getState().getMemoById(memo.id);
    expect(updated?.note).toBe('');
  });

  it('note 未設定のメモは note が undefined', () => {
    const memo = useMemoStore.getState().addMemo('ノートなし');
    expect(memo.note).toBeUndefined();
  });
});

// ============================================================
// 共有時のノートフィールド
// ============================================================
describe('uploadSharedMemo - note フィールド', () => {
  const baseMemo: Memo = {
    id: 'm-note',
    title: 'ノート共有テスト',
    items: [{ id: 'i1', name: 'りんご', isChecked: false }],
    locations: [{ id: 'l1', label: 'スーパー', latitude: 35.0, longitude: 139.0, radius: 200 }],
    notificationEnabled: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  it('note がある場合、Firestore に note が含まれる', async () => {
    const memoWithNote: Memo = { ...baseMemo, note: '補足テキスト' };
    await uploadSharedMemo(memoWithNote, 'device-1');

    const addArg = firestoreMock._mockCollection.add.mock.calls[0][0];
    expect(addArg.note).toBe('補足テキスト');
  });

  it('note がない場合、Firestore に note フィールドが含まれない', async () => {
    await uploadSharedMemo(baseMemo, 'device-1');

    const addArg = firestoreMock._mockCollection.add.mock.calls[0][0];
    expect(Object.prototype.hasOwnProperty.call(addArg, 'note')).toBe(false);
  });
});
