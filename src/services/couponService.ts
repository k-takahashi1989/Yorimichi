import firestore from '@react-native-firebase/firestore';

const COUPON_COLLECTION = 'couponCodes';

export interface CouponResult {
  ok: boolean;
  expiryMs: number | null;
  error?: 'invalid' | 'already_used' | 'network';
}

/**
 * クーポンコードをFirestoreで検証し、有効な場合は使用済みフラグを立てる。
 * Firestoreトランザクションで二重使用を防止する。
 *
 * @param code      ユーザが入力したクーポンコード文字列
 * @param deviceId  端末識別子（使用者記録用）
 */
export async function redeemCouponCode(
  code: string,
  deviceId: string,
): Promise<CouponResult> {
  const normalizedCode = code.trim().toUpperCase();
  const docRef = firestore().collection(COUPON_COLLECTION).doc(normalizedCode);

  try {
    const result = await firestore().runTransaction(async tx => {
      const snap = await tx.get(docRef);

      if (!snap.exists) {
        return { ok: false, expiryMs: null, error: 'invalid' as const };
      }

      const data = snap.data()!;
      if (data.used === true) {
        return { ok: false, expiryMs: null, error: 'already_used' as const };
      }

      const durationDays: number = typeof data.durationDays === 'number' ? data.durationDays : 365;
      const now = Date.now();
      const expiryMs = now + durationDays * 24 * 60 * 60 * 1000;

      tx.update(docRef, {
        used: true,
        usedBy: deviceId,
        usedAt: now,
      });

      return { ok: true, expiryMs, error: undefined };
    });

    return result;
  } catch {
    return { ok: false, expiryMs: null, error: 'network' };
  }
}
