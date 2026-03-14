/**
 * badgeService ユニットテスト
 * バッジ解除判定ロジックの正当性を検証する
 */
import { useSettingsStore, useMemoStore } from '../src/store/memoStore';
import {
  checkAndUnlockBadges,
  onMemoCreate,
  onItemComplete,
  onGeofenceVisit,
  onShareMemo,
  onAppLaunch,
} from '../src/services/badgeService';

// ============================================================
// ヘルパー: テスト前にストアをリセット
// ============================================================
beforeEach(() => {
  useMemoStore.setState({ memos: [] });
  useSettingsStore.setState({
    unlockedBadges: [],
    firstLaunchDate: Date.now(),
    lastLaunchDates: [],
    totalVisitCount: 0,
    visitedPlaceIds: [],
    totalItemsCompleted: 0,
    totalSharedMemos: 0,
    weekendVisitCount: 0,
    sharedItemsCompleted: 0,
  } as any);
});

// ============================================================
// onMemoCreate
// ============================================================
describe('onMemoCreate', () => {
  it('メモ1個作成で memo_first が解除される', () => {
    useMemoStore.getState().addMemo('テスト');
    const unlocked = onMemoCreate();
    expect(unlocked).toContain('memo_first');
  });

  it('メモ5個作成で memo_5 が解除される', () => {
    for (let i = 0; i < 5; i++) {
      useMemoStore.getState().addMemo(`メモ${i}`);
    }
    const unlocked = onMemoCreate();
    expect(unlocked).toContain('memo_5');
  });

  it('既に解除済みのバッジは再度返されない', () => {
    useMemoStore.getState().addMemo('テスト');
    onMemoCreate(); // 1回目で memo_first 解除
    const unlocked = onMemoCreate(); // 2回目
    expect(unlocked).not.toContain('memo_first');
  });
});

// ============================================================
// onItemComplete
// ============================================================
describe('onItemComplete', () => {
  it('初回アイテム完了で item_complete_first が解除される', () => {
    const unlocked = onItemComplete(1);
    expect(unlocked).toContain('item_complete_first');
  });

  it('50個完了で item_complete_50 が解除される', () => {
    // 49個分を事前セット
    useSettingsStore.setState({ totalItemsCompleted: 49 } as any);
    const unlocked = onItemComplete(1);
    expect(unlocked).toContain('item_complete_50');
  });

  it('100個完了で item_complete_100 が解除される', () => {
    useSettingsStore.setState({ totalItemsCompleted: 99 } as any);
    const unlocked = onItemComplete(1);
    expect(unlocked).toContain('item_complete_100');
  });

  it('共有メモでの完了で share_complete_10 がカウントされる', () => {
    useSettingsStore.setState({ sharedItemsCompleted: 9 } as any);
    const unlocked = onItemComplete(1, true);
    expect(unlocked).toContain('share_complete_10');
  });
});

// ============================================================
// onGeofenceVisit
// ============================================================
describe('onGeofenceVisit', () => {
  it('初回訪問で visit_first が解除される', () => {
    const unlocked = onGeofenceVisit('memo1:loc1');
    expect(unlocked).toContain('visit_first');
  });

  it('totalVisitCount がインクリメントされる', () => {
    onGeofenceVisit('memo1:loc1');
    expect(useSettingsStore.getState().totalVisitCount).toBe(1);
  });

  it('異なる場所を訪問すると visitedPlaceIds に追加される', () => {
    onGeofenceVisit('memo1:loc1');
    onGeofenceVisit('memo1:loc2');
    const placeIds = useSettingsStore.getState().visitedPlaceIds;
    expect(placeIds).toContain('memo1:loc1');
    expect(placeIds).toContain('memo1:loc2');
    expect(placeIds).toHaveLength(2);
  });

  it('同じ場所の再訪問で visitedPlaceIds が重複しない', () => {
    onGeofenceVisit('memo1:loc1');
    onGeofenceVisit('memo1:loc1');
    const placeIds = useSettingsStore.getState().visitedPlaceIds;
    expect(placeIds).toHaveLength(1);
  });
});

// ============================================================
// onShareMemo
// ============================================================
describe('onShareMemo', () => {
  it('初回共有で share_first が解除される', () => {
    const unlocked = onShareMemo();
    expect(unlocked).toContain('share_first');
  });

  it('5回共有で share_5 が解除される', () => {
    useSettingsStore.setState({ totalSharedMemos: 4 } as any);
    const unlocked = onShareMemo();
    expect(unlocked).toContain('share_5');
  });
});

// ============================================================
// onAppLaunch
// ============================================================
describe('onAppLaunch', () => {
  it('recordLaunchDate が呼ばれ lastLaunchDates が更新される', () => {
    onAppLaunch();
    const dates = useSettingsStore.getState().lastLaunchDates;
    expect(dates.length).toBeGreaterThan(0);
  });

  it('インストール365日後に hidden_anniversary が解除される', () => {
    const oneYearAgo = Date.now() - 366 * 24 * 60 * 60 * 1000;
    useSettingsStore.setState({ firstLaunchDate: oneYearAgo } as any);
    const unlocked = onAppLaunch();
    expect(unlocked).toContain('hidden_anniversary');
  });

  it('7日連続起動で hidden_streak が解除される', () => {
    const oneDay = 24 * 60 * 60 * 1000;
    // recordLaunchDate は today (0時ちょうど) を追加し .slice(-7) するので、
    // 今日を含む7日間を 0時ちょうどで用意する
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayMs = today.getTime();
    const dates: number[] = [];
    for (let i = 6; i >= 0; i--) {
      dates.push(todayMs - i * oneDay);
    }
    useSettingsStore.setState({ lastLaunchDates: dates } as any);
    const unlocked = onAppLaunch();
    expect(unlocked).toContain('hidden_streak');
  });
});

// ============================================================
// 二重解除防止
// ============================================================
describe('二重解除防止', () => {
  it('同じトリガーを2回呼んでも同じバッジは1回しか返されない', () => {
    useMemoStore.getState().addMemo('テスト');
    const first = onMemoCreate();
    const second = onMemoCreate();
    expect(first).toContain('memo_first');
    expect(second).not.toContain('memo_first');
  });
});
