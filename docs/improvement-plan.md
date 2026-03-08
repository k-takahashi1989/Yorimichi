# Yorimichi 改善計画

> 最終更新: 2026-03-08（versionCode 10 / versionName 1.0.9）— 通知時間帯設定・場所折りたたみ・7日間お試し追加

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

### 場所検索改善 — Nominatim OSM 移行（2026-03-07）

| 内容 | 対応ファイル | コミット |
|---|---|---|
| Google Places API → Mapbox Geocoding に移行（API キーレス化） | `LocationPickerScreen.tsx` | `b2db8b5` |
| Mapbox は日本語 POI データが不足していたため、Nominatim OSM（`nominatim.openstreetmap.org`）に再移行 | `LocationPickerScreen.tsx` | `b2db8b5` |
| `countrycodes=jp` + `viewbox=±1°`（現在地バイアス）+ `accept-language=ja` でクエリ精度を向上 | `LocationPickerScreen.tsx` | `b2db8b5` |

### ネイティブ Geofencing 移行 ＆ プラン上限フラグ管理 #35（2026-03-08）

| 内容 | 対応ファイル |
|------|-------------|
| `GeofenceModule.java`（新規）— NativeModule 本体。`syncGeofences` / `removeGeofencesForMemo` / `clearAll` を JS に公開。SharedPreferences にメタデータ保存 | `android/app/src/main/java/.../GeofenceModule.java` |
| `GeofenceTransitionReceiver.java`（新規）— `BroadcastReceiver`。ジオフェンス進入時に `NotificationCompat.Builder` で直接通知を発行。アプリ killed 状態でも動作 | `android/app/src/main/java/.../GeofenceTransitionReceiver.java` |
| `GeofencePackage.kt`（新規）— `ReactPackage` 実装。`GeofenceModule` を RN に登録。GMS インポートなし（Kotlin K2 回避） | `android/app/src/main/java/.../GeofencePackage.kt` |
| `YorimichiApplication.kt` — `getPackages()` に `GeofencePackage()` を追加 | `android/app/src/main/java/.../YorimichiApplication.kt` |
| `AndroidManifest.xml` — `<receiver android:name=".GeofenceTransitionReceiver" android:exported="false" />` を追加 | `android/app/src/main/AndroidManifest.xml` |
| `geofenceService.ts` 完全リライト — ポーリング方式を廃止し、`NativeModules.YorimichiGeofence` 経由で `syncGeofences` / `stopGeofenceMonitoring` / `clearMemoFromCache` を実装 | `src/services/geofenceService.ts` |
| `memoStore.ts` — `addLocation` に `getLocationsLimit()` 上限チェック追加。`updateLocation` / `deleteLocation` で `syncGeofences()` を呼び出す | `src/store/memoStore.ts` |
| `planLimits.ts` — `LIMITS_ENABLED = false` + `FREE_LIMITS` 定数。`getLocationsLimit()` / `getMemosLimit()` / `getItemsLimit()` を追加（`PremiumScreen.tsx` と連動） | `src/config/planLimits.ts` |
| `android/build.gradle` — `classpath("com.google.gms:google-services:4.4.2")` を追加（誤って削除されていた） | `android/build.gradle` |
| `android/app/build.gradle` — `implementation "com.google.android.gms:play-services-location:21.3.0"` および `apply plugin: "com.google.gms.google-services"` を復元 | `android/app/build.gradle` |

**Kotlin K2 対応メモ:** Kotlin K2（2.1.20）は `Geofence` クラスのネスト annotation interface によってコンパイルエラーになるため、`GeofenceModule` と `GeofenceTransitionReceiver` を **Java** で実装。`GeofencePackage.kt` のみ Kotlin（GMS インポートなし）。

**削除対象（`react-native-background-actions` ポーリング方式）:** `geofenceService.ts` から完全に除去済み。

### プラン上限有効化・UI カウンタ・バグ修正（2026-03-08）

| 内容 | 対応ファイル | コミット |
|------|-------------|---------|
| `planLimits.ts` の `LIMITS_ENABLED` を `true` に変更し、制限をすべて有効化 | `src/config/planLimits.ts` | `ee6368e` |
| `getCollaboratorsLimit(isPremium)` を追加 | `src/config/planLimits.ts` | `ee6368e` |
| `shareService.ts` — `joinSharedMemo` が `isPremium` 引数を受け取り、コラボレーター上限超過時に `'COLLABORATORS_FULL'` をスロー | `src/services/shareService.ts` | `ee6368e` |
| `MemoListScreen` ヘッダーにメモ数カウンタ `N / 5` を表示（上限オレンジ）。`COLLABORATORS_FULL` エラーハンドリング追加 | `src/screens/MemoListScreen.tsx` | `ee6368e` |
| `MemoEditScreen` アイテム欄ラベルに `N / 10` カウンタを表示 | `src/screens/MemoEditScreen.tsx` | `ee6368e` |
| `MemoDetailScreen` 地点セクションに `N / 2` カウンタを表示。`handleShare` を `LIMITS_ENABLED` でゲート | `src/screens/MemoDetailScreen.tsx` | `ee6368e` |
| i18n — `locationLimitTitle/Msg`, `collaboratorLimitTitle/Msg` を ja/en に追加 | `src/i18n/locales/ja.ts`, `en.ts` | `ee6368e` |
| バグ修正: `locationSection` i18n キーのハードコード `/ 3` を削除し `({{count}}件)` に変更 | `src/i18n/locales/ja.ts`, `en.ts` | `f824e4a` |
| バグ修正: `MemoDetailScreen` にアイテム数バッジ `N件`（上限でオレンジ）を追加 | `src/screens/MemoDetailScreen.tsx` | `f824e4a` |
| バグ修正: `LocationPickerScreen` に `isGeocoding` 状態を追加。逆ジオコーディング中は保存ボタンを無効化＋スピナー表示。5秒安全タイムアウト | `src/screens/LocationPickerScreen.tsx` | `f824e4a` |
| i18n — `locationPicker.geocodingInProgress` を ja/en に追加 | `src/i18n/locales/ja.ts`, `en.ts` | `f824e4a` |

### ジオフェンス100件上限（2026-03-08）

Android の `GeofencingClient` はアプリあたり最大100件という API ハードリミットがあり、超過時に無音失敗する問題に対処。

| 内容 | 対応ファイル | コミット |
|------|-------------|---------|
| `geofenceService.ts` に `export const MAX_GEOFENCES = 100` を追加。`buildEntries()` 戻り値を `entries.slice(0, MAX_GEOFENCES)` に変更（JS 層キャップ） | `src/services/geofenceService.ts` | `87e6740` |
| `GeofenceModule.java` に `private static final int MAX_GEOFENCES = 100` 定数を追加。`syncGeofences` の for ループ先頭に `if (geofences.size() >= MAX_GEOFENCES) break;` を追加（Java 層セーフティネット） | `android/.../GeofenceModule.java` | `87e6740` |

### 共有メモ地点同期バグ修正（2026-03-08）

**根本原因:** 地点の追加・編集・削除がローカルストアにのみ保存され Firestore に反映されなかったため、同期ボタンを押すと古い地点で上書きされていた。

| 内容 | 対応ファイル | コミット |
|------|-------------|---------|
| `shareService.ts` に `updateSharedMemoLocations(shareId, locations)` を追加 | `src/services/shareService.ts` | `7e4900a` |
| `handleSyncSharedMemo`: オーナーは `memo.locations`（ローカル優先）、コラボレーターは `doc.locations`（Firestore 優先）でマージ | `src/screens/MemoDetailScreen.tsx` | `7e4900a` |
| `handleDeleteLocation`: オーナーの地点削除後に Firestore へ即時プッシュ | `src/screens/MemoDetailScreen.tsx` | `7e4900a` |
| `useFocusEffect`: LocationPickerScreen から戻った際にオーナーの地点変更を Firestore へ自動プッシュ | `src/screens/MemoDetailScreen.tsx` | `7e4900a` |

### オーナー/コラボレーター可視化（2026-03-08）

| 内容 | 対応ファイル | コミット |
|------|-------------|---------|
| `MemoDetailScreen` タイトル直下に役割バッジを表示（`👑 オーナー` 緑 / `👥 コラボレーター` 紫）。共有していないメモは非表示 | `src/screens/MemoDetailScreen.tsx` | `f6c79b1` |
| 地点セクションの追加・編集・削除ボタンをコラボレーターには非表示にし、代わりに🔒アイコンを表示（読み取り専用） | `src/screens/MemoDetailScreen.tsx` | `f6c79b1` |
| i18n — `share.roleOwner` / `share.roleCollaborator` を ja/en に追加 | `src/i18n/locales/ja.ts`, `en.ts` | `f6c79b1` |

### バナー広告の有効化（2026-03-08）

`ADS_ENABLED` を `false` → `true` に変更し、バナー広告を復活させた。インタースティシャル広告（`useInterstitialAd.ts`）は引き続き無効（`ADS_ENABLED = false`）のまま。

| 内容 | 対応ファイル | コミット |
|------|-------------|---------|
| `AdBanner.tsx` の `ADS_ENABLED` を `false` → `true` に変更。MemoListScreen・MemoDetailScreen・SettingsScreen でバナー広告が表示されるようになった | `src/components/AdBanner.tsx` | `431444a` |

> バナー表示ロジック: DEV ビルドでは `TestIds.ADAPTIVE_BANNER`、PROD ビルドでは `Config.ADMOB_BANNER_ID` を使用。Android 以外（iOS 等）では `null` を返しバナーは非表示。

### サブスクプラン3段階構成（検討中・未実装）

ユーザーアンケートで「広告だけ消したい」層と「全機能使いたい」層が分かれたため、3段階プランを検討中。現時点ではコードへの変更なし（設計メモのみ）。

| プラン | 広告 | メモ数 | 地点数/メモ | 通知アラーム | 共有 |
|---|---|---|---|---|---|
| 無料 | あり | 5件 | 2か所 | サイレント/標準 | 1対1 |
| 広告オフ | **なし** | 5件 | 2か所 | サイレント/標準 | 1対1 |
| プレミアム | なし | 無制限 | 最大100か所 | アラーム対応 | 複数人 |

**想定価格帯（日本市場）:**
- 広告オフ: 月額¥120〜150 / 年額¥900〜1,200
- プレミアム: 月額¥250〜350 / 年額¥1,800〜2,400

**実装方針（将来）:** 既存の `isPremium: boolean` は維持し、`isNoAds: boolean` フィールドを `SettingsStore` に追加する形で対応予定（マイグレーション安全）。

### 場所リスト折りたたみ + 7日間プレミアムお試し（2026-03-08）

| 内容 | 対応ファイル | コミット |
|---|---|---|
| `MemoDetailScreen.tsx` の場所リストを折りたたみ対応。3件以下は全件表示、4件以上は最初の3件 + 「他N件を表示」ボタン。展開後は「折りたたむ」ボタンで閉じられる | `src/screens/MemoDetailScreen.tsx` | `2eabd0f` |
| `src/utils/trialUtils.ts` を新規作成。`isTrialActive()` / `trialDaysRemaining()` ユーティリティを定義（7日間 = 604,800,000 ms） | `src/utils/trialUtils.ts` | `2eabd0f` |
| `memoStore.ts` に `trialStartDate`, `hasUsedTrial`, `startTrial()` を追加。store v5 に migration | `src/store/memoStore.ts` | `2eabd0f` |
| `selectEffectivePremium` セレクターをエクスポート。`isPremium \|\| isTrialActive(trialStartDate)` で合算判定 | `src/store/memoStore.ts` | `2eabd0f` |
| `PremiumScreen.tsx` のトグルをトライアル UI に置き換え。未使用 → 開始ボタン、使用中 → 残日数バッジ、終了後 → 終了メッセージ | `src/screens/PremiumScreen.tsx` | `2eabd0f` |
| `AdBanner`, `MemoDetailScreen`, `MemoListScreen` を `selectEffectivePremium` に統一 | 各ファイル | `2eabd0f` |

### 通知時間帯設定（プレミアム機能）（2026-03-08）

> アプリ全体にグローバル適用される「通知許可時間帯」。指定時間外に geofence が発火しても Java 層でサイレントに通知をスキップ。アプリが killed 状態でも確実に動作。

| 内容 | 対応ファイル | コミット |
|---|---|---|
| `GeofenceModule.java` に `setNotifWindow(boolean, double, double)` ReactMethod を追加。SharedPreferences にキー3つ（`notif_window_enabled`, `_start`, `_end`）を保存 | `android/.../GeofenceModule.java` | `efc85b2` |
| `GeofenceTransitionReceiver.java` の `sendNotification()` 冒頭に時間帯チェックを追加。深夜跨ぎ（例: 22:00〜7:00）のロジックも対応済み | `android/.../GeofenceTransitionReceiver.java` | `efc85b2` |
| `geofenceService.ts` に `setNotifWindowNative()` を追加（型宣言含む） | `src/services/geofenceService.ts` | `efc85b2` |
| `memoStore.ts` に `notifWindowEnabled`, `notifWindowStart`, `notifWindowEnd`, `setNotifWindow()` を追加。store v6 に migration | `src/store/memoStore.ts` | `efc85b2` |
| `SettingsScreen.tsx` にプレミアム限定セクションを追加。ON/OFF `Switch` + 時刻ピッカーモーダル（30分刻み）。非プレミアムは鍵アイコン付きでグレーアウト | `src/screens/SettingsScreen.tsx` | `efc85b2` |
| `PremiumScreen.tsx` の機能比較テーブルに「通知時間帯」行を追加 | `src/screens/PremiumScreen.tsx` | `efc85b2` |



| # | 内容 | 対応ファイル | コミット |
|---|---|---|---|
| — | `handleRecentPlacePress` 内の `if (!label)` ガードを削除。タップ毎に `label` / `address` が常に更新されるよう修正 | `LocationPickerScreen.tsx` | `9fd7a6b` |
| — | 場所選択後に「最近の場所」リストが非表示になる問題を修正（`!picked` 条件を削除し、常に表示） | `LocationPickerScreen.tsx` | `9fd7a6b` |

### プレミアムプラン画面実装（2026-03-07）

| 内容 | 対応ファイル | コミット |
|---|---|---|
| `planLimits.ts` 新規作成。`LIMITS_ENABLED = false`（グローバルフラグ）と `FREE_LIMITS` 定数を定義。フラグを `true` にするだけで制限が有効化できる設計 | `src/config/planLimits.ts` | `97d253a` |
| `PremiumScreen.tsx` 新規作成。無料 / プレミアムの機能比較テーブル（5行）、アップグレード CTA ボタン（準備中 Alert）、`__DEV__` のみ表示の `isPremium` トグルを実装 | `src/screens/PremiumScreen.tsx` | `97d253a` |
| `memoStore.ts` に `setIsPremium(value: boolean)` アクションを追加 | `src/store/memoStore.ts` | `97d253a` |
| `AppNavigator.tsx` に `Premium` スクリーンを登録 | `src/navigation/AppNavigator.tsx` | `97d253a` |
| `SettingsScreen.tsx` に「✨ プレミアムプラン」橙色カードを追加（アプリ情報セクションの上）。タップで `PremiumScreen` に遷移 | `src/screens/SettingsScreen.tsx` | `97d253a` |
| i18n（`ja.ts` / `en.ts`）に `premium.*` キー群を追加（20 キー超） | `src/i18n/locales/ja.ts`, `en.ts` | `97d253a` |
| `RootStackParamList` に `Premium: undefined` を追加 | `src/types/index.ts` | `97d253a` |

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

### ~~#35 ネイティブ Geofencing API 移行~~ ✅ 実装済み（2026-03-08）

> 詳細は「1. 実装済み変更 > ネイティブ Geofencing 移行 ＆ プラン上限フラグ管理 #35」を参照。

**実績:**
- 現状: `react-native-background-actions` ポーリングを完全廃止
- Android `GeofencingClient` をネイティブモジュール（Java）経由で使用
- バッテリー消費大幅削減・アプリ killed 状態でも通知動作確認済み
- versionCode 10 / versionName 1.0.9 でリリース

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

> **実装メモ:** `src/config/planLimits.ts` の `LIMITS_ENABLED` フラグは現在 **`true`**（制限有効）。`FREE_LIMITS` の数値がここの表の値と対応している。サブスク課金実装前に `false` に戻す場合は同ファイルの定数を変更する。

| 機能 | 無料 | プレミアム |
|------|------|-----------|
| メモ数 | 5件まで | 無制限 |
| 1メモあたりアイテム数 | 10個まで | 無制限 |
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
