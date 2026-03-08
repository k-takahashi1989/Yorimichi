# Yorimichi プロジェクトレビュー（2026-03-08 rev.2）

> React Native 0.84 / Android 16（API 36）対応ジオフェンスベース買い物リマインダーアプリ
> **前回レビュー対応状況 + 新規セキュリティ・品質指摘を追記**

---

## 目次

1. [前回レビュー対応状況](#1-前回レビュー対応状況)
2. [セキュリティ](#2-セキュリティ)
3. [バグ](#3-バグ)
4. [収益化](#4-収益化)
5. [コード品質・パフォーマンス](#5-コード品質パフォーマンス)
6. [依存関係](#6-依存関係)
7. [良い実装パターン](#7-良い実装パターン)
8. [推奨アクションリスト](#8-推奨アクションリスト)

---

## 1. 前回レビュー対応状況

| # | 前回指摘 | 対応状況 | 備考 |
|---|----------|----------|------|
| 1 | Firestore Security Rules 未設定 | ✅ **修正済** | `firestore.rules` 作成・デプロイ済み（`5fb2d3f`） |
| 2 | `isPremium: true` マイグレーションバグ | ❌ **未修正** | 後述 §2.1 — 引き続き Critical |
| 3 | `index.js` backgroundTask 参照 | ✅ **修正済** | 2行削除済み（`5fb2d3f`） |
| 4 | インタースティシャル広告無効 | ❌ **未修正** | `ADS_ENABLED = false` のまま |
| 5 | BootReceiver が全画面起動 | ❓ 未対応 | — |
| 6 | 不要な依存パッケージ | ⚠️ 一部のみ | `backgroundTask` 参照は削除済。パッケージ自体は残存 |
| 7 | リリース ABI 設定 | ❌ **未修正** | `arm64-v8a` のみ |
| 8 | shareId バリデーション不足 | ❌ **未修正** | 後述 §2.5 |
| 9 | コラボレーター上限クライアント限定 | ❌ **未修正** | 後述 §2.6 |
| 10 | 共有メモのリアルタイム同期 | ❌ **未修正** | 後述 §5.5 |
| 11 | アイテム描画 ScrollView + .map() | ❌ **未修正** | 後述 §5.4 |
| 12 | サービス層テスト | ✅ **修正済** | `trialUtils / shareService / couponService` テスト追加（`9299c5e`） |

**新規追加・修正済み:**
- お問い合わせリンク追加（`caf9175`）
- `addLocation` couponExpiry 考慮漏れ修正（`5fb2d3f`）
- 既存テスト失敗修正（`5c87224`）

---

## 2. セキュリティ

### 2.1 🔴 Critical: `isPremium: true` マイグレーションバグ（未修正）

**場所:** `src/store/memoStore.ts` L104–L108

```typescript
if (version <= 2) {
  persisted = {
    ...persisted,
    isPremium: true,   // ← 全既存ユーザーが永久プレミアムになる
  };
}
```

**影響:** ストア v1 / v2 から v7 にアップデートした全ユーザーが `isPremium: true` を取得。課金を実装しても収益が得られない。

**修正:** `isPremium: persisted.isPremium ?? false`

### 2.2 🔴 Critical: Firestore `sharedMemos` ルールが緩すぎる

**場所:** `firestore.rules` L9–L18

```
allow read:   if request.auth != null;
allow create: if request.auth != null;
allow update: if request.auth != null;
allow delete: if request.auth != null;
```

**問題:** 認証済み（匿名でも可）であれば **誰でも**:
- 他人の共有メモを **削除** できる
- `ownerDeviceId`・アイテム・タイトルを **改ざん** できる
- `collaborators` を自由に書き換えられる

アプリ側のオーナーチェックは Firestore に直接書き込めばバイパス可能。

**推奨修正:**
```javascript
match /sharedMemos/{shareId} {
  allow read:   if request.auth != null;
  allow create: if request.auth != null;
  // 更新: オーナーまたはコラボレーターのみ
  allow update: if request.auth != null
    && (resource.data.ownerDeviceId == request.auth.uid
        || request.auth.uid in resource.data.collaborators);
  // 削除: オーナーのみ
  allow delete: if request.auth != null
    && resource.data.ownerDeviceId == request.auth.uid;
}
```

> **注意:** 現在 `ownerDeviceId` は `react-native-device-info` のデバイス ID を使用しており、Firebase Auth の `uid` とは異なる。ルールで `request.auth.uid` と照合するには、`uploadSharedMemo` で `auth().currentUser.uid` を保存するようアプリ側も変更が必要（→ §2.3）。

### 2.3 🔴 High: `deviceId` ベースの所有権管理

**場所:** `src/services/shareService.ts` L56, L93

**問題:** `ownerDeviceId` / `collaborators` が `react-native-device-info` のデバイス ID を使用。
- Firestore Security Rules で `request.auth.uid` と照合できない
- デバイス ID は他のアプリからも取得可能（Android ID等）
- 同一デバイスでデータクリア → 別の匿名 UID になるが deviceId は同じ → 権限の不整合

**推奨:** `auth().currentUser!.uid` を使用し、Firestore Rules で厳密に検証する。

### 2.4 🟡 High: クーポンコードの `durationDays` 改ざん可能

**場所:** `firestore.rules` L27–L34

**問題:** 更新ルールは `used: false → true` のみ検証するが、既存フィールドの値変更を禁止していない。悪意あるクライアントが `used: true` と同時に `durationDays: 99999` に書き換え可能。couponService 側はトランザクション内で `data.durationDays` を読むため、改ざんされた値で `expiryMs` が計算される。

**修正:** `affectedKeys` を制限する:
```javascript
allow update: if request.auth != null
  && request.resource.data.used == true
  && resource.data.used == false
  && request.resource.data.diff(resource.data).affectedKeys()
       .hasOnly(['used', 'usedBy', 'usedAt']);
```

### 2.5 🟡 Medium: ディープリンク `shareId` バリデーション不足

**場所:** `src/navigation/AppNavigator.tsx` L82–L84

`/[?&]shareId=([^&]+)/` で抽出した任意文字列をそのまま `firestore().doc(shareId)` に渡す。`/` を含む文字列など不正な Firestore ドキュメント ID でクラッシュの可能性。

**修正:** `/^[a-zA-Z0-9]{20,}$/` 等のフォーマットバリデーションを追加。

### 2.6 🟡 Medium: コラボレーター人数制限がクライアントのみ

**場所:** `src/services/shareService.ts` L95–L99

JavaScript 側でのみ上限チェック。Firestore 直接書き込みでバイパス可能。

**修正:** Firestore Rules に追加:
```javascript
&& request.resource.data.collaborators.size() <= 21
```

### 2.7 🟡 Medium: プレミアム判定が完全クライアントサイド

**場所:** `src/store/memoStore.ts` L131–L135 (`selectEffectivePremium`)

- デバイス時刻を巻き戻せばトライアル / クーポンが無限延長
- アプリデータ消去 → `hasUsedTrial` リセット → 無限トライアル
- root 端末で MMKV 直接編集 → `isPremium: true`

**推奨（短期）:** 起動時に Firestore `serverTimestamp()` と照合
**推奨（中期）:** Google Play Billing + サーバーサイドレシート検証

### 2.8 🟡 Medium: ProGuard 無効のまま

**場所:** `android/app/build.gradle` L67

```groovy
def enableProguardInReleaseBuilds = false
```

リリース APK のコードが難読化されず、プレミアムバイパスロジックの解析やAPIキー抽出が容易。

**推奨:** `true` に変更し、ProGuard ルールがネイティブモジュールを壊さないことを検証。

---

## 3. バグ

### 3.1 🔴 Critical: `addSharedMemoId` が存在しないのに呼ばれている

**場所:** `src/navigation/AppNavigator.tsx` L75, L103

```tsx
const addSharedMemoId = useSettingsStore(s => s.addSharedMemoId);  // L75
// ...
addSharedMemoId(shareId);  // L103
```

**問題:** `addSharedMemoId` は前回のバグ修正（`2885fb6`）で `SettingsState` から完全削除された。しかし `AppNavigator.tsx` ではまだ参照・呼び出ししている。

`useSettingsStore(s => s.addSharedMemoId)` は `undefined` を返し、L103 で `TypeError: addSharedMemoId is not a function` が発生しアプリがクラッシュする。

**影響:** `yorimichi://open?shareId=XXX` ディープリンクを開くと**確実にクラッシュ**する。

**修正:** L75 の `const addSharedMemoId = ...` と L103 の `addSharedMemoId(shareId)` を削除。

### 3.2 🟡 Medium: `handleImportByCode` の `useCallback` 依存配列に `isPremium` がない

**場所:** `src/screens/MemoListScreen.tsx` L50–L95

```tsx
const handleImportByCode = useCallback(async () => {
  // ... isPremium を L56 で使用 ...
  const doc = await joinSharedMemo(code, deviceId, isPremium);
}, [importCode, importSharedMemo, navigation, t]);  // ← isPremium がない
```

**影響:** プレミアム状態が変わっても古い `isPremium` 値でコラボレーター上限判定が行われる。

**修正:** 依存配列に `isPremium` を追加。

### 3.3 🟡 Medium: App.tsx の権限ダイアログがハードコード日本語

**場所:** `App.tsx` L38–L39

```tsx
Alert.alert(
  '📍 位置情報の許可が必要です',
  'このアプリは近くの場所に近づいたときに....',
```

英語設定のユーザーにも日本語で表示される。

**修正:** `i18n.t('settings.alertFineLocation.title')` 等を使用（`useTranslation` はコンポーネントトップレベルで呼び出し）。

### 3.4 🟡 Medium: 前景通知リスナーのクリーンアップ漏れ

**場所:** `src/navigation/AppNavigator.tsx` L122–L125

`useForegroundNotificationHandler` 内部で `notifee.onForegroundEvent()` が返す unsubscribe 関数が破棄されていない。`useEffect` cleanup で解除されず、コンポーネント再マウント時にリスナーが重複する。

**修正:** unsubscribe 関数を return して `useEffect` cleanup で呼び出す。

### 3.5 🟢 Low: `notifWindowStart >= notifWindowEnd` のガードなし

**場所:** `src/screens/SettingsScreen.tsx` 時刻ピッカー

start=22:00 / end=8:00 のような夜間跨ぎ設定が可能だが、ネイティブ側の `GeofenceTransitionReceiver` がこれを正しく扱うか不明。

**修正:** UI でバリデーションするか、ネイティブ側で夜間跨ぎ対応を明示実装。

### 3.6 🟢 Low: `MemoEditScreen` `handleSaveTitle` の `useCallback` に `t` がない

**場所:** `src/screens/MemoEditScreen.tsx` L129

`t(...)` を使用しているが依存配列に `t` が含まれていない。言語切替時にエラー文が旧言語で表示される。

---

## 4. 収益化

### 4.1 現状

| 収益源 | 状態 | 備考 |
|--------|------|------|
| バナー広告 (AdMob) | **有効** | MemoList, MemoDetail, Settings に表示 |
| インタースティシャル広告 | **無効** (`ADS_ENABLED = false`) | フック実装済みだが未発火 |
| プレミアムサブスクリプション | **未実装** | 「Coming soon」Alert のみ |
| 7日間トライアル | **動作中** | 完全クライアントサイド |
| クーポンコード | **動作中** | Firestore トランザクション方式（`cae4aa8`） |

### 4.2 🔴 CriticalからのBug: `isPremium: true` マイグレーション

§2.1 と同一。課金を実装しても v2 以前のユーザーは永久プレミアムのまま。

### 4.3 🟡 インタースティシャル広告の再有効化

`useInterstitialAd.ts` L10 で `ADS_ENABLED = false`。頻度制御を加えて有効化すれば eCPM 5〜10倍向上が見込める。

### 4.4 収益最大化のための提案

| 施策 | 期待効果 | 実装難易度 |
|------|----------|------------|
| **インタースティシャル広告再有効化** | eCPM 5〜10倍向上 | ★☆☆ |
| **Google Play Billing 導入** | サブスク収益確保 | ★★★ |
| **3段階プラン** (Free/Ad-free/Premium) | ARPU 向上 | ★★★ |
| **トライアル終了プッシュ通知** | 有料転換率向上 | ★★☆ |
| **年間プラン割引** | LTV 向上 | ★☆☆ |

---

## 5. コード品質・パフォーマンス

### 5.1 🟡 `BootReceiver` がアプリ UI を全画面起動する

端末再起動時に `startActivity()` でメインアクティビティを前面起動。ユーザーの意図に反する。
→ `WorkManager` でバックグラウンドジオフェンス再登録のみ行うべき。

### 5.2 🟡 AGP 9 ワークアラウンドの脆弱性

`android/app/build.gradle` の `afterEvaluate` ブロックで `play-services-location` JAR を手動追加。React Native / AGP アップデート時に壊れるリスク。

### 5.3 🟡 リリース ABI が `arm64-v8a` のみ

`android/gradle.properties`: `reactNativeArchitectures=arm64-v8a`

32-bit デバイス（一部 Android Go 端末）が除外される。リリースでは `armeabi-v7a,arm64-v8a` を推奨。

### 5.4 🟡 `MemoDetailScreen` アイテム描画が `ScrollView` + `.map()`

プレミアムユーザーは最大100アイテム登録可能だが、`FlatList` でなく全件レンダリング。50件以上でパフォーマンス低下の可能性。

### 5.5 🟡 共有メモ同期が手動ボタン方式

プレゼンスは `onSnapshot` でリアルタイム監視しているが、アイテム・タイトル変更は手動「同期」ボタン。不整合なUX。
→ ドキュメント全体を `onSnapshot` でリアルタイム同期し、既存のマージロジックを流用すべき。

---

## 6. 依存関係

### 6.1 🟡 不要な依存パッケージ（バンドルサイズ肥大化）

| パッケージ | 状態 |
|-----------|------|
| `react-native-background-actions` | `index.js` 参照削除済みだがパッケージ残存 |
| `react-native-google-places-autocomplete` | Nominatim OSM 検索に移行済、未使用 |
| `uuid` | `helpers.ts` の `generateId()` で自前実装、未使用 |
| `react-native-nitro-modules` | ソース内で使用箇所なし |

### 6.2 🔴 `@react-native-firebase/*` が `package.json` に記載されていない

`shareService.ts` / `couponService.ts` で `@react-native-firebase/auth` と `@react-native-firebase/firestore` をインポートしているが、`package.json` の `dependencies` に記載がない。

**影響:** `npm ci` や新規クローンでインストールされず、ビルド失敗する。

**修正:**
```bash
npm install @react-native-firebase/app @react-native-firebase/auth @react-native-firebase/firestore
```

---

## 7. 良い実装パターン

| 項目 | 場所 | 評価 |
|------|------|------|
| クーポントランザクション安全性 | `couponService.ts` L28 | Firestore `runTransaction` で二重使用防止 ✅ |
| Firestore undefined サニタイズ | `shareService.ts` L14–L38 | optional フィールドを strip してから write ✅ |
| ジオフェンス 100件ハードリミット | `geofenceService.ts` L30 | Android GeofencingClient 上限を尊重 ✅ |
| `useShallow` セレクター最適化 | `MemoDetailScreen`, `MemoEditScreen` | 不要な再レンダーを抑制 ✅ |
| ストアマイグレーションチェーン | `memoStore.ts` L98–L123 | v1→v7 を順次カバー ✅ |
| リリース署名の外部プロパティ化 | `build.gradle` L103–L119 | `keystore.properties` を git 除外 ✅ |
| `allowBackup="false"` | `AndroidManifest.xml` L30 | データバックアップ経由の漏洩防止 ✅ |
| API キー外部化 (`.env`) | `build.gradle` L97–L99 | `GOOGLE_MAPS_API_KEY` / `ADMOB_APP_ID` を `manifestPlaceholders` で注入 ✅ |
| 通知チャンネル HIGH importance | `notificationService.ts` L14–L20 | ジオフェンス通知の確実な表示 ✅ |
| バックグラウンド通知 → MMKV bookmark | `index.js` + `AppNavigator.tsx` L147 | killed-state タップの安全なハンドリング ✅ |
| `isSavingRef` 二重保存ガード | `MemoEditScreen.tsx` L58 | `handleDone` + `onBlur` の重複防止 ✅ |
| サービス層テストカバレッジ | `__tests__/{trialUtils,shareService,couponService}.test.ts` | 33件の新規テスト ✅ |

---

## 8. 推奨アクションリスト

### 🔴 最優先（即修正）

| # | 内容 | カテゴリ | 工数 |
|---|------|----------|------|
| 1 | **`addSharedMemoId` 呼び出し削除** (`AppNavigator.tsx` L75,L103) — ディープリンクでクラッシュ | バグ | 1分 |
| 2 | **`isPremium: true` → `persisted.isPremium ?? false`** (`memoStore.ts` L107) | セキュリティ | 1分 |
| 3 | **`@react-native-firebase/*` を `package.json` に追加** | ビルド | 1分 |

### 🟡 次回リリースまでに対応

| # | 内容 | カテゴリ | 工数 |
|---|------|----------|------|
| 4 | **Firestore Rules 強化** — オーナー/コラボレーター限定の update/delete | セキュリティ | 30分 |
| 5 | **`ownerDeviceId` → `auth().currentUser.uid`** に移行 | セキュリティ | 1時間 |
| 6 | **クーポン Rules** — `affectedKeys` 制限追加 | セキュリティ | 5分 |
| 7 | **ProGuard 有効化** (`enableProguardInReleaseBuilds = true`) | セキュリティ | 30分 |
| 8 | **`shareId` フォーマットバリデーション** | セキュリティ | 5分 |
| 9 | **`handleImportByCode` の `useCallback` に `isPremium` 追加** | バグ | 1分 |
| 10 | **App.tsx 権限ダイアログを i18n 化** | バグ | 5分 |
| 11 | **不要パッケージ4つ削除** | バンドルサイズ | 10分 |
| 12 | **リリース ABI に `armeabi-v7a` 追加** | 互換性 | 1分 |

### 🟢 中期（収益化フェーズ）

| # | 内容 | カテゴリ | 工数 |
|---|------|----------|------|
| 13 | Google Play Billing / RevenueCat 導入 | 収益化 | 2–3日 |
| 14 | サーバーサイドプレミアム検証 | セキュリティ | 1日 |
| 15 | 共有メモのリアルタイム同期 (`onSnapshot`) | 機能 | 2時間 |
| 16 | `MemoDetailScreen` アイテム `FlatList` 化 | パフォーマンス | 1時間 |
| 17 | インタースティシャル広告を頻度制御付きで再有効化 | 収益化 | 30分 |
| 18 | `BootReceiver` をバックグラウンド再登録方式に変更 | UX | 2時間 |
| 19 | 前景通知リスナーのクリーンアップ修正 | コード品質 | 10分 |

---

*レビュー実施日: 2026年3月8日（rev.2）*
*対象バージョン: 1.0.10 (versionCode 11)*
*対象コミット: `5fb2d3f` 〜 `eb0ae0b`*
*レビュアー: GitHub Copilot*
