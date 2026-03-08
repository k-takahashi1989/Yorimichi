/**
 * Geofence Service — Android ネイティブ GeofencingClient 版
 *
 * react-native-background-actions のポーリング方式を廃止し、
 * Android の GeofencingClient（Google Play Services）をネイティブモジュール
 * (YorimichiGeofence) 経由で使用することでバッテリー消費を大幅削減。
 *
 * 通知発行は GeofenceTransitionReceiver.kt が行うため、
 * アプリが killed 状態でも確実に届く。
 */
import { NativeModules, Platform } from 'react-native';
import i18n from '../i18n';
import { Memo } from '../types';
import { storage } from '../storage/mmkvStorage';

// NativeModule: YorimichiGeofence (GeofenceModule.kt の getName() と一致)
const YorimichiGeofence = NativeModules.YorimichiGeofence as {
  syncGeofences: (json: string) => Promise<void>;
  removeGeofencesForMemo: (memoId: string) => Promise<void>;
  clearAll: () => Promise<void>;
} | undefined;

const MONITORING_KEY = 'geofence_monitoring_active';

/** Android GeofencingClient のハードリミット（1アプリあたり最大100件） */
export const MAX_GEOFENCES = 100;

// ============================================================
// ストアからメモを読み込む
// ============================================================
function loadMemos(): Memo[] {
  try {
    const raw = storage.getString('memos');
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return parsed?.state?.memos ?? [];
  } catch {
    return [];
  }
}

// ============================================================
// ジオフェンスエントリ構築（通知文言を JS で生成して Kotlin に渡す）
// ============================================================
interface GeofenceEntry {
  id: string;
  latitude: number;
  longitude: number;
  radius: number;
  memoId: string;
  notifTitle: string;
  notifBody: string;
  notificationMode: string;
}

function buildEntries(memos: Memo[]): GeofenceEntry[] {
  const entries: GeofenceEntry[] = [];
  for (const memo of memos) {
    if (!memo.notificationEnabled) continue;
    for (const loc of memo.locations) {
      const itemCount = memo.items.filter(it => !it.isChecked).length;
      entries.push({
        id: `${memo.id}:${loc.id}`,
        latitude: loc.latitude,
        longitude: loc.longitude,
        radius: loc.radius,
        memoId: memo.id,
        notifTitle: i18n.t('notification.arrivalTitle', { label: loc.label }),
        notifBody: i18n.t('notification.arrivalBody', {
          title: memo.title,
          count: itemCount,
        }),
        notificationMode: memo.notificationMode ?? 'push',
      });
    }
  }
  return entries.slice(0, MAX_GEOFENCES);
}

// ============================================================
// 公開 API
// ============================================================

/** 現在ジオフェンス監視が有効かどうか */
export function isGeofencingActive(): boolean {
  return storage.getBoolean(MONITORING_KEY) ?? false;
}

/**
 * MMKV からメモを読み込み、ネイティブジオフェンスを全同期して監視を開始する。
 * App.tsx の起動時・権限取得後・SettingsScreen のトグル ON 時に呼ぶ。
 */
export async function startGeofenceMonitoring(): Promise<boolean> {
  if (Platform.OS !== 'android' || !YorimichiGeofence) return false;
  try {
    const memos = loadMemos();
    const entries = buildEntries(memos);
    await YorimichiGeofence.syncGeofences(JSON.stringify(entries));
    storage.set(MONITORING_KEY, true);
    return true;
  } catch (e) {
    __DEV__ && console.warn('[GeofenceService] startGeofenceMonitoring failed:', e);
    return false;
  }
}

/**
 * 全ジオフェンスを削除して監視を停止する。
 */
export async function stopGeofenceMonitoring(): Promise<void> {
  if (Platform.OS !== 'android' || !YorimichiGeofence) return;
  try {
    await YorimichiGeofence.clearAll();
  } catch (e) {
    __DEV__ && console.warn('[GeofenceService] stopGeofenceMonitoring failed:', e);
  } finally {
    storage.set(MONITORING_KEY, false);
  }
}

/**
 * 監視が有効な場合、全ジオフェンスを再同期する。
 * 場所の追加・削除・通知ON/OFF変更時に呼ぶ。
 */
export async function syncGeofences(): Promise<void> {
  if (!isGeofencingActive()) return;
  await startGeofenceMonitoring();
}

/**
 * 特定メモのジオフェンスをネイティブから削除する（メモ削除時）。
 * Fire-and-forget でよい。
 */
export function clearMemoFromCache(memoId: string): void {
  if (Platform.OS !== 'android' || !YorimichiGeofence) return;
  YorimichiGeofence.removeGeofencesForMemo(memoId).catch(() => {});
}
