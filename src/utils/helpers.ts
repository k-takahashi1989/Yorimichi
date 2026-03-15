/**
 * 2点間のハーバーサイン距離を計算する (メートル単位)
 */
export function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371000; // 地球の半径 (m)
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * ユニークな ID を生成する (UUID v4 形式)
 *
 * crypto.getRandomValues() が利用可能な場合は暗号学的に安全な乱数を使用し、
 * 利用不可な環境（古い Hermes 等）では Math.random() にフォールバックする。
 * shareId として Firestore ドキュメント ID に使われるケースがあるため、
 * 可能な限り予測困難な ID を生成する。
 */
export function generateId(): string {
  // crypto.getRandomValues が利用可能なら安全な乱数を使用
  if (typeof globalThis.crypto !== 'undefined' && typeof globalThis.crypto.getRandomValues === 'function') {
    const bytes = new Uint8Array(16);
    globalThis.crypto.getRandomValues(bytes);
    // UUID v4 のバージョン・バリアントビットを設定
    bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
    bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 1
    const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }
  // フォールバック: Math.random()
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

/**
 * 期日のステータスを判定する
 * MemoListScreen と MemoDetailScreen で重複していたロジックを共通化。
 */
export type DueDateStatus = 'overdue' | 'today' | 'upcoming';

export interface DueDateInfo {
  status: DueDateStatus;
  dateStr: string; // "M/D" 形式
}

export function getDueDateInfo(dueDate: number): DueDateInfo {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const due = new Date(dueDate);
  const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate()).getTime();
  const dateStr = `${due.getMonth() + 1}/${due.getDate()}`;

  let status: DueDateStatus;
  if (dueDay < today) {
    status = 'overdue';
  } else if (dueDay === today) {
    status = 'today';
  } else {
    status = 'upcoming';
  }

  return { status, dateStr };
}
