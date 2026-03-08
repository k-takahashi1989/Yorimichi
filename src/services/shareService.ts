import firestore, {
  FirebaseFirestoreTypes,
} from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import { Memo, SharedMemoDoc, SharePresence, ShoppingItem, MemoLocation } from '../types';
import { getCollaboratorsLimit } from '../config/planLimits';

const COLLECTION = 'sharedMemos';

// ── Firestore は undefined を拒否するため、optional フィールドをサニタイズ ──
// undefined のフィールドを持つオブジェクトをそのまま渡すと
// "Unsupported field value: undefined" エラーになる。
function sanitizeItem(item: ShoppingItem): ShoppingItem {
  const result: ShoppingItem = {
    id: item.id,
    name: item.name,
    isChecked: item.isChecked,
  };
  if (item.checkedAt !== undefined) result.checkedAt = item.checkedAt;
  return result;
}

function sanitizeLocation(loc: MemoLocation): MemoLocation {
  const result: MemoLocation = {
    id: loc.id,
    label: loc.label,
    latitude: loc.latitude,
    longitude: loc.longitude,
    radius: loc.radius,
  };
  if (loc.address !== undefined) result.address = loc.address;
  return result;
}

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
    items: memo.items.map(sanitizeItem),
    locations: memo.locations.map(sanitizeLocation),
    updatedAt: Date.now(),
    ownerDeviceId: deviceId,
    collaborators: [deviceId],
    presences: {},
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
  isPremium: boolean = false,
): Promise<SharedMemoDoc | null> {
  await ensureSignedIn();
  const ref = firestore().collection(COLLECTION).doc(shareId);
  const snap = await ref.get();
  // exists は boolean property だが snap.data() が undefined の場合も守る
  const data = snap.data() as SharedMemoDoc | undefined;
  if (!snap.exists || !data) return null;
  // collaborators への追記: Security Rules で弾かれても import 自体は続行する
  if (Array.isArray(data.collaborators) && !data.collaborators.includes(deviceId)) {
    // 参加者上限チェック（オーナーを除く非オーナー数で判定）
    const nonOwnerCount = data.collaborators.filter((id: string) => id !== data.ownerDeviceId).length;
    if (nonOwnerCount >= getCollaboratorsLimit(isPremium)) {
      throw new Error('COLLABORATORS_FULL');
    }
    try {
      await ref.update({
        collaborators: firestore.FieldValue.arrayUnion(deviceId),
      });
    } catch (e) {
      console.warn('[joinSharedMemo] could not update collaborators:', e);
    }
  }
  return data;
}

// ── プレゼンス（編集中）を書き込む ───────────────────────────
export async function setPresence(
  shareId: string,
  deviceId: string,
): Promise<void> {
  await ensureSignedIn();
  const entry: SharePresence = {
    deviceId,
    editingAt: Date.now(),
  };
  // ドット記法で自分のエントリだけ更新（他デバイスのプレゼンスを消さない）
  await firestore()
    .collection(COLLECTION)
    .doc(shareId)
    .update({ [`presences.${deviceId}`]: entry });
}

// ── プレゼンスをクリア ────────────────────────────────────────
export async function clearPresence(
  shareId: string,
  deviceId: string,
): Promise<void> {
  await ensureSignedIn();
  // FieldValue.delete() で自分のエントリだけ削除（事前読み込み不要）
  await firestore()
    .collection(COLLECTION)
    .doc(shareId)
    .update({ [`presences.${deviceId}`]: firestore.FieldValue.delete() });
}
// ── 共有メモのアイテム一覧を Firestore に即時反映する ────────────────────
export async function updateSharedMemoItems(
  shareId: string,
  items: ShoppingItem[],
): Promise<void> {
  await ensureSignedIn();
  await firestore()
    .collection(COLLECTION)
    .doc(shareId)
    .update({ items: items.map(sanitizeItem), updatedAt: Date.now() });
}

// ── 共有メモの地点一覧を Firestore に即時反映する（オーナー専用）────────
export async function updateSharedMemoLocations(
  shareId: string,
  locations: import('../types').MemoLocation[],
): Promise<void> {
  await ensureSignedIn();
  await firestore()
    .collection(COLLECTION)
    .doc(shareId)
    .update({ locations: locations.map(sanitizeLocation), updatedAt: Date.now() });
}
// ── プレゼンスをリアルタイム監視（unsubscribe 関数を返す）────
export function subscribePresence(
  shareId: string,
  callback: (presences: Record<string, SharePresence>) => void,
): () => void {
  const unsubscribe = firestore()
    .collection(COLLECTION)
    .doc(shareId)
    .onSnapshot(
      (snap: FirebaseFirestoreTypes.DocumentSnapshot) => {
        if (!snap.exists) {
          callback({});
          return;
        }
        const data = snap.data() as SharedMemoDoc;
        callback(data.presences ?? {});
      },
      () => callback({}),
    );
  return unsubscribe;
}

// ── 自分以外の誰かが30秒以内に編集中か判定 ──────────────────
export function isPresenceActive(
  presences: Record<string, SharePresence>,
  ownDeviceId: string,
): boolean {
  const now = Date.now();
  return Object.values(presences).some(
    p => p.deviceId !== ownDeviceId && now - p.editingAt < 30_000,
  );
}
