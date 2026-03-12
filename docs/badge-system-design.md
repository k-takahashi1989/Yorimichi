# バッジシステム設計（4月実装予定）

## コンセプト

「気づいたら集まってた」くらいのゆるさ。頑張らなくても自然に解除されていく設計。
サブスク収益ではなく**リテンション目的のゲーミフィケーション**要素。

---

## アーキテクチャ

| 要素 | 詳細 |
|---|---|
| バッジ定義 | `src/config/badgeDefinitions.ts`（静的データ） |
| 解除判定 | `src/services/badgeService.ts` |
| 状態管理 | `memoStore.ts` の `SettingsStore` に追加 |
| 永続化 | Firestore `badges/{deviceId}` + MMKV ローカルキャッシュ |
| 解除演出 | `src/components/BadgeUnlockModal.tsx`（モーダル） |
| 表示場所 | `SettingsScreen` 内バッジセクション |
| アイコン | Flaticon から PNG/SVG を取得（`src/assets/badges/` に格納） |

---

## 解除トリガーと判定タイミング

| トリガー | 判定するバッジカテゴリ |
|---|---|
| ジオフェンス到着 | 訪問系・時間系・隠し系 |
| メモ作成 | メモ系 |
| アイテム完了 | リスト系 |
| 共有実行 | 共有系 |
| アプリ起動時 | 累計系・隠し（streak・anniversary） |

---

## バッジ一覧（27個）

### 🗺️ 訪問系（7個）

| ID | 名前（ja） | 名前（en） | 解除条件 |
|---|---|---|---|
| `visit_first` | はじめての訪問 | First Visit | 初めて地点に到着 |
| `visit_10` | 常連さん | Regular | 累計訪問10回 |
| `visit_50` | ベテランショッパー | Veteran Shopper | 累計訪問50回 |
| `visit_100` | 買い物マスター | Shopping Master | 累計訪問100回 |
| `visit_places_5` | 探検家 | Explorer | 異なる5か所を訪問 |
| `visit_places_10` | 旅人 | Traveler | 異なる10か所を訪問 |
| `visit_places_20` | 地図職人 | Map Master | 異なる20か所を訪問 |

### 📝 メモ・リスト系（6個）

| ID | 名前（ja） | 名前（en） | 解除条件 |
|---|---|---|---|
| `memo_first` | はじめの一歩 | First Step | 初めてメモを作成 |
| `memo_5` | コレクター | Collector | メモを5件以上作成 |
| `item_complete_first` | お買い物完了 | Task Done | 初めて全アイテムを完了 |
| `item_complete_50` | ピッカー | Picker | 累計アイテム50個を完了 |
| `item_complete_100` | 買いものの達人 | Shopping Pro | 累計アイテム100個を完了 |
| `memo_full_list` | リスト職人 | List Maker | 1メモに10個以上のアイテムを作成 |

### 🤝 共有系（4個）

| ID | 名前（ja） | 名前（en） | 解除条件 |
|---|---|---|---|
| `share_first` | はじめての共有 | First Share | 初めてメモを共有 |
| `share_collab_3` | チームワーク | Teamwork | 共有メモで3人以上が参加 |
| `share_5` | ソーシャルショッパー | Social Shopper | 5つのメモを共有 |
| `share_complete_10` | コミュニティ | Community | 共有メモでアイテムを合計10回完了 |

### 🌙 時間系（3個）

| ID | 名前（ja） | 名前（en） | 解除条件 |
|---|---|---|---|
| `time_night` | 夜型ショッパー | Night Owl | 23時〜翌1時に訪問 |
| `time_morning` | 朝活 | Early Bird | 6時〜8時に訪問 |
| `time_weekend_10` | 週末の達人 | Weekend Warrior | 土日に合計10回訪問 |

### 🔒 隠しバッジ（4個、条件非公開）

| ID | 名前（ja） | 名前（en） | 解除条件 |
|---|---|---|---|
| `hidden_midnight` | ??? | ??? | 深夜0時ちょうど（00:00〜00:05）に訪問 |
| `hidden_anniversary` | ??? | ??? | アプリ初起動から365日後に起動 |
| `hidden_streak` | ??? | ??? | 7日連続でアプリを起動 |
| `hidden_visit_back` | ??? | ??? | 7日以内に同じ地点を3回訪問 |

> 隠しバッジは一覧に「???」として表示される。存在は認識できるが条件は非公開。

---

## データ設計

### Firestore スキーマ

```
badges/{deviceId}
  unlockedBadges: string[]     // 解除済みバッジIDの配列
  updatedAt: Timestamp
```

### SettingsStore 追加フィールド

```ts
// state
unlockedBadges: string[]       // 解除済みバッジIDの配列
firstLaunchDate: number        // hidden_anniversary 判定用（ms）
lastLaunchDates: number[]      // hidden_streak 判定用（直近7日分のタイムスタンプ）
totalVisitCount: number        // 訪問系バッジの累計カウント
visitedPlaceIds: string[]      // 訪問済み地点IDの重複なしリスト
totalItemsCompleted: number    // リスト系バッジの累計カウント
totalSharedMemos: number       // 共有系バッジの累計カウント

// actions
unlockBadge: (id: string) => Promise<void>
```

### memoStore バージョン

ストア `version` を **9** に上げ、マイグレーションで初期値を追加：

```ts
unlockedBadges: [],
firstLaunchDate: Date.now(),
lastLaunchDates: [],
totalVisitCount: persisted.totalVisitCount ?? 0,
visitedPlaceIds: persisted.visitedPlaceIds ?? [],
totalItemsCompleted: persisted.totalItemsCompleted ?? 0,
totalSharedMemos: persisted.totalSharedMemos ?? 0,
```

---

## バッジ定義の型

```ts
// src/config/badgeDefinitions.ts
export type BadgeCategory = 'visit' | 'memo' | 'share' | 'time' | 'hidden';

export interface BadgeDefinition {
  id: string;
  category: BadgeCategory;
  nameKey: string;           // i18n キー
  descriptionKey: string;    // i18n キー
  icon: ImageSourcePropType; // require('../assets/badges/xxx.png')
  hidden: boolean;           // true = 条件を「???」表示
}
```

---

## UI 設計

### SettingsScreen バッジセクション

- カテゴリタブ（訪問 / メモ / 共有 / 時間 / 隠し）で切り替え
- グリッドレイアウト（3列）
- **未解除**：グレーアウト + ロックアイコン重ね表示
- **隠し未解除**：名前・説明・アイコンすべて「???」
- **解除済み**：フルカラー + 解除日時をサブテキストで表示

### BadgeUnlockModal

- バッジアイコン（大 72px）+ 名前 + 説明文
- スケールアニメーション（Animated.spring）
- 背景に軽い紙吹雪エフェクト（`react-native-confetti-cannon` または自前実装）
- 複数同時解除時はキューで1枚ずつ表示
- 「やったね！」ボタンで閉じる

---

## アイコン素材

- **ソース**：Flaticon（`flaticon.com`）
- **形式**：PNG 推奨（64x64 または 128x128）
- **格納場所**：`src/assets/badges/`
- **命名規則**：`badge_{id}.png`（例：`badge_visit_first.png`）
- **ライセンス**：Flaticon 利用規約に従いクレジット表記またはプレミアムプランで対応

---

## 実装フェーズ

| フェーズ | 内容 | ファイル |
|---|---|---|
| 1 | バッジ定義・型定義 | `src/config/badgeDefinitions.ts` |
| 2 | ストア拡張・マイグレーション | `src/store/memoStore.ts` |
| 3 | 解除判定サービス | `src/services/badgeService.ts` |
| 4 | 各トリガー箇所への判定呼び出し追加 | `geofenceService.ts`, `memoStore.ts` など |
| 5 | BadgeUnlockModal | `src/components/BadgeUnlockModal.tsx` |
| 6 | バッジ一覧UI（SettingsScreen） | `src/screens/SettingsScreen.tsx` |
| 7 | i18n追加 | `src/i18n/locales/ja.ts`, `en.ts` |
| 8 | Firestoreルール追加 | `firestore.rules` |

---

## 未決定事項

- 隠しバッジの実際の名前・説明文（解除後に表示するテキスト）
- 紙吹雪アニメーションのライブラリ選定（外部ライブラリ or 自前）
- Flaticon のライセンス対応方針（無料＋クレジット or 有料プラン）
