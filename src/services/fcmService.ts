/**
 * FCM Service — Firebase Cloud Messaging によるリモートプッシュ通知
 *
 * 新規依存パッケージ（要 npm install）:
 *   @react-native-firebase/messaging
 *   @react-native-firebase/functions
 *
 * 機能:
 * - FCM トークンの登録・リフレッシュ
 * - 共有メモ更新通知の送信 (Cloud Function 呼び出し)
 * - FCM メッセージの受信ハンドラー
 */
import { Platform } from 'react-native';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import messaging from '@react-native-firebase/messaging';
import { getDeviceId } from '../utils/deviceId';
import { recordError } from './crashlyticsService';
import { ensureSignedIn } from './shareService';

const CLOUD_FUNCTION_URL =
  'https://asia-northeast1-yorimichi-app-dev.cloudfunctions.net/notifyCollaborators';

// ============================================================
// FCM トークン登録
// ============================================================

/**
 * FCM トークンを取得し、Firestore の deviceTokens コレクションに保存する。
 * アプリ起動時に呼ぶ。
 */
export async function registerFcmToken(): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    const user = auth().currentUser;
    if (!user) return;
    const token = await messaging().getToken();
    if (!token) return;
    await firestore().collection('deviceTokens').doc(user.uid).set({
      token,
      deviceId: getDeviceId(),
      updatedAt: Date.now(),
      platform: 'android',
    });
  } catch (e) {
    recordError(e, '[fcmService] registerFcmToken');
  }
}

/**
 * トークンリフレッシュリスナーを登録する。
 * トークンが更新されたら自動的に Firestore を更新。
 */
export function listenTokenRefresh(): () => void {
  return messaging().onTokenRefresh(async (token) => {
    try {
      const user = auth().currentUser;
      if (!user || !token) return;
      await firestore().collection('deviceTokens').doc(user.uid).set({
        token,
        deviceId: getDeviceId(),
        updatedAt: Date.now(),
        platform: 'android',
      });
    } catch (e) {
      recordError(e, '[fcmService] onTokenRefresh');
    }
  });
}

// ============================================================
// 共有メモ更新通知の送信
// ============================================================

const COOLDOWN_MS = 60 * 1000; // 1分

// クライアント側クールダウン管理
const lastNotifiedMap = new Map<string, number>();

/**
 * 共有メモの更新を共有相手に通知する。
 * Cloud Function `notifyCollaborators` を呼び出す。
 *
 * @returns 'ok' | 'cooldown' | 'error'
 */
export type NotifyResult =
  | { status: 'ok' }
  | { status: 'cooldown' }
  | { status: 'error'; detail: string };

export async function notifySharedMemoUpdate(
  shareId: string,
  memoTitle: string,
): Promise<NotifyResult> {
  // クライアント側クールダウン
  const lastTime = lastNotifiedMap.get(shareId) ?? 0;
  const now = Date.now();
  if (now - lastTime < COOLDOWN_MS) {
    return { status: 'cooldown' };
  }

  try {
    await ensureSignedIn();
    const user = auth().currentUser;
    if (!user) {
      return { status: 'error', detail: 'Not signed in after ensureSignedIn' };
    }
    // ID トークンを取得して fetch で直接呼び出す
    const idToken = await user.getIdToken(true);
    const resp = await fetch(CLOUD_FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({ data: { shareId, memoTitle } }),
    });
    const body = await resp.json();
    if (!resp.ok) {
      const errCode = body?.error?.status ?? `HTTP${resp.status}`;
      const errMsg = body?.error?.message ?? resp.statusText;
      throw { code: errCode, message: errMsg };
    }
    lastNotifiedMap.set(shareId, now);
    return { status: 'ok' };
  } catch (e: any) {
    const code: string = e?.code ?? '';
    const msg: string = e?.message ?? String(e);
    console.error('[NOTIFY_DEBUG] code=', code, 'msg=', msg, 'raw=', JSON.stringify(e, Object.getOwnPropertyNames(e)));
    if (code === 'functions/resource-exhausted') {
      lastNotifiedMap.set(shareId, now);
      return { status: 'cooldown' };
    }
    recordError(e, `[fcmService] notifySharedMemoUpdate code=${code}`);
    return { status: 'error', detail: `${code} ${msg}` };
  }
}

/**
 * 特定の shareId に対するクールダウン残り秒数を返す。0 なら送信可能。
 */
export function getCooldownRemaining(shareId: string): number {
  const lastTime = lastNotifiedMap.get(shareId) ?? 0;
  const elapsed = Date.now() - lastTime;
  return Math.max(0, Math.ceil((COOLDOWN_MS - elapsed) / 1000));
}

// ============================================================
// FCM メッセージ受信ハンドラー
// ============================================================

/**
 * フォアグラウンドでの FCM メッセージ受信リスナーを登録する。
 */
export function onForegroundMessage(
  callback: (data: Record<string, string>) => void,
): () => void {
  return messaging().onMessage(async (remoteMessage) => {
    const data = (remoteMessage.data ?? {}) as Record<string, string>;
    callback(data);
  });
}

/**
 * バックグラウンド/killed 状態での FCM メッセージ受信ハンドラーを登録する。
 * index.js で呼ぶ。
 */
export function setBackgroundMessageHandler(): void {
  messaging().setBackgroundMessageHandler(async (_remoteMessage) => {
    // Cloud Function が notification フィールド付きで送信するため、
    // Android は自動的に通知を表示する。追加処理は不要。
  });
}
