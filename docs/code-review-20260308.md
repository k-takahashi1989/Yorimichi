# Yorimichi プロジェクトレビュー（2026-03-08）

> React Native 0.84 / Android 16（API 36）対応ジオフェンスベース買い物リマインダーアプリ

---

## 目次

1. [アーキテクチャ概評](#1-アーキテクチャ概評)
2. [セキュリティ](#2-セキュリティ)
3. [収益化](#3-収益化)
4. [コード品質・バグ](#4-コード品質バグ)
5. [依存関係](#5-依存関係)
6. [推奨アクションリスト](#6-推奨アクションリスト)

---

## 1. アーキテクチャ概評

### 評価: B+（個人開発としては十分な水準）

| 領域 | 構成 | 評価 |
|------|------|------|
| 状態管理 | Zustand + MMKV persist (v6/v2 マイグレーション付き) | ✅ 適切 |
| ナビゲーション | Stack + BottomTab (React Navigation v7) | ✅ 標準的 |
| i18n | i18next (ja/en, 約270キー) | ✅ 充実 |
| ネイティブ連携 | Java GeofenceModule + BroadcastReceiver | ✅ バッテリー効率良好 |
| バックエンド | Firebase Auth (匿名) + Firestore (共有機能) | ⚠️ ルール未整備 |
| 広告 | Google Mobile Ads (Banner) | ✅ 動作中 |
| テスト | Jest ユニットテスト5ファイル | △ サービス層のテストなし |

**良い点:**
- 画面・サービス・ストア・ユーティリティの分離が明確
- チュートリアルシステム（`useTutorial` + spotlight overlay）が UX 向上に寄与
- ストアマイグレーションが全バージョンを正しくカバー
- `.env` + `manifestPlaceholders` による API キー外部化

---

## 2. セキュリティ

### 2.1 🔴 Critical: Firestore Security Rules が未設定

**現状:** リポジトリに `firestore.rules` が存在しない。Firebase Console でデフォルトルール（テストモード = 全公開）のままの可能性が高い。

**リスク:**
- `shareId` を知っている（または総当たりする）第三者が、全共有メモの内容を読み取り可能
- `collaborators` 配列に任意の `deviceId` を追加可能（なりすまし参加）
- 他人の共有メモのアイテムを改ざん・削除可能
- `ownerDeviceId` が露出 → 他の共有メモとの紐付けに悪用可能

**推奨対応:**
```javascript
// firestore.rules の例
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /sharedMemos/{shareId} {
      // 読み取り: 認証済みユーザーのみ
      allow read: if request.auth != null;
      // 作成: 認証済み + ownerDeviceId が自分
      allow create: if request.auth != null
        && request.resource.data.ownerDeviceId is string;
      // 更新: オーナーまたはコラボレーター
      allow update: if request.auth != null
        && (resource.data.ownerDeviceId == request.auth.uid
            || request.auth.uid in resource.data.collaborators);
      // 削除: オーナーのみ
      allow delete: if request.auth != null
        && resource.data.ownerDeviceId == request.auth.uid;
    }
  }
}
```

### 2.2 🔴 Critical: `isPremium: true` マイグレーションバグ

**場所:** `src/store/memoStore.ts` L106

```typescript
if (version <= 2) {
  persisted = {
    ...persisted,
    isPremium: true,   // ← 全既存ユーザーが永久プレミアムになる
    sharedMemoIds: persisted.sharedMemoIds ?? [],
  };
}
```

**影響:** ストア v1 または v2 から v6 にアップデートした全ユーザーが `isPremium: true` を取得する。課金を実装しても収益が得られない。

**修正:**
```typescript
isPremium: persisted.isPremium ?? false,
```

### 2.3 🟡 Medium: ディープリンクの shareId バリデーション不足

**現状:** `yorimichi://open?shareId=XXX` の `XXX` に任意文字列が渡され、そのまま `firestore().collection('sharedMemos').doc(shareId)` に使用される。

**リスク:** Firestore のドキュメント ID として不正な文字列（`/` を含む等）が渡された場合のエラーハンドリングが不十分。

**推奨:** shareId のフォーマットバリデーション（英数字20文字以内等）を追加。

### 2.4 🟡 Medium: クライアントのみのコラボレーター人数制限

**現状:** `joinSharedMemo()` 内でコラボレーター上限チェックを行っているが、Firestore に直接書き込めばバイパス可能。

**推奨:** Firestore Security Rules または Cloud Functions で上限を強制。

### 2.5 🟢 Good: 適切に保護されている項目

| 項目 | 状態 |
|------|------|
| `.env` (API キー) | `.gitignore` 済み ✅ |
| `keystore.properties` | `.gitignore` 済み ✅ |
| `google-services.json` | `.gitignore` 済み ✅ |
| `android:allowBackup` | `false` ✅ |
| バックグラウンド位置情報 | 明示的な権限リクエスト + 理由説明 ✅ |
| `GeofenceTransitionReceiver` | `exported="true"` だが `GeofencingEvent.fromIntent()` でバリデーション ✅ |
| MMKV ストレージ | アプリサンドボックス内、root なしでは読取不可 ✅ |

---

## 3. 収益化

### 3.1 現状の収益構造

| 収益源 | 状態 | 備考 |
|--------|------|------|
| バナー広告 (AdMob) | **有効** | MemoList, MemoDetail, Settings に表示。プレミアム時非表示 |
| インタースティシャル広告 | **無効** (`ADS_ENABLED = false`) | フック実装済みだが発火しない |
| プレミアムサブスクリプション | **未実装** | 「Coming soon」Alert のみ |
| 7日間トライアル | **動作中** | 完全クライアントサイド |

### 3.2 🔴 Critical: プレミアム判定が完全クライアントサイド

**問題:** `isPremium` フラグは MMKV に保存されたブール値のみ。以下の方法で簡単にバイパス可能:
- アプリデータ消去 → `hasUsedTrial` リセット → 無限トライアル
- MMKV の値を書き換え(`isPremium: true`)
- root 端末で SharedPreferences を直接編集

**収益への影響:** 課金を実装しても、技術に明るいユーザーは無料でプレミアム機能を利用し続ける。

**推奨対応:**
1. **Phase 1（短期）:** Google Play Billing Library (`react-native-iap` or RevenueCat `react-native-purchases`) を導入し、購入レシートをサーバーサイドで検証
2. **Phase 2（中期）:** Cloud Functions でレシート検証 → Firestore のユーザードキュメントに `premiumExpiry` タイムスタンプを保存 → アプリ起動時に照合

### 3.3 🟡 インタースティシャル広告が無効化されたまま

**場所:** `src/hooks/useInterstitialAd.ts` L10: `ADS_ENABLED = false`

**影響:** メモ保存後・設定タブ遷移時のインタースティシャル広告が完全に無効。バナー広告のみでは eCPM が低く、収益が限定的。

**推奨:**
- `ADS_ENABLED = true` に戻す
- 表示頻度を制御（例: 3回に1回、1日最大5回など）
- ユーザーの不快感を軽減しつつ収益を確保

### 3.4 収益最大化のための提案

| 施策 | 期待効果 | 実装難易度 |
|------|----------|------------|
| **インタースティシャル広告再有効化** | eCPM 5〜10倍向上 | ★☆☆ (フラグ変更のみ) |
| **Google Play Billing 導入** | サブスク収益の確保 | ★★★ |
| **3段階プラン実装**（Free/Ad-free ¥120/Premium ¥350） | ARPU 向上 | ★★★ |
| **トライアル終了時のプッシュ通知** | 有料転換率向上 | ★★☆ |
| **ウィジェット機能（プレミアム限定）** | プレミアム訴求力強化 | ★★★ |
| **共有メモのリアルタイム同期（プレミアム限定）** | 差別化 | ★★☆ |
| **年間プラン割引** | LTV 向上 | ★☆☆ (Billing 導入後) |

---

## 4. コード品質・バグ

### 4.1 🔴 `index.js` の `backgroundTask` が存在しないエクスポートを参照

**場所:** `index.js` L10

```javascript
import { backgroundTask } from './src/services/geofenceService';
AppRegistry.registerHeadlessTask('YorimichiGeofence1', () => backgroundTask);
```

**問題:** `geofenceService.ts` に `backgroundTask` というエクスポートは存在しない（ネイティブジオフェンスに移行した際に削除済み）。

**影響:** `react-native-background-actions` がバックグラウンドタスクを発火しようとした場合にクラッシュする可能性がある。

**修正:** この2行を削除し、`react-native-background-actions` を `package.json` からもアンインストール。

### 4.2 🟡 `BootReceiver` がアプリ UI を全画面起動する

**場所:** `android/.../BootReceiver.kt`

**問題:** 端末再起動時に `startActivity()` でメインアクティビティを起動するため、ユーザーの意図に反してアプリが前面に表示される。

**推奨:** `startActivity` の代わりに `Intent.FLAG_ACTIVITY_NO_ANIMATION` + バックグラウンドサービスでジオフェンス再登録のみ実行。または `WorkManager` に委譲。

### 4.3 🟡 共有メモのリアルタイム同期が不完全

**現状:** `subscribeToSharedMemo` は `onSnapshot` を使用しているが、呼び出し元（`MemoDetailScreen`）でアイテム変更の `onSnapshot` を listen していない。ユーザーが手動「同期」ボタンを押す必要がある。

**推奨:** `useEffect` で `onSnapshot` リスナーをアタッチし、コラボレーターの変更をリアルタイム反映。

### 4.4 🟡 `MemoDetailScreen` のアイテム描画が `ScrollView` + `.map()`

**問題:** プレミアムユーザーは最大100アイテムを登録可能だが、`FlatList`（仮想化リスト）ではなく `ScrollView` + `.map()` で全件レンダリングしている。

**影響:** 50〜100件のアイテムでスクロール性能が低下する可能性。

**推奨:** アイテム数が一定以上の場合は `FlatList` に切り替え。

### 4.5 🟢 良い実装パターン

- `useShallow` セレクターによるリレンダー最適化
- `useCallback` / `useMemo` の適切な使用
- `FlatList` によるメモリスト仮想化
- `InteractionManager.runAfterInteractions` によるチュートリアル測定遅延
- ネイティブジオフェンス（Java）によるバッテリー効率
- Hermes エンジンと New Architecture 有効化

---

## 5. 依存関係

### 5.1 🟡 不要な依存パッケージ（バンドルサイズ肥大化）

| パッケージ | 理由 |
|-----------|------|
| `react-native-background-actions` | ネイティブジオフェンスに移行済み。`index.js` の参照も削除すべき |
| `react-native-google-places-autocomplete` | Nominatim OSM 検索に移行済み |
| `uuid` | プロジェクト内で未使用（`helpers.ts` の `generateId()` で自前実装） |
| `react-native-nitro-modules` | ソース内で使用箇所なし |

**影響:** デバッグ APK 75MB → 不要パッケージ削除で数MB軽量化が見込める。

### 5.2 🟡 リリース ABI が `arm64-v8a` のみ

**場所:** `android/gradle.properties` L32

```properties
reactNativeArchitectures=arm64-v8a
```

**問題:** コメントでは「Release: armeabi-v7a,arm64-v8a,x86,x86_64」とあるが、実値と不一致。32-bit デバイス（一部 Android Go 端末）が除外される。

**推奨:** リリースビルドでは以下を使用:
```properties
reactNativeArchitectures=armeabi-v7a,arm64-v8a
```

### 5.3 🟡 Firebase パッケージが `package.json` に不記載の懸念

`shareService.ts` で `@react-native-firebase/auth` と `@react-native-firebase/firestore` を使用しているが、`package.json` での記載を確認すること。オートリンク依存の場合、CI/CD や新規クローンで問題が発生する可能性。

### 5.4 🟡 AGP 9 の脆弱なワークアラウンド

**場所:** `android/app/build.gradle` の `afterEvaluate` ブロック

```groovy
afterEvaluate {
  // play-services-location JAR を debugCompileClasspath に手動追加
}
```

K2 コンパイラ + AGP 9 の組み合わせで GMS ジェネリクス型解決が壊れるため、Java で `GeofenceModule` を実装し、classpath を手動操作している。React Native / AGP のアップデート時に壊れるリスクあり。

---

## 6. 推奨アクションリスト

### 🔴 最優先（リリース前に対応すべき）

| # | 内容 | カテゴリ |
|---|------|----------|
| 1 | **Firestore Security Rules を作成・デプロイ** | セキュリティ |
| 2 | **`isPremium: true` マイグレーションを `false` に修正** | セキュリティ / 収益化 |
| 3 | **`index.js` の `backgroundTask` 参照を削除** | バグ |

### 🟡 短期（次回リリースまでに）

| # | 内容 | カテゴリ |
|---|------|----------|
| 4 | インタースティシャル広告を頻度制御付きで再有効化 | 収益化 |
| 5 | `BootReceiver` をバックグラウンド再登録に変更 | UX |
| 6 | 不要パッケージ4つをアンインストール | バンドルサイズ |
| 7 | リリース ABI に `armeabi-v7a` を追加 | 互換性 |
| 8 | shareId フォーマットバリデーション追加 | セキュリティ |
| 9 | `notifWindowStart === notifWindowEnd` のガード追加 | エッジケース |

### 🟢 中期（収益化フェーズ）

| # | 内容 | カテゴリ |
|---|------|----------|
| 10 | Google Play Billing / RevenueCat 導入 | 収益化 |
| 11 | サーバーサイドプレミアム検証 | セキュリティ / 収益化 |
| 12 | 共有メモのリアルタイム同期（onSnapshot） | 機能 |
| 13 | MemoDetailScreen のアイテム FlatList 化 | パフォーマンス |
| 14 | サービス層のユニットテスト追加 | テスト |
| 15 | トライアル終了プッシュ通知 | 収益化 |

---

*レビュー実施日: 2026年3月8日*
*対象バージョン: 1.0.10 (versionCode 11)*
*レビュアー: GitHub Copilot*
