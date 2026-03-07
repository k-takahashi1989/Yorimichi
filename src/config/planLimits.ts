// ============================================================
// プラン上限設定
// ============================================================
// LIMITS_ENABLED = false の間は上限チェックをすべてスキップ（テスト中は全開放）
// サブスク実装時に true に変更し、isPremium で分岐する

export const LIMITS_ENABLED = false;

export const FREE_LIMITS = {
  memos: 5,            // メモ数
  itemsPerMemo: 10,    // 1メモあたりのアイテム数
  locationsPerMemo: 2, // 1メモあたりの登録地点数
  collaborators: 1,    // 共有相手数（1対1まで）
} as const;
