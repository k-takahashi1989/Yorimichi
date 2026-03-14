// ============================================================
// データモデルの型定義
// ============================================================

export interface ShoppingItem {
  id: string;
  name: string;
  isChecked: boolean;
  checkedAt?: number;
}

export type TriggerType = 'enter' | 'exit';

export interface MemoLocation {
  id: string;
  label: string;        // ユーザーが付けた名前 (例: "スーパー三和")
  latitude: number;
  longitude: number;
  radius: number;       // ジオフェンス半径 (メートル)
  address?: string;     // 逆ジオコーディングで取得した住所 (町名まで)
  triggerType?: TriggerType; // 'enter'=到着時(デフォルト), 'exit'=出発時
}

export interface RecentPlace {
  label: string;
  latitude: number;
  longitude: number;
  address?: string;
}

export type NotificationMode = 'silent' | 'push' | 'alarm';

export interface Memo {
  id: string;
  title: string;
  items: ShoppingItem[];
  locations: MemoLocation[];   // 最大3か所
  notificationEnabled: boolean;
  autoDisabledNotification?: boolean; // 全チェック時に自動でOFFにした場合 true
  notificationMode?: NotificationMode; // undefined = 'push' 相当（後方互換）
  dueDate?: number;            // 期限日 (Unix ms, 日付のみ)
  note?: string;               // メモ全体への補足ノート（自由テキスト）
  createdAt: number;           // Unix タイムスタンプ (ms)
  updatedAt: number;
  // 共有機能
  shareId?: string;            // Firestore ドキュメント ID（共有済みの場合のみ）
  isOwner?: boolean;           // true = 共有の送信者
}

export interface SharePresence {
  deviceId: string;
  editingAt: number;           // Unix タイムスタンプ (ms)
}

export interface SharedMemoDoc {
  title: string;
  items: ShoppingItem[];
  locations: MemoLocation[];
  note?: string;
  updatedAt: number;
  ownerDeviceId: string;
  collaborators: string[];
  // Firebase Auth UID ベースの所有者・参加者（セキュリティルール検証用）
  ownerUid?: string;
  collaboratorUids?: string[];
  // deviceId をキーとするプレゼンスマップ（複数人対応）
  presences: Record<string, SharePresence>;
}

// ============================================================
// ナビゲーション パラメータ型
// ============================================================

export interface PickedLocationParam {
  label: string;
  latitude: number;
  longitude: number;
  radius: number;
  triggerType?: TriggerType;
  address?: string;
}

export type RootStackParamList = {
  Onboarding: undefined;
  MainTabs: undefined;
  MemoDetail: { memoId: string };
  MemoEdit: {
    memoId?: string;                               // undefined = 新規作成
    pickedLocation?: PickedLocationParam;           // 場所選択フローから渡されるデータ
  };
  LocationPicker: {
    memoId?: string;                               // undefined = スタンドアロン（新規作成フロー）
    existingLocationId?: string;                   // undefined = 新規追加
  };
  Premium: undefined;
  BadgeList: undefined;
};

export type MainTabParamList = {
  MemoList: undefined;
  Settings: undefined;
};
