/**
 * 新機能ユニットテスト
 * #13 全チェック時のリマインダー自動無効化
 * #32 スワイプ削除の undo (restoreMemo)
 * #36 場所検索履歴 (addRecentPlace)
 * #37 全チェック解除 (uncheckAllItems)
 * Fix#3 updateMemo でアイテム一括更新（sync/checkState push 用）
 * Fix#4 pendingNotificationMemoId via MMKV
 * Fix#GeofenceCap  MAX_GEOFENCES 定数 上限 100 件
 * planLimits     プラン上限ゲッター・ LIMITS_ENABLED 有効化
 * Fix#LocSync    addLocation 上限・共有メモ isOwner フラグ
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

// ============================================================
// Fix#3  updateMemo — items / locations の部分更新（sync 用）
// ============================================================
describe('Fix#3 updateMemo で items を一括更新', () => {
  it('items を指定すれば既存アイテムが丸ごと置き換わる', () => {
    const memo = useMemoStore.getState().addMemo('syncTest');
    useMemoStore.getState().addItem(memo.id, '牛乳');
    useMemoStore.getState().addItem(memo.id, '卵');

    const newItems = [
      { id: 'x1', name: 'パン', isChecked: true, checkedAt: 1000 },
    ];
    useMemoStore.getState().updateMemo(memo.id, { items: newItems });

    const updated = useMemoStore.getState().getMemoById(memo.id);
    expect(updated?.items).toHaveLength(1);
    expect(updated?.items[0].name).toBe('パン');
    expect(updated?.items[0].isChecked).toBe(true);
  });

  it('items を省略すれば既存アイテムはそのまま', () => {
    const memo = useMemoStore.getState().addMemo('keepItems');
    useMemoStore.getState().addItem(memo.id, '醤油');

    useMemoStore.getState().updateMemo(memo.id, { title: '変更後' });

    const updated = useMemoStore.getState().getMemoById(memo.id);
    expect(updated?.title).toBe('変更後');
    expect(updated?.items).toHaveLength(1);
    expect(updated?.items[0].name).toBe('醤油');
  });

  it('チェック状態が items に保持されたまま updateMemo で保存できる', () => {
    const memo = useMemoStore.getState().addMemo('checkStateSync');
    useMemoStore.getState().addItem(memo.id, 'トマト');
    const item = useMemoStore.getState().getMemoById(memo.id)!.items[0];

    // チェック ON
    useMemoStore.getState().toggleItem(memo.id, item.id);
    const checkedItem = useMemoStore.getState().getMemoById(memo.id)!.items[0];
    expect(checkedItem.isChecked).toBe(true);

    // この items を Firestore に push する想定でそのまま updateMemo
    const snapshot = useMemoStore.getState().getMemoById(memo.id)!.items;
    useMemoStore.getState().updateMemo(memo.id, { items: snapshot });
    const final = useMemoStore.getState().getMemoById(memo.id)!.items[0];
    expect(final.isChecked).toBe(true);
  });
});

// ============================================================
// Fix#4  pendingNotificationMemoId — MMKV 経由の通知遷移
// ============================================================
describe('Fix#4 MMKV pendingNotificationMemoId', () => {
  const { storage } = require('../src/storage/mmkvStorage');

  beforeEach(() => {
    storage.remove('pendingNotificationMemoId');
  });

  it('set → getString で同じ値が取れる', () => {
    storage.set('pendingNotificationMemoId', 'memo-abc-123');
    expect(storage.getString('pendingNotificationMemoId')).toBe('memo-abc-123');
  });

  it('remove 後は getString が undefined を返す', () => {
    storage.set('pendingNotificationMemoId', 'memo-abc-123');
    storage.remove('pendingNotificationMemoId');
    expect(storage.getString('pendingNotificationMemoId')).toBeUndefined();
  });

  it('キーが存在しない場合は getString が undefined を返す', () => {
    expect(storage.getString('pendingNotificationMemoId')).toBeUndefined();
  });
});
// ============================================================
// Fix#GeofenceCap  MAX_GEOFENCES 定数
// ============================================================
describe('Fix#GeofenceCap MAX_GEOFENCES 定数', () => {
  it('MAX_GEOFENCES は 100 である', () => {
    // Android GeofencingClient のハードリミットと一致していることを確認
    const { MAX_GEOFENCES } = require('../src/services/geofenceService');
    expect(MAX_GEOFENCES).toBe(100);
  });
});

// ============================================================
// planLimits  プラン上限ゲッター (LIMITS_ENABLED = true)
// ============================================================
describe('planLimits ゲッター', () => {
  const {
    LIMITS_ENABLED,
    FREE_LIMITS,
    PREMIUM_LIMITS,
    getLocationsLimit,
    getMemosLimit,
    getItemsLimit,
    getCollaboratorsLimit,
  } = require('../src/config/planLimits');

  it('LIMITS_ENABLED が true であること', () => {
    expect(LIMITS_ENABLED).toBe(true);
  });

  it('getLocationsLimit: 無料=2, プレミアム=10', () => {
    expect(getLocationsLimit(false)).toBe(FREE_LIMITS.locationsPerMemo);    // 2
    expect(getLocationsLimit(true)).toBe(PREMIUM_LIMITS.locationsPerMemo);  // 10
  });

  it('getMemosLimit: 無料=5, プレミアム=1000', () => {
    expect(getMemosLimit(false)).toBe(FREE_LIMITS.memos);    // 5
    expect(getMemosLimit(true)).toBe(PREMIUM_LIMITS.memos);  // 1000
  });

  it('getItemsLimit: 無料=10, プレミアム=100', () => {
    expect(getItemsLimit(false)).toBe(FREE_LIMITS.itemsPerMemo);    // 10
    expect(getItemsLimit(true)).toBe(PREMIUM_LIMITS.itemsPerMemo);  // 100
  });

  it('getCollaboratorsLimit: 無料=1, プレミアム=20', () => {
    expect(getCollaboratorsLimit(false)).toBe(FREE_LIMITS.collaborators);    // 1
    expect(getCollaboratorsLimit(true)).toBe(PREMIUM_LIMITS.collaborators);  // 20
  });
});

// ============================================================
// Fix#LocSync  addLocation 上限 / 共有メモ isOwner フラグ
// ============================================================
describe('Fix#LocSync addLocation 上限チェック', () => {
  beforeEach(() => {
    useSettingsStore.setState({ isPremium: false } as any);
  });

  it('無料プランは地点を 2 件まで追加できる（3件目は null）', () => {
    const memo = useMemoStore.getState().addMemo('地点テスト');
    const loc1 = useMemoStore.getState().addLocation(memo.id, {
      label: '場所A', latitude: 35.0, longitude: 135.0, radius: 200,
    });
    const loc2 = useMemoStore.getState().addLocation(memo.id, {
      label: '場所B', latitude: 35.1, longitude: 135.1, radius: 200,
    });
    const loc3 = useMemoStore.getState().addLocation(memo.id, {
      label: '場所C', latitude: 35.2, longitude: 135.2, radius: 200,
    });
    expect(loc1).not.toBeNull();
    expect(loc2).not.toBeNull();
    expect(loc3).toBeNull(); // 上限超過
    expect(useMemoStore.getState().getMemoById(memo.id)?.locations).toHaveLength(2);
  });

  it('プレミアムプランは 3 件以上追加できる', () => {
    useSettingsStore.setState({ isPremium: true } as any);
    const memo = useMemoStore.getState().addMemo('プレミアム地点テスト');
    for (let i = 0; i < 5; i++) {
      useMemoStore.getState().addLocation(memo.id, {
        label: `場所${i}`, latitude: 35.0 + i * 0.01, longitude: 135.0, radius: 200,
      });
    }
    expect(useMemoStore.getState().getMemoById(memo.id)?.locations).toHaveLength(5);
  });
});

describe('Fix#LocSync 共有メモ isOwner フラグ', () => {
  it('importSharedMemo は isOwner=false を設定する', () => {
    const memo = useMemoStore.getState().importSharedMemo(
      { title: '共有テスト', items: [], locations: [] },
      'share-abc-123',
    );
    expect(memo.isOwner).toBe(false);
    expect(memo.shareId).toBe('share-abc-123');
    const stored = useMemoStore.getState().getMemoById(memo.id);
    expect(stored?.isOwner).toBe(false);
    expect(stored?.shareId).toBe('share-abc-123');
  });

  it('setMemoShareId でオーナーフラグが true になる', () => {
    const memo = useMemoStore.getState().addMemo('オーナーテスト');
    useMemoStore.getState().setMemoShareId(memo.id, 'share-def-456', true);
    const updated = useMemoStore.getState().getMemoById(memo.id);
    expect(updated?.shareId).toBe('share-def-456');
    expect(updated?.isOwner).toBe(true);
  });

  it('setMemoShareId でコラボレーターフラグが false になる', () => {
    const memo = useMemoStore.getState().addMemo('コラボテスト');
    useMemoStore.getState().setMemoShareId(memo.id, 'share-ghi-789', false);
    const updated = useMemoStore.getState().getMemoById(memo.id);
    expect(updated?.isOwner).toBe(false);
  });

  it('updateMemo で locations を上書きできる（sync 時の地点マージ用）', () => {
    const memo = useMemoStore.getState().addMemo('地点syncテスト');
    useMemoStore.getState().addLocation(memo.id, {
      label: '旧場所', latitude: 35.0, longitude: 135.0, radius: 200,
    });
    const newLocs = [
      { id: 'loc-new', label: '新場所', latitude: 36.0, longitude: 136.0, radius: 300 },
    ];
    useMemoStore.getState().updateMemo(memo.id, { locations: newLocs });
    const updated = useMemoStore.getState().getMemoById(memo.id);
    expect(updated?.locations).toHaveLength(1);
    expect(updated?.locations[0].label).toBe('新場所');
  });
});