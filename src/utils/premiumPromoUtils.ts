/**
 * プレミアムプロモーション表示判定ユーティリティ
 *
 * 初回起動から10日経過後、10日ごとにプレミアム提案モーダルを表示する。
 * 無料ユーザーのみ対象。
 */

const PROMO_INTERVAL_DAYS = 10;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/**
 * プロモモーダルを表示すべきかを判定する。
 * @param firstLaunchDate  初回起動日時 (Unix ms)
 * @param lastPremiumPromoAt  前回プロモ表示日時 (Unix ms | null)
 * @returns 表示すべき場合は利用日数、表示不要なら null
 */
export function shouldShowPremiumPromo(
  firstLaunchDate: number,
  lastPremiumPromoAt: number | null,
): number | null {
  const now = Date.now();
  const daysSinceLaunch = Math.floor((now - firstLaunchDate) / ONE_DAY_MS);

  // 10日未満は表示しない
  if (daysSinceLaunch < PROMO_INTERVAL_DAYS) return null;

  // 前回表示から10日未満は表示しない
  if (lastPremiumPromoAt != null) {
    const daysSinceLastPromo = Math.floor((now - lastPremiumPromoAt) / ONE_DAY_MS);
    if (daysSinceLastPromo < PROMO_INTERVAL_DAYS) return null;
  }

  return daysSinceLaunch;
}
