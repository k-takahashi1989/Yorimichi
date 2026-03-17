/**
 * レビュー依頼の表示判定ユーティリティ
 *
 * トリガー条件:
 *   1. 全アイテム完了時（totalItemsCompleted >= 10）
 *   2. ジオフェンス通知タップ3回目（totalVisitCount === 3）
 *
 * 抑制条件:
 *   - 前回表示から90日未満
 */

const REVIEW_INTERVAL_DAYS = 90;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const MIN_ITEMS_COMPLETED = 10;
const VISIT_COUNT_TRIGGER = 3;

/**
 * レビュー依頼を表示すべきか判定する。
 * @returns true なら表示すべき
 */
export function shouldShowReviewPrompt(
  lastReviewPromptAt: number | null,
): boolean {
  if (lastReviewPromptAt == null) return true;
  const daysSinceLast = (Date.now() - lastReviewPromptAt) / ONE_DAY_MS;
  return daysSinceLast >= REVIEW_INTERVAL_DAYS;
}

/**
 * 全アイテム完了トリガー: 累計10個以上完了していれば対象。
 */
export function shouldTriggerOnAllItemsCompleted(
  totalItemsCompleted: number,
  lastReviewPromptAt: number | null,
): boolean {
  if (totalItemsCompleted < MIN_ITEMS_COMPLETED) return false;
  return shouldShowReviewPrompt(lastReviewPromptAt);
}

/**
 * 通知タップトリガー: ちょうど3回目のタップで対象。
 */
export function shouldTriggerOnVisit(
  totalVisitCount: number,
  lastReviewPromptAt: number | null,
): boolean {
  if (totalVisitCount !== VISIT_COUNT_TRIGGER) return false;
  return shouldShowReviewPrompt(lastReviewPromptAt);
}
