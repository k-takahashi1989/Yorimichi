# Yorimichi 改善計画

## 1. 実装済み変更

### 操作フロー

| # | 内容 | 対応ファイル |
|---|---|---|
| #1 | チェック解除時の確認ダイアログを廃止し、即時実行 + Snackbar「元に戻す」に変更 | `MemoDetailScreen.tsx`, `Snackbar.tsx`（新規）|
| #3 | 場所チップに「編集ペン」ボタンを追加し、`LocationPickerScreen` に `existingLocationId` を渡して編集モードで開けるようにした | `MemoDetailScreen.tsx` |

### 通知の動作バグ

| # | 内容 | 対応ファイル |
|---|---|---|
| #9 | 通知 ID を `arrival-${memoId}` → `arrival-${memoId}-${locationId}` に変更。同一メモの複数場所に同時進入しても通知が上書きされなくなった | `notificationService.ts`, `geofenceService.ts` |
| #10 | 通知タイトル・本文をハードコード日本語から `i18n.t()` 経由に変更。英語設定ユーザーにも英語で通知が届く | `notificationService.ts`, `ja.ts`, `en.ts` |

### データ・操作の安全性

| # | 内容 | 対応ファイル |
|---|---|---|
| #21 | `isSavingRef` を追加し、`handleDone` 実行中は `onBlur` の `handleSaveTitle` をスキップすることで二重保存を防止 | `MemoEditScreen.tsx` |
| #22 | アイテム入力欄（既存・新規）に `maxLength={50}` を設定しレイアウト崩れを防止 | `MemoEditScreen.tsx` |
| #23 | `loadInsideCache` の catch 内でキャッシュをリセット（`storage.delete`）し、DEV 環境でログ出力。キャッシュ破損時も次回進入で再通知される | `geofenceService.ts` |

### パフォーマンス

| # | 内容 | 対応ファイル |
|---|---|---|
| #28 | `getMemoById` セレクターを `useShallow(s => s.memos.find(...))` に変更し、無関係なストア更新での再レンダリングを抑制 | `MemoDetailScreen.tsx` |
| #29 | `renderItem` を `useCallback` でラップし、FlatList の不要な全アイテム再レンダリングを抑制 | `MemoListScreen.tsx` |
| #30 | `ScrollView` 内の `FlatList`（`scrollEnabled={false}`）を `Array.map()` に置き換え。仮想化が効かない状況での FlatList のオーバーヘッドを排除 | `MemoEditScreen.tsx` |
| #31 | チュートリアル座標計測を `setTimeout` 固定遅延から `InteractionManager.runAfterInteractions` + 小遅延に変更し、描画遅延の影響を受けにくくした | `useTutorial.ts` |

---

## 2. 未対応 — UI 不整合・欠落（具体的な修正案）

### #12 ドラッグハンドルが機能しない
**問題:** `MemoEditScreen` のアイテム行に `drag-handle` アイコンが表示されているが、ドラッグ並べ替えは未実装。ユーザーが触っても何も起きない。

**修正案:**
- `react-native-draggable-flatlist`（MIT ライセンス、既存 `FlatList` の代替）を導入
- `currentItems` の順番を変更する `reorderItems(memoId, fromIndex, toIndex)` アクションをストアに追加
- アイコンを `drag-handle` のまま使用し、ドラッグ時のスタイル（影・スケール）を追加
- `memos.map()` から `DraggableFlatList` に戻す必要があるため #30 との調整が必要

```typescript
// memoStore.ts に追加
reorderItems: (memoId, fromIndex, toIndex) =>
  set(state => ({
    memos: state.memos.map(m => {
      if (m.id !== memoId) return m;
      const items = [...m.items];
      const [moved] = items.splice(fromIndex, 1);
      items.splice(toIndex, 0, moved);
      return { ...m, items, updatedAt: Date.now() };
    }),
  })),
```

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

### #15 半径のステップ値がLocationPickerとSettingsで異なる
**問題:**
- `LocationPickerScreen` のスライダー: `step={1}`（1m刻み）
- `SettingsScreen` のデフォルト半径スライダー: `step={50}`（50m刻み）

**修正案:** 共通定数を `src/utils/constants.ts`（新規）に定義し両方から参照。

```typescript
// src/utils/constants.ts
export const RADIUS_STEP = 10; // 10m刻みがユーザーにとって操作しやすい粒度
export const RADIUS_MIN = 50;
```

### #16 バックグラウンド監視OFF時も通知ベルが「有効」に見える
**問題:** `notificationEnabled=true` でも、バックグラウンドサービスが停止中なら通知は届かない。ユーザーに誤解を与える。

**修正案:** `MemoDetailScreen.tsx` の通知ベルアイコン部分でサービス状態を確認して警告表示。

```tsx
import BackgroundService from 'react-native-background-actions';

// コンポーネント内
const isMonitoring = BackgroundService.isRunning();

// JSXで
<Icon
  name={memo.notificationEnabled ? 'notifications' : 'notifications-off'}
  size={22}
  color={
    !memo.notificationEnabled ? '#9E9E9E'
    : isMonitoring ? '#4CAF50'
    : '#FF9800' // オレンジ = 通知ON だが監視停止中
  }
/>
// 監視停止中なら警告テキストを表示
{memo.notificationEnabled && !isMonitoring && (
  <Text style={styles.monitoringWarning}>{t('memoDetail.monitoringStopped')}</Text>
)}
```

### #17 バージョン番号のハードコード
**問題:** `SettingsScreen.tsx` でバージョンが `'1.0.4'` にハードコードされており、リリース毎に手動更新が必要。

**修正案:** `react-native-device-info` を使用（既存パッケージの確認要）。

```typescript
import DeviceInfo from 'react-native-device-info';

// バージョン文字列の取得
const version = DeviceInfo.getVersion(); // '1.0.6'
// SettingsScreen の表示
t('settings.appInfo.version', { version })
```

---

## 3. 未対応 — データ・操作の安全性 #23（実装済みだが補足）

`loadInsideCache` のキャッシュ破損対応は v1 として **リセット方式**で実装済み。
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
