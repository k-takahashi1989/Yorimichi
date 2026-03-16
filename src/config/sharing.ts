// ============================================================
// 共有リンク設定
// ============================================================
// Firebase Hosting の URL。プロジェクト初期化後に実際のドメインへ変更する。
export const SHARE_BASE_URL = 'https://yorimichi-app.web.app/share';

/**
 * shareId から共有用の HTTPS リンクを生成する。
 */
export function buildShareUrl(shareId: string): string {
  return `${SHARE_BASE_URL}?id=${encodeURIComponent(shareId)}`;
}
