import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { Memo, ShoppingItem, MemoLocation, RecentPlace } from '../types';
import { mmkvStorage } from '../storage/mmkvStorage';
import { generateId } from '../utils/helpers';
import { clearMemoFromCache, syncGeofences, setNotifWindowNative } from '../services/geofenceService';
import { getLocationsLimit } from '../config/planLimits';
import { isTrialActive } from '../utils/trialUtils';
import { redeemCouponCode } from '../services/couponService';
import { getDeviceId } from '../utils/deviceId';

// ============================================================
// 設定ストア
// ============================================================
export interface SettingsState {
  defaultRadius: number;               // デフォルトのジオフェンス半径 (m)
  maxRadius: number;                   // スライダー最大値
  totalMemoRegistrations: number;      // 新規メモ登録累計（広告表示判定用）
  seenTutorials: string[];             // 表示済みチュートリアルのキー
  // 共有機能
  isPremium: boolean;                  // 課金プレミアムフラグ
  // 場所検索履歴
  recentPlaces: RecentPlace[];         // 最大5件
  // 7日間お試しトライアル
  trialStartDate: number | null;       // トライアル開始日時 (Unix ms)。null = 未開始
  hasUsedTrial: boolean;               // トライアル使用済みフラグ（再利用防止）
  // 通知時間帯（プレミアム機能）
  notifWindowEnabled: boolean;         // 時間帯限定を有効にするか
  notifWindowStart: number;            // 開始時刻 (float, 0.5刻み. 例: 8.0=8:00, 8.5=8:30)
  notifWindowEnd: number;              // 終了時刻 (float, 0.5刻み)
  // クーポンコード
  couponExpiry: number | null;         // クーポン有効期限 (Unix ms)。null = 未使用
  // クラウドバックアップ（プレミアム機能）
  lastCloudBackupAt: number | null;    // 最後にクラウドバックアップした日時 (Unix ms)
  setDefaultRadius: (radius: number) => void;
  setMaxRadius: (max: number) => void;
  incrementMemoRegistrations: () => void;
  markTutorialSeen: (key: string) => void;
  addRecentPlace: (place: RecentPlace) => void;
  setIsPremium: (value: boolean) => void;
  startTrial: () => void;
  setNotifWindow: (enabled: boolean, start: number, end: number) => void;
  redeemCoupon: (code: string) => Promise<'ok' | 'invalid' | 'already_used' | 'network'>;
  syncPurchaseStatus: () => Promise<void>;
  setLastCloudBackupAt: (ts: number) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    set => ({
      defaultRadius: 200,
      maxRadius: 400,
      totalMemoRegistrations: 0,
      seenTutorials: [],
      isPremium: false,
      recentPlaces: [],
      trialStartDate: null,
      hasUsedTrial: false,
      notifWindowEnabled: false,
      notifWindowStart: 8.0,
      notifWindowEnd: 22.0,
      couponExpiry: null,
      lastCloudBackupAt: null,
      setDefaultRadius: (radius: number) => set({ defaultRadius: radius }),
      incrementMemoRegistrations: () =>
        set(state => ({ totalMemoRegistrations: state.totalMemoRegistrations + 1 })),
      setMaxRadius: (max: number) => set(state => ({
        maxRadius: max,
        defaultRadius: state.defaultRadius > max ? max : state.defaultRadius,
      })),
      markTutorialSeen: (key: string) =>
        set(state => ({
          seenTutorials: state.seenTutorials.includes(key)
            ? state.seenTutorials
            : [...state.seenTutorials, key],
        })),
      addRecentPlace: (place: RecentPlace) =>
        set(state => {
          // 重複除去（同じ標签があれば先頭に移動）
          const filtered = state.recentPlaces.filter(p => p.label !== place.label);
          const updated = [place, ...filtered].slice(0, 10);
          return { recentPlaces: updated };
        }),
      setIsPremium: (value: boolean) => set({ isPremium: value }),
      startTrial: () => set({ trialStartDate: Date.now(), hasUsedTrial: true }),
      setNotifWindow: (enabled: boolean, start: number, end: number) => {
        set({ notifWindowEnabled: enabled, notifWindowStart: start, notifWindowEnd: end });
        setNotifWindowNative(enabled, start, end);
      },
      redeemCoupon: async (code: string) => {
        const deviceId = getDeviceId();
        const result = await redeemCouponCode(code, deviceId);
        if (result.ok && result.expiryMs) {
          set({ couponExpiry: result.expiryMs });
          return 'ok';
        }
        return result.error ?? 'invalid';
      },
      syncPurchaseStatus: async () => {
        const { checkEntitlementActive } = await import('../services/purchaseService');
        try {
          const active = await checkEntitlementActive();
          set({ isPremium: active });
        } catch (e) {
          // RevenueCat 認証エラーなどの場合は既存の isPremium フラグを維持する
          // （エラーで false に上書きしてしまうのを防ぐ）
          console.warn('[syncPurchaseStatus] getCustomerInfo エラー。isPremium を維持します:', e);
        }
      },
      setLastCloudBackupAt: (ts: number) => set({ lastCloudBackupAt: ts }),
    }),
    {
      name: 'settings',
      version: 9,
      storage: createJSONStorage(() => mmkvStorage),
      migrate: (persisted: any, version: number) => {
        if (!persisted) return persisted;
        if (version <= 1) {
          persisted = { ...persisted, seenTutorials: persisted.seenTutorials ?? [] };
        }
        if (version <= 2) {
          persisted = {
            ...persisted,
            isPremium: persisted.isPremium ?? false,
          };
        }
        if (version <= 3) {
          persisted = { ...persisted, recentPlaces: persisted.recentPlaces ?? [] };
        }
        if (version <= 4) {
          persisted = { ...persisted, trialStartDate: null, hasUsedTrial: false };
        }
        if (version <= 5) {
          persisted = { ...persisted, notifWindowEnabled: false, notifWindowStart: 8.0, notifWindowEnd: 22.0 };
        }
        if (version <= 6) {
          persisted = { ...persisted, couponExpiry: null };
        }
        if (version <= 7) {
          persisted = { ...persisted, lastCloudBackupAt: null };
        }
        if (version <= 8) {
          // 旧マイグレーションバグで isPremium: true が保存されていたユーザーをリセット。
          // アプリ起動時の syncPurchaseStatus() で実際の購入者は true に戻る。
          persisted = { ...persisted, isPremium: false };
        }
        return persisted;
      },
    },
  ),
);

/**
 * 有効なプレミアム判定セレクター。
 * 課金プレミアム OR 7日間トライアル中 OR クーポン有効期限内 のどれかが true なら true を返す。
 */
export const selectEffectivePremium = (s: SettingsState): boolean =>
  s.isPremium ||
  isTrialActive(s.trialStartDate) ||
  (s.couponExpiry != null && Date.now() < s.couponExpiry);

// ============================================================
// メモストア
// ============================================================
interface MemoState {
  memos: Memo[];

  // CRUD
  addMemo: (title: string) => Memo;
  updateMemo: (id: string, partial: Partial<Pick<Memo, 'title' | 'notificationEnabled' | 'autoDisabledNotification' | 'items' | 'locations' | 'notificationMode'>>) => void;
  deleteMemo: (id: string) => void;
  restoreMemo: (memo: Memo) => void;
  getMemoById: (id: string) => Memo | undefined;

  // アイテム
  addItem: (memoId: string, name: string) => void;
  updateItem: (memoId: string, itemId: string, partial: Partial<ShoppingItem>) => void;
  deleteItem: (memoId: string, itemId: string) => void;
  toggleItem: (memoId: string, itemId: string) => void;
  reorderItems: (memoId: string, items: ShoppingItem[]) => void;
  uncheckAllItems: (memoId: string) => void;
  checkAllItems: (memoId: string) => void;

  // 場所
  addLocation: (memoId: string, location: Omit<MemoLocation, 'id'>) => MemoLocation | null;
  updateLocation: (memoId: string, locationId: string, partial: Partial<Omit<MemoLocation, 'id'>>) => void;
  deleteLocation: (memoId: string, locationId: string) => void;

  // 共有機能
  setMemoShareId: (memoId: string, shareId: string, isOwner: boolean) => void;
  importSharedMemo: (data: Pick<Memo, 'title' | 'items' | 'locations'>, shareId: string) => Memo;
}

export const useMemoStore = create<MemoState>()(
  persist(
    (set, get) => ({
      memos: [],

      // ── CRUD ────────────────────────────────────────────
      addMemo: (title: string): Memo => {
        const now = Date.now();
        const memo: Memo = {
          id: generateId(),
          title,
          items: [],
          locations: [],
          notificationEnabled: true,
          createdAt: now,
          updatedAt: now,
        };
        set(state => ({ memos: [memo, ...state.memos] }));
        return memo;
      },

      updateMemo: (id, partial) => {
        set(state => ({
          memos: state.memos.map(m =>
            m.id === id ? { ...m, ...partial, updatedAt: Date.now() } : m,
          ),
        }));
        // notificationEnabled / notificationMode が変わったときジオフェンスを再同期
        if ('notificationEnabled' in partial || 'notificationMode' in partial) {
          syncGeofences().catch(() => {});
        }
      },

      deleteMemo: (id) => {
        clearMemoFromCache(id);
        set(state => ({
          memos: state.memos.filter(m => m.id !== id),
        }));
      },

      restoreMemo: (memo) =>
        set(state => ({ memos: [memo, ...state.memos] })),

      getMemoById: (id) => get().memos.find(m => m.id === id),

      // ── アイテム ──────────────────────────────
      addItem: (memoId, name) =>
        set(state => ({
          memos: state.memos.map(m => {
            if (m.id !== memoId) return m;
            const newItem: ShoppingItem = {
              id: generateId(),
              name: name.trim(),
              isChecked: false,
            };
            return { ...m, items: [...m.items, newItem], updatedAt: Date.now() };
          }),
        })),

      updateItem: (memoId, itemId, partial) =>
        set(state => ({
          memos: state.memos.map(m => {
            if (m.id !== memoId) return m;
            return {
              ...m,
              items: m.items.map(it => (it.id === itemId ? { ...it, ...partial } : it)),
              updatedAt: Date.now(),
            };
          }),
        })),

      deleteItem: (memoId, itemId) =>
        set(state => ({
          memos: state.memos.map(m => {
            if (m.id !== memoId) return m;
            return { ...m, items: m.items.filter(it => it.id !== itemId), updatedAt: Date.now() };
          }),
        })),

      toggleItem: (memoId, itemId) =>
        set(state => ({
          memos: state.memos.map(m => {
            if (m.id !== memoId) return m;
            return {
              ...m,
              items: m.items.map(it =>
                it.id === itemId
                  ? {
                      ...it,
                      isChecked: !it.isChecked,
                      checkedAt: !it.isChecked ? Date.now() : undefined,
                    }
                  : it,
              ),
              updatedAt: Date.now(),
            };
          }),
        })),

      reorderItems: (memoId, items) =>
        set(state => ({
          memos: state.memos.map(m => {
            if (m.id !== memoId) return m;
            return { ...m, items, updatedAt: Date.now() };
          }),
        })),

      uncheckAllItems: (memoId) =>
        set(state => ({
          memos: state.memos.map(m => {
            if (m.id !== memoId) return m;
            return {
              ...m,
              items: m.items.map(it => ({ ...it, isChecked: false, checkedAt: undefined })),
              // 自動OFFされた場合は通知を再ONに戻す
              notificationEnabled: m.autoDisabledNotification ? true : m.notificationEnabled,
              autoDisabledNotification: false,
              updatedAt: Date.now(),
            };
          }),
        })),

      checkAllItems: (memoId) =>
        set(state => ({
          memos: state.memos.map(m => {
            if (m.id !== memoId) return m;
            return {
              ...m,
              items: m.items.map(it => ({
                ...it,
                isChecked: true,
                checkedAt: it.checkedAt ?? Date.now(),
              })),
              updatedAt: Date.now(),
            };
          }),
        })),

      // ── 場所 ──────────────────────────────────────────────
      addLocation: (memoId, locationData): MemoLocation | null => {
        const memo = get().getMemoById(memoId);
        const effectivePremium = selectEffectivePremium(useSettingsStore.getState());
        const maxLocations = getLocationsLimit(effectivePremium);
        if (!memo || memo.locations.length >= maxLocations) return null;

        const location: MemoLocation = { id: generateId(), ...locationData };
        set(state => ({
          memos: state.memos.map(m => {
            if (m.id !== memoId) return m;
            return {
              ...m,
              locations: [...m.locations, location],
              updatedAt: Date.now(),
            };
          }),
        }));
        syncGeofences().catch(() => {});
        return location;
      },

      updateLocation: (memoId, locationId, partial) => {
        set(state => ({
          memos: state.memos.map(m => {
            if (m.id !== memoId) return m;
            return {
              ...m,
              locations: m.locations.map(l =>
                l.id === locationId ? { ...l, ...partial } : l,
              ),
              updatedAt: Date.now(),
            };
          }),
        }));
        syncGeofences().catch(() => {});
      },

      deleteLocation: (memoId, locationId) => {
        set(state => ({
          memos: state.memos.map(m => {
            if (m.id !== memoId) return m;
            return {
              ...m,
              locations: m.locations.filter(l => l.id !== locationId),
              updatedAt: Date.now(),
            };
          }),
        }));
        syncGeofences().catch(() => {});
      },

      // ── 共有機能 ──────────────────────────────────────────────
      setMemoShareId: (memoId, shareId, isOwner) =>
        set(state => ({
          memos: state.memos.map(m =>
            m.id === memoId ? { ...m, shareId, isOwner } : m,
          ),
        })),

      importSharedMemo: (data, shareId) => {
        const now = Date.now();
        const memo: Memo = {
          id: generateId(),
          title: data.title,
          // Firestore の ID をそのまま保持する（再発番すると sync 時にID不一致になる）
          items: data.items.map(it => ({ ...it })),
          locations: data.locations.map(loc => ({ ...loc })),
          notificationEnabled: true,
          createdAt: now,
          updatedAt: now,
          shareId,
          isOwner: false,
        };
        set(state => ({ memos: [memo, ...state.memos] }));
        return memo;
      },
    }),
    {
      name: 'memos',
      version: 2,
      storage: createJSONStorage(() => mmkvStorage),
      migrate: (persisted: any, version: number) => {
        if (!persisted) return persisted;
        if (version <= 1) {
          // v1 → v2: isCompleted削除、notificationEnabled追加
          const state = persisted as { memos: any[] };
          if (state.memos) {
            state.memos = state.memos.map((m: any) => {
              const { isCompleted: _removed, ...rest } = m;
              return { ...rest, notificationEnabled: rest.notificationEnabled ?? true };
            });
          }
          return state;
        }
        return persisted;
      },
    },
  ),
);
