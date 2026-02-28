import firestore, {
  FirebaseFirestoreTypes,
} from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import { Memo, SharedMemoDoc, SharePresence } from '../types';

const COLLECTION = 'sharedMemos';

// ── 匿名サインイン（未サインインのとき自動実行）──────────────
export async function ensureSignedIn(): Promise<void> {
  if (!auth().currentUser) {
    await auth().signInAnonymously();
  }
}

// ── メモを Firestore にアップロードして shareId を返す ────────
export async function uploadSharedMemo(
  memo: Memo,
  deviceId: string,
): Promise<string> {
  await ensureSignedIn();
  const doc: SharedMemoDoc = {
    title: memo.title,
    items: memo.items,
    locations: memo.locations,
    updatedAt: Date.now(),
    ownerDeviceId: deviceId,
    collaborators: [deviceId],
    presence: null,
  };
  if (memo.shareId) {
    // 既存ドキュメントを更新
    await firestore().collection(COLLECTION).doc(memo.shareId).set(doc);
    return memo.shareId;
  }
  const ref = await firestore().collection(COLLECTION).add(doc);
  return ref.id;
}

// ── Firestore から最新メモデータを取得 ───────────────────────
export async function syncSharedMemo(
  shareId: string,
): Promise<SharedMemoDoc | null> {
  await ensureSignedIn();
  const snap = await firestore().collection(COLLECTION).doc(shareId).get();
  const data = snap.data() as SharedMemoDoc | undefined;
  if (!snap.exists || !data) return null;
  return data;
}

// ── 受信者として memodoc に自デバイス ID を追記しデータを返す ─
export async function joinSharedMemo(
  shareId: string,
  deviceId: string,
): Promise<SharedMemoDoc | null> {
  await ensureSignedIn();
  const ref = firestore().collection(COLLECTION).doc(shareId);
  const snap = await ref.get();
  // exists は boolean property だが snap.data() が undefined の場合も守る
  const data = snap.data() as SharedMemoDoc | undefined;
  if (!snap.exists || !data) return null;
  if (Array.isArray(data.collaborators) && !data.collaborators.includes(deviceId)) {
    await ref.update({
      collaborators: firestore.FieldValue.arrayUnion(deviceId),
    });
  }
  return data;
}

// ── プレゼンス（編集中）を書き込む ───────────────────────────
export async function setPresence(
  shareId: string,
  deviceId: string,
): Promise<void> {
  await ensureSignedIn();
  const presence: SharePresence = {
    deviceId,
    editingAt: Date.now(),
  };
  await firestore()
    .collection(COLLECTION)
    .doc(shareId)
    .update({ presence });
}

// ── プレゼンスをクリア ────────────────────────────────────────
export async function clearPresence(
  shareId: string,
  deviceId: string,
): Promise<void> {
  await ensureSignedIn();
  const snap = await firestore().collection(COLLECTION).doc(shareId).get();
  if (!snap.exists) return;
  const data = snap.data() as SharedMemoDoc;
  // 自分のプレゼンスだけクリア
  if (data.presence?.deviceId === deviceId) {
    await firestore()
      .collection(COLLECTION)
      .doc(shareId)
      .update({ presence: null });
  }
}

// ── プレゼンスをリアルタイム監視（unsubscribe 関数を返す）────
export function subscribePresence(
  shareId: string,
  callback: (presence: SharePresence | null) => void,
): () => void {
  const unsubscribe = firestore()
    .collection(COLLECTION)
    .doc(shareId)
    .onSnapshot(
      (snap: FirebaseFirestoreTypes.DocumentSnapshot) => {
        if (!snap.exists) {
          callback(null);
          return;
        }
        const data = snap.data() as SharedMemoDoc;
        callback(data.presence ?? null);
      },
      () => callback(null),
    );
  return unsubscribe;
}

// ── プレゼンスが有効か判定（30秒 TTL）────────────────────────
export function isPresenceActive(presence: SharePresence | null): boolean {
  if (!presence) return false;
  return Date.now() - presence.editingAt < 30_000;
}
