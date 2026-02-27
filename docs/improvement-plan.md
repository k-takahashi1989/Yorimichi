# Yorimichi 改善計画

> 最終更新: 2026-02-28（versionCode 8 / versionName 1.0.6）

## 1. 実装済み変更

### 操作フロー

| # | 内容 | 対応ファイル | コミット |
|---|---|---|---|
| #1 | チェック解除時の確認ダイアログを廃止し、即時実行 + Snackbar「元に戻す」に変更 | `MemoDetailScreen.tsx`, `Snackbar.tsx`（新規）| `0187b9b` |
| #3 | 場所チップに「編集ペン」ボタンを追加し、`LocationPickerScreen` に `existingLocationId` を渡して編集モードで開けるようにした | `MemoDetailScreen.tsx` | `0187b9b` |
| #12 | ドラッグハンドルによる並べ替えを実装。`react-native-draggable-flatlist` を導入し、ロングプレスでアイテムを上下に移動できるようになった。ストアに `reorderItems` アクションを追加 | `MemoEditScreen.tsx`, `memoStore.ts` | `d6c2c6f` |

### 通知の動作バグ

| # | 内容 | 対応ファイル | コミット |
|---|---|---|---|
| #9 | 通知 ID を `arrival-${memoId}` → `arrival-${memoId}-${locationId}` に変更。同一メモの複数場所に同時進入しても通知が上書きされなくなった | `notificationService.ts`, `geofenceService.ts` | `0187b9b` |
| #10 | 通知タイトル・本文をハードコード日本語から `i18n.t()` 経由に変更。英語設定ユーザーにも英語で通知が届く | `notificationService.ts`, `ja.ts`, `en.ts` | `0187b9b` |
| — | YorimichiGeofence バックグラウンドサービスの `taskDesc` もハードコード日本語から `i18n.t('geofence.taskDesc')` に変更 | `geofenceService.ts`, `ja.ts`, `en.ts` | `d6c2c6f` |

### データ・操作の安全性

| # | 内容 | 対応ファイル | コミット |
|---|---|---|---|
| #21 | `isSavingRef` を追加し、`handleDone` 実行中は `onBlur` の `handleSaveTitle` をスキップすることで二重保存を防止 | `MemoEditScreen.tsx` | `0187b9b` |
| #22 | アイテム入力欄（既存・新規）に `maxLength={50}` を設定しレイアウト崩れを防止 | `MemoEditScreen.tsx` | `0187b9b` |
| #23 | `loadInsideCache` の catch 内でキャッシュをリセット（`storage.remove`）し、DEV 環境でログ出力。キャッシュ破損時も次回進入で再通知される | `geofenceService.ts` | `0187b9b` |

### UI 整合性

| # | 内容 | 対応ファイル | コミット |
|---|---|---|---|
| #15 | 半径スライダーのステップ値を `LocationPickerScreen`（1m→10m）・`SettingsScreen`（50m→10m）で統一。10m 刻みで直感的に操作できる | `LocationPickerScreen.tsx`, `SettingsScreen.tsx` | `d6c2c6f` |
| #16 | `MemoDetailScreen` にバックグラウンド監視状態のポーリングを追加。監視OFF時は通知ベルをオレンジ色にし「⚠️ リマインドが停止中です」警告テキストを表示 | `MemoDetailScreen.tsx`, `ja.ts`, `en.ts` | `d6c2c6f` |
| #17 | 設定画面のバージョン表示を `'1.0.4'` ハードコードから `react-native-device-info` の `DeviceInfo.getVersion()` に変更。リリース毎に自動更新される | `SettingsScreen.tsx` | `d6c2c6f` |

### パフォーマンス

| # | 内容 | 対応ファイル | コミット |
|---|---|---|---|
| #28 | `getMemoById` セレクターを `useShallow(s => s.memos.find(...))` に変更し、無関係なストア更新での再レンダリングを抑制 | `MemoDetailScreen.tsx` | `0187b9b` |
| #29 | `renderItem` を `useCallback` でラップし、FlatList の不要な全アイテム再レンダリングを抑制 | `MemoListScreen.tsx` | `0187b9b` |
| #30 | `ScrollView` 内の `FlatList`（`scrollEnabled={false}`）を `DraggableFlatList` に置き換え（#12 対応と同時に解消） | `MemoEditScreen.tsx` | `d6c2c6f` |
| #31 | チュートリアル座標計測を `setTimeout` 固定遅延から `InteractionManager.runAfterInteractions` + 小遅延に変更し、描画遅延の影響を受けにくくした | `useTutorial.ts` | `0187b9b` |

### その他バグ修正

| 内容 | 対応ファイル | コミット |
|---|---|---|
| Snackbar がホームボタンに重なる問題を `useSafeAreaInsets` で修正。`bottom: insets.bottom + 16` にしてセーフエリアを回避 | `Snackbar.tsx` | `d6c2c6f` |
| MMKV の `storage.delete()` は存在しないメソッド。`storage.remove()` に修正 | `geofenceService.ts` | `d6c2c6f` |

---

## 2. 未対応 — UI 不整合・欠落（具体的な修正案）

### #13 完了メモの視覚フィードバックがない
**問題:** `cardCompleted` スタイル（`opacity: 0.6`）が定義済みだが、全アイテムがチェック済みのメモカードに適用されていない。

**修正案:** `MemoListScreen.tsx` の `renderItem` 内で条件スタイルを適用。

```tsx
// 全アイテムがチェック済みかどうか判定
const isCompleted = total > 0 && unchecked === 0;
// カードに適用
<TouchableOpacity style={[styles.card, isCompleted && styles.cardCompleted]} ...>
```

### #14 空状態のアイコンが内容と不一致
**問題:** メモが0件のときに `alt-route`（ルート分岐）アイコンを表示。ショッピングメモアプリとして直感的でない。

**修正案:** `MemoListScreen.tsx` のアイコンを変更。

```tsx
// before
<Icon name="alt-route" size={64} color="#E0E0E0" />
// after
<Icon name="shopping-cart" size={64} color="#E0E0E0" />
```

---

## 3. データ安全性 #23（補足）

`loadInsideCache` のキャッシュ破損対応は v1 として **リセット方式**で実装済み（`storage.remove` を使用）。
将来的により堅牢にする場合の選択肢:

| 方針 | 内容 | 採用条件 |
|---|---|---|
| **a. 現行（リセット）** | 破損時は空にリセット。次回進入で再通知される | ✅ 現在採用 |
| b. スキーマバージョン管理 | キャッシュに `{ version: 1, ids: [...] }` 形式で保存し、バージョン不一致でリセット | MMKV データ形式を変更する場合に有効 |
| c. エラー通知 | Settings 画面で「キャッシュ異常を検出しました。リセットしました」のバナーを表示 | ユーザー数が増えてエラー頻度を把握したい場合 |

---

## 4. 将来機能の設計方針

### #32 スワイプ削除

**設計方針:**
- `react-native-gesture-handler` はすでに依存に含まれているため追加インストール不要
- `Swipeable` コンポーネントで左スワイプ時に赤い削除アクションを表示
- `MemoListScreen` の FlatList 各アイテムを `Swipeable` でラップ
- 既存の `handleDelete`（確認ダイアログ付き）をスワイプアクションに流用

### #33 ソート・フィルタ

**設計方針:**
- `SettingsStore` または URL パラメータでソート種別（更新日降順・タイトル昇順）を保持
- `MemoListScreen` の `useMemo` でフィルタリング後の配列を生成
- UI: リスト上部に小さなセグメントコントロール（全件 / 未完了のみ）

### #34 バックグラウンドサービス状態の UI 同期

**設計方針:**
- `BackgroundService.isRunning()` をポーリングするのではなく、React Native AppState（`change` イベント）でフォアグラウンド復帰時に同期
- `SettingsStore` に `isMonitoring` 状態を追加し、`startGeofenceMonitoring` / `stop` 時に更新
- MemoDetailScreen の #16 警告表示もこの状態を参照する

### #35 ネイティブ Geofencing API 移行

**設計方針:**
- 現状: `react-native-background-actions` + 10秒ポーリング（バッテリー消費大）
- 目標: Android `GeofencingClient` (Google Play Services) をネイティブモジュール経由で使用
- 実装方法:
  1. `android/app/src/main/java/.../GeofenceModule.kt` を新規作成
  2. `addGeofence(lat, lng, radius, memoId, locationId)` / `removeGeofence` / `clearAll` のメソッドを公開
  3. `BroadcastReceiver` で進入イベントを受け取り、JS 側に `DeviceEventEmitter` で通知
  4. `geofenceService.ts` のポーリングロジックをネイティブモジュール呼び出しに置き換え
- 期待効果: バッテリー消費約 80% 削減、精度向上

### #36 場所検索履歴

**設計方針:**
- `SettingsStore` に `recentPlaces: { placeId: string; name: string; lat: number; lng: number }[]`（最大10件）を追加
- `LocationPickerScreen` の `handlePlaceSelected` 時に先頭に追加（重複は排除）
- 検索フォームに入力前は `recentPlaces` をサジェストとして表示
- 3文字以上入力後は Google Places API を呼び出す（debounce 500ms）
