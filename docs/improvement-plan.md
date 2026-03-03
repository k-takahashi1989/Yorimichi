# Yorimichi 改善計画

> 最終更新: 2026-03-03（versionCode 9 / versionName 1.0.8）

## 1. 実装済み変更

### 品質修正（2026-03-03）

| Fix | 内容 | 対応ファイル |
|-----|------|-------------|
| Fix#1 | Snackbar「元に戻す」押下後にバーが残る問題を修正。`handleAction` 内の 200ms フェードアウトアニメーションを廃止し、`opacity.setValue(0)` → `onDismiss()` を即時実行するように変更 | `Snackbar.tsx` |
| Fix#2 | 完了スタンプ（「完了」ラベル）が場所テキストと重なる問題を修正。`completedStamp` スタイルを `position: 'absolute'` から通常フロー（`alignSelf: 'flex-end'`, `marginTop: 6`）に変更 | `MemoListScreen.tsx` |
| Fix#3 | 共有メモのチェック操作（個別チェック・全チェック・全解除）を Firestore に即時反映（fire-and-forget）。`updateSharedMemoItems` を `shareService.ts` に追加し、`handleToggleItem` / `handleCheckAllToggle` から呼び出す。sync 時に他ユーザーのチェック状態も保持される | `shareService.ts`, `MemoDetailScreen.tsx` |
| Fix#4 | プッシュ通知タップでメモ詳細を開く（killed 状態対応）。バックグラウンドハンドラーで `memoId` を MMKV の `pendingNotificationMemoId` に保存し、`AppNavigator` の `onReady` で読み出して `navigate('MemoDetail')` を実行 | `index.js`, `AppNavigator.tsx` |
| Fix#5 | sync 複数回実行後に戻るボタンが MemoDetail に留まる問題を修正。`useFocusEffect` 内で `BackHandler` を登録し、常に `navigation.popToTop()` で MemoList に戻るよう統一 | `MemoDetailScreen.tsx` |

### テスト追加（2026-03-03）

| ファイル | 内容 |
|----------|------|
| `__tests__/snackbar.test.tsx`（新規）| Snackbar のアクションボタン押下で `onAction` + `onDismiss` が即時呼ばれることを確認。`visible=false` 時に `pointerEvents=none` になることを確認 |
| `__tests__/features.test.ts` | Fix#3: `updateMemo` で `items` 一括更新・チェック状態保持のテスト追加（3件）|
| `__tests__/features.test.ts` | Fix#4: MMKV `pendingNotificationMemoId` の set/get/remove 動作テスト追加（3件）|
| `__tests__/App.test.tsx` | `GestureHandlerRootView` / `SafeAreaProvider` / `react-native-gesture-handler` のモックを修正し App スモークテストが通るように修正 |
| `jest.config.js` | `react-native-google-mobile-ads`・`@react-native-firebase/firestore`・`@react-native-firebase/auth`・`react-native-device-info` のモックを追加 |

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

---

## 5. 収益化・今後の機能拡張計画

> 検討日: 2026-03-01

### 5-1. 収益化方針

**基本戦略:** 広告（AdMob）＋サブスクリプション（¥250〜300/月）の併用

| フェーズ | MAU | 月収試算 |
|----------|-----|---------|
| リリース直後 | 500 | ¥2,000〜4,000 |
| 成長期 | 5,000 | ¥20,000〜45,000 |
| 安定期 | 50,000 | ¥200,000〜400,000 |

副業収入として成立するラインは **MAU 10,000〜15,000人**が目安。

---

### 5-2. 無料 / プレミアムの機能区分

| 機能 | 無料 | プレミアム |
|------|------|-----------|
| メモ数 | 5件まで | 無制限 |
| 1メモあたり登録地点数 | 2箇所まで | 無制限 |
| 共有人数 | 1対1（2人）まで | 無制限 |
| カテゴリ選択（プリセット） | ✅ | ✅ |
| タグ付け | 3タグまで/メモ | 無制限 |
| カスタムカテゴリ作成 | ✗ | ✅ |
| テンプレート | ✗（チェックリセットで代替）| ✗ |
| 共有メモのアイテム担当割り当て | ✗ | ✅ |
| 商品写真添付 | ✗ | ✅（Storageコスト発生） |
| 位置＋期限の併用通知 | ✗ | ✅ |
| 繰り返し期限（毎週など） | ✗ | ✅ |
| 退出通知（家を出たとき） | ✗ | ✅ |
| 音声入力でアイテム追加 | ✅（獲得差別化） | ✅ |

---

### 5-3. 機能拡張候補（詳細）

#### #37 チェック一括解除ボタン ⭐ 優先度：高
**背景:** テンプレート機能は不要（チェックリセットで代替可能）だが、一括解除ボタンがない。
**設計方針:**
- `MemoDetailScreen` のアイテムセクションヘッダー右端に「全解除」ボタン（アイコン or テキスト）
- 全アイテムが未チェックの場合はグレーアウト
- Snackbar「元に戻す」と併用して安全に操作できるようにする

#### #38 カテゴリ・タグ機能 ⭐ 優先度：中
**設計方針:**
- `Memo` 型に `category: string`（単一）と `tags: string[]` を追加
- カテゴリプリセット例：買い物 / 旅行 / 日用品 / 仕事 / その他
- `MemoListScreen` 上部にフィルターバー（カテゴリ別タブ or チップ）
- カスタムカテゴリは `SettingsStore` に保存（プレミアム機能）

#### #39 共有メモのアイテム担当割り当て ⭐ 優先度：中
**背景:** 複数人で買い物を分担するユースケース向け。
**設計方針:**
- 共有グループ参加時にニックネームを1回入力（`SharePresence.displayName` に追加）
- `ShoppingItem` 型に `assignee?: string`（deviceId）を追加
- `MemoDetailScreen` で各アイテムに担当者アイコン（イニシャル）を表示
- タップで担当者を選択（自分 / 相手 / 未割り当て）
- ユーザー登録・メールアドレス不要。deviceId＋ニックネームで識別

#### #40 地点セクションの折りたたみ ⭐ 優先度：中（地点無制限化と同時実装）
**背景:** 地点が無制限になると `MemoDetailScreen` が縦に長くなりすぎる。
**設計方針:**
- デフォルトは3件まで表示
- 3件超の場合「他N件を表示 ▼」ボタンで全件展開
- `useState<boolean>` で展開状態を管理するだけ、実装コスト低

#### #41 期限リマインダー ⭐ 優先度：低〜中
**背景:** 単体の時間リマインダーはカレンダーと競合するが、**位置通知との併用**は差別化になる。
**設計方針:**
- `Memo` 型に `deadline?: number`（UnixMs）を追加
- 無料：期限日の設定と当日通知（単発）
- プレミアム：位置通知と期限通知の「どちらか早い方で通知」、繰り返し設定

#### #42 音声入力でアイテム追加 ⭐ 優先度：中
**設計方針:**
- `MemoEditScreen` のアイテム入力欄横にマイクボタンを追加
- `react-native-voice` ライブラリを使用
- 認識結果をそのままアイテムとして追加（確認ダイアログあり）
- 無料提供（獲得の訴求点・他アプリとの差別化）

#### #43 商品写真添付 ⭐ 優先度：低（プレミアム）
**設計方針:**
- `ShoppingItem` 型に `photoUrl?: string` を追加
- Firebase Storage に `sharedMemos/{shareId}/items/{itemId}.jpg` で保存
- 画像はリサイズ（最大 500px）してアップロード（Storage コスト管理）
- プレミアムユーザーのみ有効

---

### 5-4. 海外展開対応

**実装済み（2026-03-01）:**
- ✅ `values/strings.xml` → デフォルト `app_name: "Nearist"`
- ✅ `values-ja/strings.xml` → 日本語端末のみ `app_name: "Yorimichi"`
- ✅ `en.ts` の `nav.tabList` バグ修正（"Yorimichi" → "Nearist"）

**未対応:**
| 項目 | 内容 | 優先度 |
|------|------|--------|
| 端末言語の自動検出 | 初回起動時に端末ロケールを検出してデフォルト言語を設定 | 高 |
| Play Store 英語説明文 | Short / Full description の英語版を作成 | 高 |
| 英語スクリーンショット | Google Play Console に英語版スクショを登録 | 中 |
| 韓国語・繁体中文対応 | `ko.ts` / `zh-TW.ts` の追加 | 低 |

**端末言語自動検出の設計方針:**
- `react-native-localize` の `getLocales()` で端末言語を取得
- `src/i18n/index.ts` の初期化時に `storage.getString('app_language')` が未設定の場合のみ端末言語を適用
- `ja` 以外はすべて `en` にフォールバック

---

### 5-5. Firebase コスト管理

**Spark（無料）プランの主な制限:**

| リソース | 無料枠/日 |
|----------|----------|
| Firestore 読み取り | 50,000回 |
| Firestore 書き込み | 20,000回 |
| ストレージ | 1 GiB（月） |

**プレゼンスの書き込み頻度:** 編集中に約30秒ごとに1回 → 1ユーザー1時間で約120書き込み

→ 無料枠内で **DAU 数百〜数千人**は十分運用可能。有料（Blaze）移行が必要になるのはMAU数万人以上。
