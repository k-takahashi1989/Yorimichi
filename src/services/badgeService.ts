/**
 * バッジ解除判定サービス
 *
 * 各トリガーポイントから呼ばれ、条件を満たしたバッジを解除する。
 * 解除されたバッジのIDリストを返す（UIで演出表示するため）。
 */
import { useSettingsStore } from '../store/memoStore';
import { useMemoStore } from '../store/memoStore';
import { BADGE_DEFINITIONS } from '../config/badgeDefinitions';

type CheckContext = {
  trigger: 'visit' | 'memo_create' | 'item_complete' | 'share' | 'app_launch';
  hour?: number;       // 訪問時刻 (0-23)
  dayOfWeek?: number;  // 曜日 (0=日, 6=土)
  placeId?: string;    // 訪問した地点ID
  isSharedMemo?: boolean;
};

/**
 * バッジ解除判定を実行し、新たに解除されたバッジIDリストを返す。
 */
export function checkAndUnlockBadges(context: CheckContext): string[] {
  const settings = useSettingsStore.getState();
  const memos = useMemoStore.getState().memos;
  const { unlockedBadges } = settings;
  const newlyUnlocked: string[] = [];

  const tryUnlock = (badgeId: string, condition: boolean) => {
    if (condition && !unlockedBadges.includes(badgeId)) {
      settings.unlockBadge(badgeId);
      newlyUnlocked.push(badgeId);
    }
  };

  // ── 訪問系 ─────────────────────────────────────
  if (context.trigger === 'visit') {
    tryUnlock('visit_first', settings.totalVisitCount >= 1);
    tryUnlock('visit_10',    settings.totalVisitCount >= 10);
    tryUnlock('visit_50',    settings.totalVisitCount >= 50);
    tryUnlock('visit_100',   settings.totalVisitCount >= 100);
    tryUnlock('visit_places_5',  settings.visitedPlaceIds.length >= 5);
    tryUnlock('visit_places_10', settings.visitedPlaceIds.length >= 10);
    tryUnlock('visit_places_20', settings.visitedPlaceIds.length >= 20);

    // 時間系
    if (context.hour !== undefined) {
      tryUnlock('time_night',   context.hour >= 23 || context.hour < 1);
      tryUnlock('time_morning', context.hour >= 6 && context.hour < 8);
    }
    tryUnlock('time_weekend_10', settings.weekendVisitCount >= 10);

    // 隠しバッジ: 深夜0時ちょうど
    if (context.hour !== undefined) {
      const now = new Date();
      tryUnlock('hidden_midnight', now.getHours() === 0 && now.getMinutes() < 5);
    }
  }

  // ── メモ系 ─────────────────────────────────────
  if (context.trigger === 'memo_create') {
    const memoCount = memos.length;
    tryUnlock('memo_first', memoCount >= 1);
    tryUnlock('memo_5',     memoCount >= 5);
  }

  // ── アイテム完了系 ─────────────────────────────
  if (context.trigger === 'item_complete') {
    tryUnlock('item_complete_first', settings.totalItemsCompleted >= 1);
    tryUnlock('item_complete_50',    settings.totalItemsCompleted >= 50);
    tryUnlock('item_complete_100',   settings.totalItemsCompleted >= 100);

    // 1メモに10個以上のアイテム
    const hasFullList = memos.some(m => m.items.length >= 10);
    tryUnlock('memo_full_list', hasFullList);

    // 共有メモでの完了
    if (context.isSharedMemo) {
      tryUnlock('share_complete_10', settings.sharedItemsCompleted >= 10);
    }
  }

  // ── 共有系 ─────────────────────────────────────
  if (context.trigger === 'share') {
    tryUnlock('share_first', settings.totalSharedMemos >= 1);
    tryUnlock('share_5',     settings.totalSharedMemos >= 5);

    // 3人以上参加の共有メモがあるか（collaboratorUids は Firestore 側なのでローカルでは未チェック）
    // → joinSharedMemo で collaborators.length を見る形で別途対応
  }

  // ── アプリ起動時 ───────────────────────────────
  if (context.trigger === 'app_launch') {
    // hidden_anniversary: 初回起動から365日後
    const daysSinceLaunch = (Date.now() - settings.firstLaunchDate) / (1000 * 60 * 60 * 24);
    tryUnlock('hidden_anniversary', daysSinceLaunch >= 365);

    // hidden_streak: 7日連続起動
    const dates = settings.lastLaunchDates;
    if (dates.length >= 7) {
      const sorted = [...dates].sort((a, b) => b - a);
      const oneDay = 24 * 60 * 60 * 1000;
      let consecutive = true;
      for (let i = 0; i < 6; i++) {
        if (sorted[i] - sorted[i + 1] !== oneDay) {
          consecutive = false;
          break;
        }
      }
      tryUnlock('hidden_streak', consecutive);
    }
  }

  return newlyUnlocked;
}

/**
 * 訪問トリガー: ジオフェンス到着/出発時に呼ぶ。
 * placeId は "memoId:locationId" 形式。
 */
export function onGeofenceVisit(placeId: string): string[] {
  const settings = useSettingsStore.getState();
  const now = new Date();
  const dayOfWeek = now.getDay();
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

  settings.incrementVisitCount(placeId);
  if (isWeekend) settings.incrementWeekendVisits();

  return checkAndUnlockBadges({
    trigger: 'visit',
    hour: now.getHours(),
    dayOfWeek,
    placeId,
  });
}

/**
 * メモ作成トリガー
 */
export function onMemoCreate(): string[] {
  return checkAndUnlockBadges({ trigger: 'memo_create' });
}

/**
 * アイテム完了トリガー
 */
export function onItemComplete(count: number = 1, isSharedMemo: boolean = false): string[] {
  const settings = useSettingsStore.getState();
  settings.incrementItemsCompleted(count);
  if (isSharedMemo) settings.incrementSharedItemsCompleted(count);
  return checkAndUnlockBadges({ trigger: 'item_complete', isSharedMemo });
}

/**
 * 共有実行トリガー
 */
export function onShareMemo(): string[] {
  const settings = useSettingsStore.getState();
  settings.incrementSharedMemos();
  return checkAndUnlockBadges({ trigger: 'share' });
}

/**
 * アプリ起動時トリガー
 */
export function onAppLaunch(): string[] {
  const settings = useSettingsStore.getState();
  settings.recordLaunchDate();
  return checkAndUnlockBadges({ trigger: 'app_launch' });
}
