# Yorimichi リリースレビューレポート

**レビュー日**: 2026-03-19
**バージョン**: 1.0.18 (versionCode: 29)
**フレームワーク**: React Native 0.84.0 (Android)

---

## 総合判定: リリース前に修正が必要な問題あり

全体的にセキュリティ基盤はしっかりしていますが、**リリースブロッカーが3件**あります。

---

## CRITICAL（リリースブロッカー）

### 1. デバッグ用プレミアム切替UIがプロダクションに露出

**ファイル**: `src/screens/SettingsScreen.tsx:236`

```tsx
<DebugPremiumCard />   // __DEV__ ガードなし
```

`DebugPremiumCard` コンポーネントが `__DEV__` チェックなしで設定画面に表示されています。これにより：
- **一般ユーザーがプレミアム機能を無料で有効化できる**（課金バイパス）
- `debugForcePremium` は MMKV に永続化されるため、設定すれば永続的に有効

**修正方法**: `{__DEV__ && <DebugPremiumCard />}` でガードする

---

### 2. iOS App Store ID がプレースホルダーのまま

**ファイル**: `src/components/ReviewPromptModal.tsx:43`

```typescript
ios: 'https://apps.apple.com/app/idXXXXXXXXXX',
```

レビュー促進フローのフォールバックURLが `idXXXXXXXXXX` のまま。iOS対応時に壊れたリンクになります。

---

### 3. 使い方ガイドURLが example.com のまま

**ファイル**: `src/screens/SettingsScreen.tsx:495`

```typescript
Linking.openURL('https://example.com/yorimichi-guide')
```

設定画面の「使い方ガイド」が `example.com` を開くため、ユーザーに無関係なページが表示されます。

---

## HIGH（早期修正推奨）

### 4. Cloud Functions のフォールバックURLが開発環境

**ファイル**: `src/services/fcmService.ts:22-24`

```typescript
const CLOUD_FUNCTIONS_BASE_URL =
  Config.CLOUD_FUNCTIONS_BASE_URL ??
  'https://asia-northeast1-yorimichi-app-dev.cloudfunctions.net';
```

`.env` に `CLOUD_FUNCTIONS_BASE_URL` が未設定の場合、**開発環境のCloud Function**にリクエストが飛びます。本番ビルドでは本番URLへのフォールバック、もしくはフォールバックなし（エラー）にすべきです。

### 5. 共有リンクURLが環境切替不可

**ファイル**: `src/config/sharing.ts:5`

```typescript
export const SHARE_BASE_URL = 'https://yorimichi-app.web.app/share';
```

ハードコードされているため、dev/staging/prod 環境の切替ができません。`.env` から読むべきです。

---

## MEDIUM（改善推奨）

### 6. `selectEffectivePremium` のデバッグフラグ依存

**ファイル**: `src/store/memoStore.ts:258-259`

```typescript
export const selectEffectivePremium = (s: SettingsState): boolean => {
  if (s.debugForcePremium !== null) return s.debugForcePremium;
```

プレミアム判定のビジネスロジック自体にデバッグフラグが組み込まれています。`__DEV__` ガードがないため、ローカルストレージを直接操作されると課金バイパスが可能です。上記 #1 の修正と合わせて、このロジック自体にも `__DEV__` チェックを追加すべきです。

### 7. フィードバックメールアドレスの有効性

**ファイル**: `src/components/ReviewPromptModal.tsx:87`

```typescript
Linking.openURL('mailto:support@yorimichi.app?subject=Feedback');
```

`support@yorimichi.app` がメール受信可能か確認が必要です。

---

## 良い点（ポジティブ評価）

| 項目 | 評価 |
|------|------|
| **シークレット管理** | react-native-config で環境変数化。API鍵のハードコードなし |
| **ログ出力** | 全て `__DEV__` ガード付き。本番でのログ漏洩なし |
| **ProGuard/R8** | リリースビルドで有効。難読化済み |
| **ネットワークセキュリティ** | リリースでCleartext無効。iOS ATS有効 |
| **署名設定** | keystore.properties を `.gitignore` で除外 |
| **Firebase Auth** | Cloud Function で IDトークン検証 + レート制限あり |
| **Crashlytics** | 本番エラーの集約体制あり |
| **テスト** | ユニットテスト14ファイル + Maestro E2E 6フロー |
| **i18n** | i18next による多言語対応済み |
| **バージョン管理** | version.properties による一元管理 |
| **Husky** | pre-commit フックでコード品質担保 |

---

## 推奨アクションサマリー

| 優先度 | 項目 | 対応 |
|--------|------|------|
| **CRITICAL** | DebugPremiumCard 露出 | `__DEV__` ガード追加 |
| **CRITICAL** | iOS App Store ID | 実際のIDに置換、または機能削除 |
| **CRITICAL** | 使い方ガイドURL | 実URLに置換、または一時非表示 |
| **HIGH** | Cloud Functions URL | 本番URLをデフォルトに、またはフォールバック削除 |
| **HIGH** | 共有リンクURL | `.env` から読む設計に変更 |
| **MEDIUM** | selectEffectivePremium | `__DEV__` ガード追加 |
| **MEDIUM** | フィードバックメール | メール受信確認 |

---

> **結論**: CRITICAL の3件を修正すればリリース可能な品質です。セキュリティ基盤、エラーハンドリング、テスト体制は十分に整っています。
