/**
 * デバッグビルド専用: テスト用メモのシードデータ投入
 *
 * アプリ起動時にメモが0件の場合のみ、サンプルデータを自動作成する。
 * __DEV__ ガード付きなのでリリースビルドには一切含まれない。
 */
import { useMemoStore } from '../store/memoStore';
import { generateId } from './helpers';
import type { Memo, ShoppingItem, MemoLocation } from '../types';

function item(name: string, checked = false): ShoppingItem {
  return {
    id: generateId(),
    name,
    isChecked: checked,
    ...(checked ? { checkedAt: Date.now() } : {}),
  };
}

function location(
  label: string,
  lat: number,
  lng: number,
  opts?: { radius?: number; address?: string; triggerType?: 'enter' | 'exit' },
): MemoLocation {
  return {
    id: generateId(),
    label,
    latitude: lat,
    longitude: lng,
    radius: opts?.radius ?? 200,
    address: opts?.address,
    triggerType: opts?.triggerType ?? 'enter',
  };
}

function memo(
  title: string,
  items: ShoppingItem[],
  locations: MemoLocation[],
  opts?: { notificationEnabled?: boolean; dueDate?: number; note?: string },
): Memo {
  const now = Date.now();
  return {
    id: generateId(),
    title,
    items,
    locations,
    notificationEnabled: opts?.notificationEnabled ?? true,
    ...(opts?.dueDate != null ? { dueDate: opts.dueDate } : {}),
    ...(opts?.note ? { note: opts.note } : {}),
    createdAt: now,
    updatedAt: now,
  };
}

const SEED_MEMOS: Memo[] = [
  memo(
    '今日の買い物',
    [
      item('牛乳'),
      item('たまご 10個入り'),
      item('食パン 6枚切り'),
      item('バナナ'),
      item('鶏もも肉 2パック'),
      item('玉ねぎ 3個'),
      item('ヨーグルト', true),
      item('お米 5kg', true),
    ],
    [
      location('ライフ 桜新町店', 35.6318, 139.6445, {
        address: '東京都世田谷区桜新町',
      }),
    ],
    { note: '今週のポイント3倍デー' },
  ),
  memo(
    '週末のホームパーティー準備',
    [
      item('ワイン 赤・白 各1本'),
      item('チーズ盛り合わせ'),
      item('生ハム'),
      item('バゲット'),
      item('サラダ用野菜'),
      item('紙皿・紙コップ'),
    ],
    [
      location('成城石井 二子玉川店', 35.6117, 139.6264, {
        address: '東京都世田谷区玉川',
        radius: 150,
      }),
      location('カルディ 二子玉川ライズ店', 35.6112, 139.6256, {
        address: '東京都世田谷区玉川',
        radius: 100,
      }),
    ],
    {
      dueDate: Date.now() + 3 * 24 * 60 * 60 * 1000,
      note: '土曜 18:00〜 6人分',
    },
  ),
  memo(
    'ドラッグストア',
    [
      item('日焼け止め'),
      item('ハンドソープ 詰替え'),
      item('歯ブラシ'),
      item('ティッシュ 5箱', true),
      item('洗濯洗剤', true),
    ],
    [
      location('マツモトキヨシ 三軒茶屋店', 35.6437, 139.6700, {
        address: '東京都世田谷区三軒茶屋',
      }),
    ],
  ),
  memo(
    '帰りにクリーニング受取',
    [
      item('スーツ（上下）'),
      item('ワイシャツ 3枚'),
    ],
    [
      location('ホワイト急便 用賀駅前店', 35.6264, 139.6340, {
        address: '東京都世田谷区用賀',
        triggerType: 'exit',
        radius: 100,
      }),
    ],
  ),
];

/**
 * デバッグ用シードデータを投入する。
 * メモが既に存在する場合は何もしない。
 */
export function seedDevMemos(): void {
  if (!__DEV__) return;

  const { memos } = useMemoStore.getState();
  if (memos.length > 0) return;

  useMemoStore.setState(state => ({
    memos: [...SEED_MEMOS, ...state.memos],
  }));

  console.log(`[devSeed] ${SEED_MEMOS.length} 件のテストメモを投入しました`);
}
