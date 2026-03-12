/**
 * クラウドバックアップサービス（プレミアム機能）
 * デバイス上のメモ全件を Firestore に保存/復元する。
 */
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import { ensureSignedIn } from './shareService';
import { Memo } from '../types';

const COLLECTION = 'backups';

/** 1日 = 24h (ms) */
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export interface BackupDoc {
  memos: Memo[];
  backupAt: number;
  deviceId: string;
  ownerUid?: string;
}

// ── 全メモを Firestore にバックアップ ──────────────────────────────────────
export async function backupAllMemos(
  memos: Memo[],
  deviceId: string,
): Promise<number> {
  await ensureSignedIn();
  const backupAt = Date.now();
  // Firestore は undefined を拒否するため、JSON ラウンドトリップで undefined フィールドを除去する
  const sanitizedMemos = JSON.parse(JSON.stringify(memos)) as Memo[];
  const ownerUid = auth().currentUser!.uid;
  const doc: BackupDoc = {
    memos: sanitizedMemos,
    backupAt,
    deviceId,
    ownerUid,
  };
  await firestore().collection(COLLECTION).doc(deviceId).set(doc);
  return backupAt;
}

// ── Firestore からバックアップを復元 ──────────────────────────────────────
export async function restoreFromBackup(
  deviceId: string,
): Promise<BackupDoc | null> {
  await ensureSignedIn();
  const snap = await firestore().collection(COLLECTION).doc(deviceId).get();
  const data = snap.data() as BackupDoc | undefined;
  if (!snap.exists || !data) return null;
  return data;
}

// ── 日次自動バックアップ判定 ──────────────────────────────────────────────
export function shouldAutoBackup(lastBackupAt: number | null): boolean {
  if (lastBackupAt == null) return true;
  return Date.now() - lastBackupAt >= ONE_DAY_MS;
}
