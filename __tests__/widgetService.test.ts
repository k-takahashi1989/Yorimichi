import { NativeModules, Platform } from 'react-native';
import type { Memo } from '../src/types';

// WidgetBridge モック
const mockUpdateWidget = jest.fn();
NativeModules.WidgetBridge = { updateWidget: mockUpdateWidget };

// テスト対象
const { syncWidget } = require('../src/services/widgetService');

/** ヘルパー: 最小限の Memo を生成 */
function makeMemo(overrides: Partial<Memo> = {}): Memo {
  return {
    id: 'memo-1',
    title: 'テストメモ',
    items: [],
    locations: [],
    notificationEnabled: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  Platform.OS = 'android';
});

// ============================================================
// プラットフォーム分岐
// ============================================================

describe('syncWidget - プラットフォーム分岐', () => {
  it('iOS では何もしない', () => {
    Platform.OS = 'ios';
    syncWidget([makeMemo()]);
    expect(mockUpdateWidget).not.toHaveBeenCalled();
  });

  it('WidgetBridge が未定義なら何もしない', () => {
    const original = NativeModules.WidgetBridge;
    NativeModules.WidgetBridge = undefined;

    // モジュールを再ロードして WidgetBridge = undefined を反映
    jest.resetModules();
    const { syncWidget: fresh } = require('../src/services/widgetService');
    fresh([makeMemo()]);
    expect(mockUpdateWidget).not.toHaveBeenCalled();

    // 元に戻す
    NativeModules.WidgetBridge = original;
  });
});

// ============================================================
// データマッピング
// ============================================================

describe('syncWidget - データマッピング', () => {
  it('空配列は空JSON配列を送る', () => {
    syncWidget([]);
    expect(mockUpdateWidget).toHaveBeenCalledWith('[]');
  });

  it('基本フィールドを正しくマッピングする', () => {
    const memo = makeMemo({
      id: 'abc',
      title: '買い物リスト',
      items: [
        { id: '1', name: '牛乳', isChecked: false },
        { id: '2', name: '卵', isChecked: true, checkedAt: Date.now() },
        { id: '3', name: 'パン', isChecked: false },
      ],
    });
    syncWidget([memo]);

    const summaries = JSON.parse(mockUpdateWidget.mock.calls[0][0]);
    expect(summaries).toHaveLength(1);
    expect(summaries[0]).toMatchObject({
      id: 'abc',
      title: '買い物リスト',
      totalItems: 3,
      uncheckedItems: 2,
    });
  });

  it('location ラベルを " / " で結合する', () => {
    const memo = makeMemo({
      locations: [
        { id: 'l1', label: 'イオン', latitude: 35, longitude: 139, radius: 100 },
        { id: 'l2', label: 'コンビニ', latitude: 35, longitude: 139, radius: 100 },
      ],
    });
    syncWidget([memo]);

    const summaries = JSON.parse(mockUpdateWidget.mock.calls[0][0]);
    expect(summaries[0].locationLabel).toBe('イオン / コンビニ');
  });

  it('location が無い場合は空文字', () => {
    syncWidget([makeMemo({ locations: [] })]);
    const summaries = JSON.parse(mockUpdateWidget.mock.calls[0][0]);
    expect(summaries[0].locationLabel).toBe('');
  });

  it('dueDate が未設定なら 0 を返す', () => {
    syncWidget([makeMemo({ dueDate: undefined })]);
    const summaries = JSON.parse(mockUpdateWidget.mock.calls[0][0]);
    expect(summaries[0].dueDate).toBe(0);
    expect(summaries[0].isOverdue).toBe(false);
    expect(summaries[0].isDueToday).toBe(false);
  });
});

// ============================================================
// 期日判定
// ============================================================

describe('syncWidget - 期日判定', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('過去の dueDate は isOverdue=true', () => {
    // 現在: 2026-03-13 12:00
    jest.setSystemTime(new Date(2026, 2, 13, 12, 0, 0));
    const yesterday = new Date(2026, 2, 12, 0, 0, 0).getTime();

    syncWidget([makeMemo({ dueDate: yesterday })]);
    const summaries = JSON.parse(mockUpdateWidget.mock.calls[0][0]);
    expect(summaries[0].isOverdue).toBe(true);
    expect(summaries[0].isDueToday).toBe(false);
  });

  it('今日の dueDate は isDueToday=true', () => {
    jest.setSystemTime(new Date(2026, 2, 13, 12, 0, 0));
    const todayMidnight = new Date(2026, 2, 13, 0, 0, 0).getTime();

    syncWidget([makeMemo({ dueDate: todayMidnight })]);
    const summaries = JSON.parse(mockUpdateWidget.mock.calls[0][0]);
    expect(summaries[0].isOverdue).toBe(false);
    expect(summaries[0].isDueToday).toBe(true);
  });

  it('未来の dueDate は isOverdue=false, isDueToday=false', () => {
    jest.setSystemTime(new Date(2026, 2, 13, 12, 0, 0));
    const tomorrow = new Date(2026, 2, 14, 0, 0, 0).getTime();

    syncWidget([makeMemo({ dueDate: tomorrow })]);
    const summaries = JSON.parse(mockUpdateWidget.mock.calls[0][0]);
    expect(summaries[0].isOverdue).toBe(false);
    expect(summaries[0].isDueToday).toBe(false);
  });
});

// ============================================================
// エラーハンドリング
// ============================================================

describe('syncWidget - エラーハンドリング', () => {
  it('WidgetBridge.updateWidget が例外を投げてもクラッシュしない', () => {
    mockUpdateWidget.mockImplementationOnce(() => {
      throw new Error('native crash');
    });

    expect(() => syncWidget([makeMemo()])).not.toThrow();
  });
});

// ============================================================
// 複数メモ
// ============================================================

describe('syncWidget - 複数メモ', () => {
  it('複数メモを正しく変換する', () => {
    const memos = [
      makeMemo({ id: 'm1', title: 'メモ1', items: [{ id: '1', name: 'A', isChecked: false }] }),
      makeMemo({ id: 'm2', title: 'メモ2', items: [{ id: '2', name: 'B', isChecked: true, checkedAt: 0 }] }),
    ];

    syncWidget(memos);
    const summaries = JSON.parse(mockUpdateWidget.mock.calls[0][0]);
    expect(summaries).toHaveLength(2);
    expect(summaries[0].id).toBe('m1');
    expect(summaries[0].uncheckedItems).toBe(1);
    expect(summaries[1].id).toBe('m2');
    expect(summaries[1].uncheckedItems).toBe(0);
  });
});
