import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { Memo, ShoppingItem, MemoLocation, RecentPlace } from '../types';
import { mmkvStorage } from '../storage/mmkvStorage';
import { generateId } from '../utils/helpers';
import { clearMemoFromCache } from '../services/geofenceService';

// ============================================================
// 設定ストア
// ============================================================
interface SettingsState {
  defaultRadius: number;               // デフォルトのジオフェンス半径 (m)
  maxRadius: number;                   // スライダー最大値
  totalMemoRegistrations: number;      // 新規メモ登録累計（広告表示判定用）
  seenTutorials: string[];             // 表示済みチュートリアルのキー
  // 共有機能
  isPremium: boolean;                  // TODO: リリース前に false に変更（クローズドテスト中は true）
  sharedMemoIds: string[];             // 送信済み共有メモの shareId 一覧
  // 場所検索履歴
  recentPlaces: RecentPlace[];         // 最大5件
  setDefaultRadius: (radius: number) => void;
  setMaxRadius: (max: number) => void;
  incrementMemoRegistrations: () => void;
  markTutorialSeen: (key: string) => void;
  addSharedMemoId: (shareId: string) => void;
  removeSharedMemoId: (shareId: string) => void;
  addRecentPlace: (place: RecentPlace) => void;
  setIsPremium: (value: boolean) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    set => ({
      defaultRadius: 200,
      maxRadius: 400,
      totalMemoRegistrations: 0,
      seenTutorials: [],
      isPremium: true, // TODO: リリース前に false に変更（クローズドテスト中は true）
      sharedMemoIds: [],
      recentPlaces: [],
      setDefaultRadius: (radius: number) => set({ defaultRadius: radius }),
      addSharedMemoId: (shareId: string) =>
        set(state => ({
          sharedMemoIds: state.sharedMemoIds.includes(shareId)
            ? state.sharedMemoIds
            : [...state.sharedMemoIds, shareId],
        })),
      removeSharedMemoId: (shareId: string) =>
        set(state => ({
          sharedMemoIds: state.sharedMemoIds.filter(id => id !== shareId),
        })),
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
    }),
    {
      name: 'settings',
      version: 4,
      storage: createJSONStorage(() => mmkvStorage),
      migrate: (persisted: any, version: number) => {
        if (!persisted) return persisted;
        if (version <= 1) {
          persisted = { ...persisted, seenTutorials: persisted.seenTutorials ?? [] };
        }
        if (version <= 2) {
          persisted = {
            ...persisted,
            isPremium: true,
            sharedMemoIds: persisted.sharedMemoIds ?? [],
          };
        }
        if (version <= 3) {
          persisted = { ...persisted, recentPlaces: persisted.recentPlaces ?? [] };
        }
        return persisted;
      },
    },
  ),
);

// ============================================================
// メモストア
// ============================================================
interface MemoState {
  memos: Memo[];

  // CRUD
  addMemo: (title: string) => Memo;
  updateMemo: (id: string, partial: Partial<Pick<Memo, 'title' | 'notificationEnabled' | 'autoDisabledNotification' | 'items' | 'locations'>>) => void;
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

      updateMemo: (id, partial) =>
        set(state => ({
          memos: state.memos.map(m =>
            m.id === id ? { ...m, ...partial, updatedAt: Date.now() } : m,
          ),
        })),

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
        if (!memo || memo.locations.length >= 3) return null;

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
        return location;
      },

      updateLocation: (memoId, locationId, partial) =>
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
        })),

      deleteLocation: (memoId, locationId) =>
        set(state => ({
          memos: state.memos.map(m => {
            if (m.id !== memoId) return m;
            return {
              ...m,
              locations: m.locations.filter(l => l.id !== locationId),
              updatedAt: Date.now(),
            };
          }),
        })),

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
          items: data.items.map(it => ({ ...it, id: generateId() })),
          locations: data.locations.map(loc => ({ ...loc, id: generateId() })),
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
