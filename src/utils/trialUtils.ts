/** 7日間トライアルのユーティリティ */

export const TRIAL_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7日間 (ms)

/**
 * トライアルが現在有効かどうか判定する
 * @param trialStartDate  開始日時 (Unix ms)。null の場合は未開始として false を返す
 */
export function isTrialActive(trialStartDate: number | null): boolean {
  if (trialStartDate === null) return false;
  return Date.now() - trialStartDate < TRIAL_DURATION_MS;
}

/**
 * トライアルの残り日数を返す（切り上げ、最小0）
 * @param trialStartDate  開始日時 (Unix ms)
 */
export function trialDaysRemaining(trialStartDate: number | null): number {
  if (trialStartDate === null) return 0;
  const msLeft = TRIAL_DURATION_MS - (Date.now() - trialStartDate);
  if (msLeft <= 0) return 0;
  return Math.ceil(msLeft / (24 * 60 * 60 * 1000));
}
