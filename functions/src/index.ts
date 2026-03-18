import { onRequest } from "firebase-functions/v2/https";
import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";
import { logger } from "firebase-functions/v2";

initializeApp();

const COOLDOWN_MS = 60 * 1000; // 1分クールダウン

/**
 * 共有メモの更新通知を共有相手に送信する。
 * HTTP POST で呼び出し。Authorization ヘッダーで認証。
 */
export const notifyCollaborators = onRequest(
  { region: "asia-northeast1", invoker: "public" },
  async (req, res) => {
    // POST のみ
    if (req.method !== "POST") {
      res.status(405).json({ error: { message: "Method not allowed" } });
      return;
    }

    // Authorization ヘッダーから ID トークンを取得
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      res.status(401).json({ error: { status: "unauthenticated", message: "Missing Authorization header" } });
      return;
    }
    const idToken = authHeader.split("Bearer ")[1];
    let callerUid: string;
    try {
      const decoded = await getAuth().verifyIdToken(idToken);
      callerUid = decoded.uid;
    } catch {
      res.status(401).json({ error: { status: "unauthenticated", message: "Invalid ID token" } });
      return;
    }

    const { shareId, memoTitle, deviceId } = req.body?.data ?? req.body ?? {};

    if (!shareId || !memoTitle) {
      res.status(400).json({ error: { status: "invalid-argument", message: "shareId and memoTitle are required" } });
      return;
    }

    const db = getFirestore();
    const memoRef = db.collection("sharedMemos").doc(shareId);
    const memoSnap = await memoRef.get();

    if (!memoSnap.exists) {
      res.status(404).json({ error: { status: "not-found", message: "Shared memo not found" } });
      return;
    }

    const memoData = memoSnap.data()!;

    // 呼び出し者がメモの共有者か検証
    const ownerUid: string | undefined = memoData.ownerUid;
    const collaboratorUids: string[] = memoData.collaboratorUids ?? [];
    let allUids = [ownerUid, ...collaboratorUids].filter(Boolean) as string[];

    if (!allUids.includes(callerUid)) {
      // UID が一致しない場合、deviceId ベースでフォールバック照合する。
      // アプリ再インストール等で匿名 UID が変わった場合の救済措置。
      const collaborators: string[] = memoData.collaborators ?? [];
      if (deviceId && collaborators.includes(deviceId)) {
        // deviceId が既知のコラボレーター → 新 UID を collaboratorUids に追加
        const uidUpdate: Record<string, unknown> = {
          collaboratorUids: FieldValue.arrayUnion(callerUid),
        };
        // deviceId がオーナーの場合は ownerUid も更新
        if (memoData.ownerDeviceId === deviceId) {
          uidUpdate.ownerUid = callerUid;
        }
        await memoRef.update(uidUpdate);
        // allUids を更新して以降の処理で正しい送信先を使う
        allUids = [...allUids, callerUid];
        logger.info(`[notifyCollaborators] UID re-associated: deviceId=${deviceId}, newUid=${callerUid}`);
      } else {
        res.status(403).json({ error: { status: "permission-denied", message: "You are not a collaborator of this memo" } });
        return;
      }
    }

    // クールダウンチェック
    const lastNotifiedAt: number | undefined = memoData.lastNotifiedAt;
    const now = Date.now();
    if (lastNotifiedAt && now - lastNotifiedAt < COOLDOWN_MS) {
      const remainingSec = Math.ceil((COOLDOWN_MS - (now - lastNotifiedAt)) / 1000);
      res.status(429).json({ error: { status: "resource-exhausted", message: `Please wait ${remainingSec} seconds before sending again` } });
      return;
    }

    // 送信先: 呼び出し者以外の全 UID
    const targetUids = allUids.filter((uid) => uid !== callerUid);
    if (targetUids.length === 0) {
      res.json({ result: { sent: 0 } });
      return;
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
      res.json({ result: { sent: 0 } });
      return;
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

    res.json({ result: { sent: response.successCount } });
  }
);
