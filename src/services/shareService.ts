import firestore, {
  FirebaseFirestoreTypes,
} from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import { Memo, SharedMemoDoc, SharePresence, ShoppingItem, MemoLocation } from '../types';
import { recordError } from './crashlyticsService';

const COLLECTION = 'sharedMemos';

/** ensureSignedIn() 後に currentUser の UID を安全に取得する */
function getCurrentUid(): string {
  const user = auth().currentUser;
  if (!user) throw new Error('Not signed in');
  return user.uid;
}

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
  if (loc.triggerType !== undefined) result.triggerType = loc.triggerType;
  return result;
}

// ── 匿名サインイン（未サインインのとき自動実行）──────────────

/**
 * Firebase Auth が起動時の永続化セッション復元を終えるまで待つ Promise。
 * onAuthStateChanged は初回起動時に必ず 1 回発火する（currentUser が null でも）。
 * これを待たずに signInAnonymously を呼ぶと、前回セッションの復元と競合して
 * 起動時クラッシュが起きることがあった。
 */
let _authReady: Promise<void> | null = null;
export function waitForAuthReady(): Promise<void> {
  if (!_authReady) {
    _authReady = new Promise<void>(resolve => {
      // let で宣言することで、コールバックが同期的に呼ばれても TDZ エラーを回避
      let unsubscribe: (() => void) | undefined;
      const cb = () => {
        if (unsubscribe) unsubscribe();
        resolve();
      };
      unsubscribe = auth().onAuthStateChanged(cb);
    });
  }
  return _authReady;
}

/**
 * 同時多発 signInAnonymously を防ぐシングルトン。
 * 複数箇所が同時に currentUser === null を確認すると全員が
 * signInAnonymously を呼ぶ競合が発生するため、1 本化する。
 */
let _signingIn: Promise<void> | null = null;

export async function ensureSignedIn(): Promise<void> {
  // Firebase Auth の初期化完了（セッション復元）を待ってから判定する
  await waitForAuthReady();
  if (auth().currentUser) return;
  if (!_signingIn) {
    _signingIn = auth()
      .signInAnonymously()
      .then(() => { _signingIn = null; })
      .catch(e => { _signingIn = null; throw e; });
  }
  return _signingIn;
}

// ── メモを Firestore にアップロードして shareId を返す ────────
export async function uploadSharedMemo(
  memo: Memo,
  deviceId: string,
): Promise<string> {
  await ensureSignedIn();
  const uid = getCurrentUid();
  if (memo.shareId) {
    // 既存ドキュメントを更新 — collaboratorUids / collaborators / presences は
    // 共有相手が joinSharedMemo で追加した値を保持する必要があるため上書きしない。
    const updateData: Record<string, unknown> = {
      title: memo.title,
      items: memo.items.map(sanitizeItem),
      locations: memo.locations.map(sanitizeLocation),
      updatedAt: Date.now(),
    };
    if (memo.note) {
      updateData.note = memo.note;
    } else {
      updateData.note = firestore.FieldValue.delete();
    }
    if (memo.dueDate != null) {
      updateData.dueDate = memo.dueDate;
    } else {
      updateData.dueDate = firestore.FieldValue.delete();
    }

    // UID 再紐付け: アプリ再インストール等で匿名 UID が変わった場合、
    // deviceId の一致を元に ownerUid / collaboratorUids を更新する。
    const ref = firestore().collection(COLLECTION).doc(memo.shareId);
    const snap = await ref.get();
    const existing = snap.data() as SharedMemoDoc | undefined;
    if (existing) {
      const isOwnerDevice = existing.ownerDeviceId === deviceId;
      const uidKnown = existing.ownerUid === uid
        || (Array.isArray(existing.collaboratorUids) && existing.collaboratorUids.includes(uid));
      if (!uidKnown) {
        // deviceId がオーナーの場合は ownerUid も更新
        if (isOwnerDevice) {
          updateData.ownerUid = uid;
        }
        // collaboratorUids に新 UID を追加（arrayUnion と merge ではなく直接追記）
        updateData.collaboratorUids = firestore.FieldValue.arrayUnion(uid);
        updateData.collaborators = firestore.FieldValue.arrayUnion(deviceId);
      }
    }

    await ref.update(updateData);
    return memo.shareId;
  }
  const doc: SharedMemoDoc = {
    title: memo.title,
    items: memo.items.map(sanitizeItem),
    locations: memo.locations.map(sanitizeLocation),
    ...(memo.note ? { note: memo.note } : {}),
    ...(memo.dueDate != null ? { dueDate: memo.dueDate } : {}),
    updatedAt: Date.now(),
    ownerDeviceId: deviceId,
    collaborators: [deviceId],
    ownerUid: uid,
    collaboratorUids: [uid],
    presences: {},
  };
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

// ── 複数の共有メモを一括取得（一覧遷移時に使用）────────────────
// Firestore の `in` クエリを使い、N+1 問題を解消（最大30件ずつバッチ取得）
export async function syncAllSharedMemos(
  shareIds: string[],
): Promise<Record<string, SharedMemoDoc>> {
  if (shareIds.length === 0) return {};
  await ensureSignedIn();

  const result: Record<string, SharedMemoDoc> = {};

  // Firestore の `in` クエリは最大30件まで。チャンク分割して並列取得する
  const CHUNK_SIZE = 30;
  const chunks: string[][] = [];
  for (let i = 0; i < shareIds.length; i += CHUNK_SIZE) {
    chunks.push(shareIds.slice(i, i + CHUNK_SIZE));
  }

  const snapshots = await Promise.all(
    chunks.map(chunk =>
      firestore()
        .collection(COLLECTION)
        .where(firestore.FieldPath.documentId(), 'in', chunk)
        .get(),
    ),
  );

  for (const querySnap of snapshots) {
    for (const docSnap of querySnap.docs) {
      const data = docSnap.data() as SharedMemoDoc | undefined;
      if (data) {
        result[docSnap.id] = data;
      }
    }
  }

  return result;
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
  // collaborators / collaboratorUids への追記: Security Rules で弾かれても import 自体は続行する。
  // deviceId と uid は独立して判定する。アプリ再インストール等で uid だけ変わるケースがあるため、
  // deviceId が既存でも uid が未登録なら追記が必要。
  const uid = getCurrentUid();
  const needsDeviceId = Array.isArray(data.collaborators) && !data.collaborators.includes(deviceId);
  const needsUid = Array.isArray(data.collaboratorUids) && !data.collaboratorUids.includes(uid);
  if (needsDeviceId || needsUid) {
    try {
      await ref.update({
        collaborators: firestore.FieldValue.arrayUnion(deviceId),
        collaboratorUids: firestore.FieldValue.arrayUnion(uid),
      });
    } catch (e) {
      recordError(e, '[shareService] joinSharedMemo collaborators');
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

// ── 共有メモ全体をリアルタイム監視（プレミアム機能）────────────────────
export function subscribeSharedMemo(
  shareId: string,
  callback: (doc: SharedMemoDoc | null) => void,
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
        callback(snap.data() as SharedMemoDoc);
      },
      () => callback(null),
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
