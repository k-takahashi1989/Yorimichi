# Yorimichi プロダクションリリースレビュー

**レビュー日**: 2026-03-20
**バージョン**: 1.0.18 (versionCode: 29)
**フレームワーク**: React Native 0.84.0 (Android)
**対象プラットフォーム**: Android（iOS は年末予定、当面リリースなし）

---

## 総合判定: Android リリース可能（軽微な修正推奨）

前回レビュー（2026-03-19）の CRITICAL 3件のうち 2件が修正済み。
残る iOS App Store ID プレースホルダーは、iOS リリースが年末予定のため現時点ではブロッカーではありません。
**Android 版のリリースに関しては、MEDIUM の1件を対応すればリリース可能な品質です。**

---

## 前回 CRITICAL 指摘の対応状況

### 1. ~~DebugPremiumCard が本番に露出~~ → 修正済み

**ファイル**: `src/screens/SettingsScreen.tsx:236`

```tsx
{__DEV__ && <DebugPremiumCard />}
```

`__DEV__` ガードが追加済み。本番ビルドではレンダリングされません。

---

### 2. iOS App Store ID がプレースホルダー → 対応不要（年末まで）

**ファイル**: `src/components/ReviewPromptModal.tsx:43`

```typescript
ios: 'https://apps.apple.com/app/idXXXXXXXXXX',
```

Android 版のみのリリースであり、`Platform.select` により Android では Google Play URL が使用されるため影響なし。
**iOS リリース時の TODO として残しておくこと。**

---

### 3. ~~使い方ガイドURLが example.com~~ → 修正済み

**ファイル**: `src/screens/SettingsScreen.tsx:495`

```typescript
Linking.openURL('https://weak-nose-94e.notion.site/Yorimichi-...')
```

実際の Notion ページに置換済み。

---

## 残存する指摘事項

### MEDIUM-1: `selectEffectivePremium` のデバッグフラグに `__DEV__` ガードなし

**ファイル**: `src/store/memoStore.ts:258-259`
**リスク**: 低〜中（MMKV を直接操作する技術知識が必要）

```typescript
export const selectEffectivePremium = (s: SettingsState): boolean => {
  if (s.debugForcePremium !== null) return s.debugForcePremium;  // ← __DEV__ なし
  return s.isPremium || isTrialActive(s.trialStartDate) || ...;
};
```

DebugPremiumCard の UI は `__DEV__` で保護されているが、ビジネスロジック側のフラグチェックにはガードがありません。
root 化端末やデバッグツールで MMKV の `debugForcePremium` を直接書き換えると課金バイパスが可能です。

**修正案**:
```typescript
export const selectEffectivePremium = (s: SettingsState): boolean => {
  if (__DEV__ && s.debugForcePremium !== null) return s.debugForcePremium;
  return s.isPremium || isTrialActive(s.trialStartDate) || ...;
};
```

---

### LOW-1: Cloud Functions のフォールバックURLが開発環境

**ファイル**: `src/services/fcmService.ts:22-24`

```typescript
const CLOUD_FUNCTIONS_BASE_URL =
  Config.CLOUD_FUNCTIONS_BASE_URL ??
  'https://asia-northeast1-yorimichi-app-dev.cloudfunctions.net';
```

`.env` 未設定時に開発環境へフォールバックしますが、リリースビルドでは `.env.production` が使用されるため、
正しく設定されていれば実害はありません。ただし、防御的に本番 URL をデフォルトにするか、
フォールバックを削除して `.env` 未設定時に明示的にエラーにする方が安全です。

---

### LOW-2: 共有リンクURLのハードコード

**ファイル**: `src/config/sharing.ts:5`

```typescript
export const SHARE_BASE_URL = 'https://yorimichi-app.web.app/share';
```

環境切替できませんが、本番 URL がハードコードされているため、
dev/staging 環境が不要なら実害はありません。将来的に `.env` から読む設計にすると良いでしょう。

---

## 追加レビュー所見（新規）

### アーキテクチャ・コード品質: 優

| 観点 | 評価 | 詳細 |
|------|------|------|
| **プロジェクト構造** | 優 | services / screens / components / store / hooks / config / utils の明確な責務分離 |
| **TypeScript** | 優 | 全ファイル TypeScript。`any` は最小限（5箇所）。型定義が `src/types/index.ts` に集約 |
| **状態管理** | 優 | Zustand + MMKV 永続化。`useShallow` で不要な再レンダリングを防止 |
| **エラーハンドリング** | 優 | 全サービスに try-catch + Crashlytics ログ。コンテキスト付きエラー記録 |
| **ストアマイグレーション** | 優 | v1→v13 の段階的マイグレーション。既存ユーザーのデータ破損を防止 |

### セキュリティ: 良

| 観点 | 評価 | 詳細 |
|------|------|------|
| **シークレット管理** | 優 | `react-native-config` で環境変数化。API鍵のハードコードなし |
| **Firestore ルール** | 優 | UID ベースのアクセス制御。`ownerUid` / `collaboratorUids` による権限検証。レガシー移行パスあり（2026-06-30 まで） |
| **Cloud Function 認証** | 優 | Bearer トークン + `verifyIdToken()` で ID トークン検証 |
| **レート制限** | 優 | クライアント側 + サーバー側の二重クールダウン（60秒） |
| **無効トークン清掃** | 良 | FCM 送信失敗時に無効トークンを自動削除 |
| **ネットワーク** | 優 | HTTPS 強制。iOS ATS 有効。Android リリースで Cleartext 無効 |
| **ログ出力** | 優 | 全 `console.log` が `__DEV__` ガード付き |
| **ProGuard/R8** | 優 | リリースビルドで難読化有効 |

### テスト: 良

| 観点 | 評価 | 詳細 |
|------|------|------|
| **ユニットテスト** | 良 | 14ファイル。主要サービス（backup, badge, coupon, fcm, purchase, share, widget）をカバー |
| **E2E テスト** | 良 | Maestro 6フロー（起動、作成、編集、チェック、削除、設定） |
| **モック** | 優 | 15+ ネイティブモジュールの Jest モック完備 |
| **CI 自動化** | 要改善 | GitHub Actions 等の CI パイプラインが未確認。手動テスト依存のリスク |

### その他の良い点

| 項目 | 詳細 |
|------|------|
| **i18n** | i18next で日英完全対応。日付・数値フォーマットもローカライズ |
| **Crashlytics** | `__DEV__` で無効化。本番のみエラー収集 |
| **バージョン管理** | `version.properties` で一元管理 |
| **Git フック** | Husky pre-commit で品質担保 |
| **アクセシビリティ** | 主要 UI に `accessibilityLabel` あり（拡充の余地あり） |
| **プライバシー** | `NSPrivacyTracking: false`。最小限のパーミッション |

---

## Firestore ルール特記事項

`isLegacyDoc()` フォールバックにより、`ownerUid` 未設定の既存ドキュメントは認証済みユーザー全員がアクセス可能です。
コード中のコメントに **2026-06-30 までに移行スクリプト実行** と記載あり。期限までに対応してください。

---

## iOS リリース時の TODO（年末向け）

iOS リリース前に対応が必要な項目：

| 項目 | ファイル | 内容 |
|------|---------|------|
| App Store ID | `src/components/ReviewPromptModal.tsx:43` | `idXXXXXXXXXX` を実際の ID に置換 |
| iOS ビルド確認 | `ios/` | CocoaPods / Xcode ビルド動作確認 |
| Push 通知 | `src/services/fcmService.ts:36` | `Platform.OS !== 'android'` の早期リターンを iOS 対応に変更 |
| APN 設定 | Firebase Console | APNs 認証キーの登録 |

---

## 推奨アクションサマリー

| 優先度 | 項目 | 対応 | ステータス |
|--------|------|------|-----------|
| ~~CRITICAL~~ | DebugPremiumCard 露出 | `__DEV__` ガード追加 | **修正済み** |
| ~~CRITICAL~~ | 使い方ガイドURL | 実URLに置換 | **修正済み** |
| MEDIUM | selectEffectivePremium | `__DEV__` ガード追加 | 未対応 |
| LOW | Cloud Functions URL | 本番URLデフォルト化 | 未対応 |
| LOW | 共有リンクURL | `.env` 化検討 | 未対応 |
| INFO | iOS App Store ID | iOS リリース時に対応 | 年末対応 |
| INFO | Firestore 移行 | レガシー `isLegacyDoc()` 削除 | 2026-06-30 期限 |

---

> **結論**: 前回の CRITICAL 3件中 2件が修正済み。残る `selectEffectivePremium` の `__DEV__` ガード追加（1行の変更）を行えば、Android 版はプロダクションリリース可能な品質です。セキュリティ基盤、エラーハンドリング、テスト体制、コードアーキテクチャはいずれもプロフェッショナルな水準に達しています。
