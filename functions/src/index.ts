import { onCall, HttpsError } from "firebase-functions/v2/https";
import { initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";

initializeApp();

const COOLDOWN_MS = 5 * 60 * 1000; // 5分クールダウン

interface NotifyRequest {
  shareId: string;
  memoTitle: string;
}

/**
 * 共有メモの更新通知を共有相手に送信する (プレミアム限定)。
 *
 * - 呼び出し者が本当にそのメモの共有者か検証
 * - 5分間のクールダウンをチェック
 * - 送信者以外の全コラボレーター/オーナーに FCM 通知を送信
 * - 無効なトークンを自動クリーンアップ
 */
export const notifyCollaborators = onCall<NotifyRequest>(
  { region: "asia-northeast1" },
  async (request) => {
    // 認証チェック
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Authentication required");
    }
    const callerUid = request.auth.uid;
    const { shareId, memoTitle } = request.data;

    if (!shareId || !memoTitle) {
      throw new HttpsError("invalid-argument", "shareId and memoTitle are required");
    }

    const db = getFirestore();
    const memoRef = db.collection("sharedMemos").doc(shareId);
    const memoSnap = await memoRef.get();

    if (!memoSnap.exists) {
      throw new HttpsError("not-found", "Shared memo not found");
    }

    const memoData = memoSnap.data()!;

    // 呼び出し者がメモの共有者か検証
    const ownerUid: string | undefined = memoData.ownerUid;
    const collaboratorUids: string[] = memoData.collaboratorUids ?? [];
    const allUids = [ownerUid, ...collaboratorUids].filter(Boolean) as string[];

    if (!allUids.includes(callerUid)) {
      throw new HttpsError("permission-denied", "You are not a collaborator of this memo");
    }

    // クールダウンチェック
    const lastNotifiedAt: number | undefined = memoData.lastNotifiedAt;
    const now = Date.now();
    if (lastNotifiedAt && now - lastNotifiedAt < COOLDOWN_MS) {
      const remainingSec = Math.ceil((COOLDOWN_MS - (now - lastNotifiedAt)) / 1000);
      throw new HttpsError("resource-exhausted", `Please wait ${remainingSec} seconds before sending again`);
    }

    // 送信先: 呼び出し者以外の全 UID
    const targetUids = allUids.filter((uid) => uid !== callerUid);
    if (targetUids.length === 0) {
      return { sent: 0 };
    }

    // FCM トークンを取得
    const tokenSnaps = await Promise.all(
      targetUids.map((uid) => db.collection("deviceTokens").doc(uid).get())
    );
    const tokens: string[] = [];
    for (const snap of tokenSnaps) {
      if (snap.exists) {
        const token = snap.data()?.token;
        if (token) tokens.push(token);
      }
    }

    if (tokens.length === 0) {
      // トークンなし → lastNotifiedAt は更新しない
      return { sent: 0 };
    }

    // FCM 送信
    const messaging = getMessaging();
    const response = await messaging.sendEachForMulticast({
      tokens,
      notification: {
        title: `「${memoTitle}」${memoData.ownerUid === callerUid ? "" : ""}`,
        body: "共有メモが更新されました。タップして確認",
      },
      data: {
        type: "memo_updated",
        shareId,
        memoTitle,
      },
      android: {
        priority: "high",
        notification: {
          channelId: "shopping-reminder",
          clickAction: "OPEN_MEMO",
        },
      },
    });

    // 無効トークンのクリーンアップ
    const invalidTokens: string[] = [];
    response.responses.forEach((resp, idx) => {
      if (
        !resp.success &&
        resp.error &&
        (resp.error.code === "messaging/registration-token-not-registered" ||
          resp.error.code === "messaging/invalid-registration-token")
      ) {
        invalidTokens.push(tokens[idx]);
      }
    });

    if (invalidTokens.length > 0) {
      const batch = db.batch();
      for (const snap of tokenSnaps) {
        if (snap.exists && invalidTokens.includes(snap.data()?.token)) {
          batch.delete(snap.ref);
        }
      }
      await batch.commit();
    }

    // lastNotifiedAt を更新
    await memoRef.update({ lastNotifiedAt: FieldValue.serverTimestamp() });

    return { sent: response.successCount };
  }
);
