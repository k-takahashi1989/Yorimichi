// ============================================================
// プラン上限設定
// ============================================================
// LIMITS_ENABLED = false の間は上限チェックをすべてスキップ（テスト中は全開放）
// サブスク実装時に true に変更し、isPremium で分岐する
//
// ── 収益化改善メモ ──────────────────────────────────────────
// 1. メモ数を 3 に絞ることでプレミアム転換率向上の可能性あり
//    → ただしユーザー離脱リスクとのバランスに注意
// 2. itemsPerMemo を無制限にしてユーザー定着を促進し、
//    locationsPerMemo の制限で課金動機を作る手法も検討
// 3. インタースティシャル広告の表示タイミング（useInterstitialAd.ts）を
//    地点追加時にも拡大して広告収益を改善
// 4. RevenueCat の Paywall テンプレートで A/B テスト実施を推奨
// 5. トライアル終了3日前にプッシュ通知リマインドで転換率向上
// ────────────────────────────────────────────────────────────

export const LIMITS_ENABLED = true;

/** 無料プランの上限値 */
export const FREE_LIMITS = {
  memos: 5,            // メモ数
  itemsPerMemo: 10,    // 1メモあたりのアイテム数
  locationsPerMemo: 2, // 1メモあたりの登録地点数
  collaborators: 1,    // 共有相手数（1対1まで）
} as const;

/** プレミアムプランの上限値（実質無制限だが安全キャップとして設定） */
export const PREMIUM_LIMITS = {
  memos: 1000,
  itemsPerMemo: 100,
  locationsPerMemo: 10,
  collaborators: 20,
} as const;

/**
 * 現在の isPremium に応じた登録地点上限を返す。
 * LIMITS_ENABLED=false の場合は PREMIUM_LIMITS を使用（開放状態）。
 */
export function getLocationsLimit(isPremium: boolean): number {
  if (!LIMITS_ENABLED) return PREMIUM_LIMITS.locationsPerMemo;
  return isPremium ? PREMIUM_LIMITS.locationsPerMemo : FREE_LIMITS.locationsPerMemo;
}

export function getMemosLimit(isPremium: boolean): number {
  if (!LIMITS_ENABLED) return PREMIUM_LIMITS.memos;
  return isPremium ? PREMIUM_LIMITS.memos : FREE_LIMITS.memos;
}

export function getItemsLimit(isPremium: boolean): number {
  if (!LIMITS_ENABLED) return PREMIUM_LIMITS.itemsPerMemo;
  return isPremium ? PREMIUM_LIMITS.itemsPerMemo : FREE_LIMITS.itemsPerMemo;
}

export function getCollaboratorsLimit(isPremium: boolean): number {
  if (!LIMITS_ENABLED) return PREMIUM_LIMITS.collaborators;
  return isPremium ? PREMIUM_LIMITS.collaborators : FREE_LIMITS.collaborators;
}
