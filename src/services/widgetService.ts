import { NativeModules, Platform } from 'react-native';
import type { Memo } from '../types';

const { WidgetBridge } = NativeModules;

/**
 * メモデータをウィジェットに同期する。
 * memoStore の変更時に呼び出す。
 */
export function syncWidget(memos: Memo[]): void {
  if (Platform.OS !== 'android' || !WidgetBridge) return;

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const todayEnd = todayStart + 86400000; // +1日

  const summaries = memos.map(memo => {
    const uncheckedItems = memo.items.filter(i => !i.isChecked).length;
    const locationLabel = memo.locations.length > 0
      ? memo.locations.map(l => l.label).join(' / ')
      : '';

    return {
      id: memo.id,
      title: memo.title,
      totalItems: memo.items.length,
      uncheckedItems,
      locationLabel,
      dueDate: memo.dueDate ?? 0,
      isOverdue: memo.dueDate != null && memo.dueDate < todayStart,
      isDueToday: memo.dueDate != null && memo.dueDate >= todayStart && memo.dueDate < todayEnd,
    };
  });

  try {
    WidgetBridge.updateWidget(JSON.stringify(summaries));
  } catch {
    // ウィジェット更新失敗は無視（クラッシュさせない）
  }
}
