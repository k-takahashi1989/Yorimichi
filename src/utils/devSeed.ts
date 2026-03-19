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
    '週末の買い物リスト',
    [
      item('牛乳'),
      item('卵'),
      item('食パン'),
      item('バナナ'),
      item('ヨーグルト', true),
    ],
    [
      location('イオン新百合ヶ丘', 35.6037, 139.5079, {
        address: '神奈川県川崎市麻生区',
      }),
    ],
    { note: 'セールは土曜のみ' },
  ),
  memo(
    'ドラッグストア',
    [
      item('シャンプー'),
      item('歯磨き粉'),
      item('ティッシュ 5箱', true),
    ],
    [
      location('マツモトキヨシ 新宿店', 35.6938, 139.7034, {
        address: '東京都新宿区',
        radius: 150,
      }),
    ],
  ),
  memo(
    'ホームセンター',
    [
      item('電池 単3'),
      item('ゴミ袋 45L'),
      item('結束バンド'),
      item('養生テープ'),
    ],
    [
      location('カインズ 町田店', 35.5486, 139.4383, {
        address: '東京都町田市',
        radius: 300,
      }),
      location('コーナン 相模原店', 35.5711, 139.3726, {
        address: '神奈川県相模原市',
      }),
    ],
    {
      dueDate: Date.now() + 3 * 24 * 60 * 60 * 1000, // 3日後
      note: 'DIY用。サイズ確認してから買う',
    },
  ),
  memo(
    '帰りに寄る（通知テスト用）',
    [item('クリーニング受取'), item('ATMで記帳')],
    [
      location('駅前クリーニング', 35.6284, 139.7387, {
        address: '東京都品川区',
        triggerType: 'exit',
        radius: 100,
      }),
    ],
    { notificationEnabled: true },
  ),
  memo(
    '通知OFF テスト',
    [item('あとで確認する')],
    [],
    { notificationEnabled: false },
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
