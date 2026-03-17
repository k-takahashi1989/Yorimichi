/**
 * purchaseService.ts
 * RevenueCat (react-native-purchases) を使ったサブスクリプション管理サービス。
 * Android (Google Play) のみ対応。
 */

import Purchases, {
  PurchasesOffering,
  PurchasesPackage,
  PURCHASES_ERROR_CODE,
} from 'react-native-purchases';
import Config from 'react-native-config';

/** RevenueCat のエンタイトルメント識別子（RCダッシュボードと一致させること） */
const ENTITLEMENT_ID = 'premium';

// ============================================================
// 初期化
// ============================================================

/**
 * RevenueCat SDK を初期化する。
 * App.tsx の useEffect で一度だけ呼ぶ。
 */
export function initPurchases(): void {
  const apiKey = Config.REVENUECAT_ANDROID_API_KEY;
  if (!apiKey) {
    if (__DEV__) console.warn('[purchaseService] REVENUECAT_ANDROID_API_KEY が未設定です。');
    return;
  }
  Purchases.configure({ apiKey });
}

// ============================================================
// オファリング取得
// ============================================================

/** getOfferings の戻り値 */
export interface PremiumOffering {
  offering: PurchasesOffering;
  monthly: PurchasesPackage | null;
  annual: PurchasesPackage | null;
}

/** getPremiumOffering の戻り値 */
export type OfferingResult =
  | { ok: true; data: PremiumOffering }
  | { ok: false; error: string };

/**
 * 現在のオファリングを取得する。
 * RevenueCat ダッシュボードで default offering に月額・年額パッケージを設定しておく。
 * 最大 2 回リトライ（計 3 回試行）する。
 */
export async function getPremiumOffering(): Promise<OfferingResult> {
  const MAX_ATTEMPTS = 3;
  const apiKey = Config.REVENUECAT_ANDROID_API_KEY;
  if (!apiKey) {
    return { ok: false, error: 'REVENUECAT_ANDROID_API_KEY is not configured' };
  }

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const offerings = await Purchases.getOfferings();
      const current = offerings.current;
      if (!current) {
        return { ok: false, error: 'No default offering configured' };
      }
      return {
        ok: true,
        data: {
          offering: current,
          monthly: current.monthly ?? null,
          annual: current.annual ?? null,
        },
      };
    } catch (e: any) {
      if (__DEV__) console.error(`[purchaseService] getOfferings attempt ${attempt} エラー:`, e);
      if (attempt < MAX_ATTEMPTS) {
        await new Promise(r => setTimeout(r, 1000 * attempt));
        continue;
      }
      return { ok: false, error: e?.message ?? 'Failed to load offerings' };
    }
  }
  // TypeScript: unreachable, but satisfy return type
  return { ok: false, error: 'Failed to load offerings' };
}

// ============================================================
// 購入
// ============================================================

/** purchasePackage の戻り値 */
export type PurchaseResult =
  | { success: true; hasPremium: boolean }
  | { success: false; cancelled: boolean; error: string };

/**
 * パッケージを購入する。
 * 購入直後の customerInfo からエンタイトルメントを判定して返す。
 */
export async function purchasePackage(pkg: PurchasesPackage): Promise<PurchaseResult> {
  try {
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    const hasPremium = customerInfo.entitlements.active[ENTITLEMENT_ID] != null;
    return { success: true, hasPremium };
  } catch (e: any) {
    const code: number | undefined = e?.code;
    const cancelled = code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR;
    return {
      success: false,
      cancelled,
      error: e?.message ?? 'Unknown error',
    };
  }
}

// ============================================================
// 復元
// ============================================================

/** restorePurchases の戻り値 */
export type RestoreResult =
  | { success: true; hasPremium: boolean }
  | { success: false; error: string };

/**
 * 以前の購入を復元する。
 */
export async function restorePurchases(): Promise<RestoreResult> {
  try {
    const customerInfo = await Purchases.restorePurchases();
    const hasPremium = customerInfo.entitlements.active[ENTITLEMENT_ID] != null;
    return { success: true, hasPremium };
  } catch (e: any) {
    return { success: false, error: e?.message ?? 'Unknown error' };
  }
}

// ============================================================
// エンタイトルメント確認
// ============================================================

/**
 * 現在のユーザーが premium エンタイトルメントを持っているかを返す。
 * アプリ起動時・購入後に呼んで memoStore.isPremium を同期する。
 */
export async function checkEntitlementActive(): Promise<boolean> {
  // エラーは呼び出し元に伝播させる（catch 内で false を返すと
  // RevenueCat 認証エラー時に isPremium が強制 false になるため）
  const customerInfo = await Purchases.getCustomerInfo();
  return customerInfo.entitlements.active[ENTITLEMENT_ID] != null;
}
