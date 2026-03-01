/**
 * 新機能ユニットテスト
 * #13 全チェック時のリマインダー自動無効化
 * #32 スワイプ削除の undo (restoreMemo)
 * #36 場所検索履歴 (addRecentPlace)
 * #37 全チェック解除 (uncheckAllItems)
 */
import { useMemoStore, useSettingsStore } from '../src/store/memoStore';
import { RecentPlace } from '../src/types';

// ============================================================
// ヘルパー: テスト前にストアをリセット
// ============================================================
beforeEach(() => {
  useMemoStore.setState({ memos: [] });
  useSettingsStore.setState({
    defaultRadius: 200,
    recentPlaces: [],
  } as any);
});

// ============================================================
// #32  restoreMemo — スワイプ削除 undo
// ============================================================
describe('#32 restoreMemo', () => {
  it('削除したメモをリストの先頭に復元できる', () => {
    const memo = useMemoStore.getState().addMemo('買い物リスト');
    useMemoStore.getState().addMemo('サブリスト');
    useMemoStore.getState().deleteMemo(memo.id);

    expect(useMemoStore.getState().memos).toHaveLength(1);

    useMemoStore.getState().restoreMemo(memo);

    const memos = useMemoStore.getState().memos;
    expect(memos).toHaveLength(2);
    expect(memos[0].id).toBe(memo.id); // 先頭に復元される
  });

  it('空リストに復元しても先頭に来る', () => {
    const memo = useMemoStore.getState().addMemo('単独メモ');
    useMemoStore.getState().deleteMemo(memo.id);
    useMemoStore.getState().restoreMemo(memo);

    const memos = useMemoStore.getState().memos;
    expect(memos).toHaveLength(1);
    expect(memos[0].title).toBe('単独メモ');
  });

  it('復元後にメモの内容（アイテム等）が保持される', () => {
    const memo = useMemoStore.getState().addMemo('アイテム付きメモ');
    useMemoStore.getState().addItem(memo.id, '牛乳');
    useMemoStore.getState().addItem(memo.id, '卵');
    const snapshot = useMemoStore.getState().getMemoById(memo.id)!;

    useMemoStore.getState().deleteMemo(memo.id);
    useMemoStore.getState().restoreMemo(snapshot);

    const restored = useMemoStore.getState().getMemoById(memo.id);
    expect(restored?.items).toHaveLength(2);
    expect(restored?.items[0].name).toBe('牛乳');
  });
});

// ============================================================
// #13  autoDisabledNotification — 全チェック時の自動無効化
// ============================================================
describe('#13 autoDisabledNotification', () => {
  it('updateMemo で autoDisabledNotification を true にできる', () => {
    const memo = useMemoStore.getState().addMemo('通知テスト');

    useMemoStore.getState().updateMemo(memo.id, {
      notificationEnabled: false,
      autoDisabledNotification: true,
    });

    const updated = useMemoStore.getState().getMemoById(memo.id);
    expect(updated?.notificationEnabled).toBe(false);
    expect(updated?.autoDisabledNotification).toBe(true);
  });

  it('手動で通知をOFFにした場合は autoDisabledNotification が false のまま', () => {
    const memo = useMemoStore.getState().addMemo('手動OFF');

    useMemoStore.getState().updateMemo(memo.id, { notificationEnabled: false });

    const updated = useMemoStore.getState().getMemoById(memo.id);
    expect(updated?.notificationEnabled).toBe(false);
    // autoDisabledNotification は指定していないので undefined
    expect(updated?.autoDisabledNotification).toBeFalsy();
  });
});

// ============================================================
// #37  uncheckAllItems — 全チェック解除
// ============================================================
describe('#37 uncheckAllItems', () => {
  let memoId: string;

  beforeEach(() => {
    const memo = useMemoStore.getState().addMemo('解除テスト');
    memoId = memo.id;
    useMemoStore.getState().addItem(memoId, '品目A');
    useMemoStore.getState().addItem(memoId, '品目B');
    useMemoStore.getState().addItem(memoId, '品目C');
    // 全アイテムをチェック
    const items = useMemoStore.getState().getMemoById(memoId)!.items;
    items.forEach(it => useMemoStore.getState().toggleItem(memoId, it.id));
  });

  it('全アイテムのチェックが外れる', () => {
    useMemoStore.getState().uncheckAllItems(memoId);

    const memo = useMemoStore.getState().getMemoById(memoId);
    expect(memo?.items.every(it => !it.isChecked)).toBe(true);
  });

  it('autoDisabledNotification が true のとき通知を再ONにする', () => {
    // 自動OFFをシミュレート
    useMemoStore.getState().updateMemo(memoId, {
      notificationEnabled: false,
      autoDisabledNotification: true,
    });

    useMemoStore.getState().uncheckAllItems(memoId);

    const memo = useMemoStore.getState().getMemoById(memoId);
    expect(memo?.notificationEnabled).toBe(true);
    expect(memo?.autoDisabledNotification).toBe(false);
  });

  it('手動OFFの場合は解除後も通知OFF のまま', () => {
    // 手動OFFをシミュレート（autoDisabledNotification は false）
    useMemoStore.getState().updateMemo(memoId, {
      notificationEnabled: false,
    });

    useMemoStore.getState().uncheckAllItems(memoId);

    const memo = useMemoStore.getState().getMemoById(memoId);
    expect(memo?.notificationEnabled).toBe(false);
    expect(memo?.autoDisabledNotification).toBe(false);
  });

  it('チェックなしの状態で呼び出しても副作用なし', () => {
    // 一度全解除してから再度呼ぶ
    useMemoStore.getState().uncheckAllItems(memoId);
    useMemoStore.getState().uncheckAllItems(memoId);

    const memo = useMemoStore.getState().getMemoById(memoId);
    expect(memo?.items.every(it => !it.isChecked)).toBe(true);
  });
});

// ============================================================
// #36  addRecentPlace — 場所検索履歴
// ============================================================
describe('#36 addRecentPlace', () => {
  const samplePlace = (label: string): RecentPlace => ({
    label,
    latitude: 35.6812,
    longitude: 139.7671,
  });

  it('場所を追加できる', () => {
    useSettingsStore.getState().addRecentPlace(samplePlace('スーパー三和'));

    const { recentPlaces } = useSettingsStore.getState();
    expect(recentPlaces).toHaveLength(1);
    expect(recentPlaces[0].label).toBe('スーパー三和');
  });

  it('最新の場所が先頭に来る', () => {
    useSettingsStore.getState().addRecentPlace(samplePlace('場所A'));
    useSettingsStore.getState().addRecentPlace(samplePlace('場所B'));

    const { recentPlaces } = useSettingsStore.getState();
    expect(recentPlaces[0].label).toBe('場所B');
    expect(recentPlaces[1].label).toBe('場所A');
  });

  it('同じラベルを追加すると重複排除して先頭に移動する', () => {
    useSettingsStore.getState().addRecentPlace(samplePlace('コンビニ'));
    useSettingsStore.getState().addRecentPlace(samplePlace('スーパー'));
    useSettingsStore.getState().addRecentPlace(samplePlace('コンビニ')); // 再追加

    const { recentPlaces } = useSettingsStore.getState();
    expect(recentPlaces).toHaveLength(2); // 重複しない
    expect(recentPlaces[0].label).toBe('コンビニ'); // 先頭に移動
  });

  it('最大10件を超えると古いものが削除される', () => {
    for (let i = 1; i <= 11; i++) {
      useSettingsStore.getState().addRecentPlace(samplePlace(`場所${i}`));
    }

    const { recentPlaces } = useSettingsStore.getState();
    expect(recentPlaces).toHaveLength(10);
    expect(recentPlaces[0].label).toBe('場所11');
    // 最古の「場所1」は削除されている
    expect(recentPlaces.find(p => p.label === '場所1')).toBeUndefined();
  });

  it('address フィールドがあれば保存される', () => {
    useSettingsStore.getState().addRecentPlace({
      label: '東京駅',
      latitude: 35.6812,
      longitude: 139.7671,
      address: '東京都千代田区丸の内1丁目',
    });

    const place = useSettingsStore.getState().recentPlaces[0];
    expect(place.address).toBe('東京都千代田区丸の内1丁目');
  });
});
