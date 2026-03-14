# Yorimichi — Copilot ビルド & 開発ガイド

## プロジェクト概要

場所ベースのリマインダーアプリ（Android）。登録した場所に近づくと通知でリマインドする。

| 項目 | 値 |
|------|-----|
| フレームワーク | React Native 0.84.0 |
| アーキテクチャ | New Architecture (TurboModules / Fabric) |
| JS エンジン | Hermes |
| 言語 | TypeScript 5.8.3 |
| 状態管理 | Zustand |
| ナビゲーション | React Navigation v7 (native-stack + bottom-tabs) |
| App ID | `com.ktakahashi.yorimichi` |

### ビルドツールバージョン

| ツール | バージョン |
|--------|-----------|
| Gradle | 9.0.0 |
| Kotlin | 2.1.20 |
| compileSdkVersion | 36 |
| minSdkVersion | 24 |
| NDK | 27.1.12297006 |
| Node.js | >= 22.11.0 |

### 環境変数（PowerShell）

```powershell
$env:JAVA_HOME  = "C:\Program Files\Android\Android Studio\jbr"
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
```

### 必須設定ファイル

- `.env` — `.env.example` を参照して作成（Google Maps API Key、Mapbox Token、AdMob ID、RevenueCat Key）

---

## デバッグビルド手順

### 1. ビルド種別の判定

| 変更した内容 | 使用スクリプト | 所要時間 |
|-------------|--------------|---------|
| `.ts` / `.tsx` / `.js` のみ | `scripts/build_fast.ps1` | ~40秒 |
| パッケージ追加 (`yarn add`)、`build.gradle`、`AndroidManifest.xml`、ネイティブコード | `scripts/build_native.ps1` | ~2-3分 |

### 2. ビルド実行手順

```powershell
# 0. 前提確認
adb devices                    # エミュレータ or 実機が接続されているか
Test-Path .env                 # .env が存在するか（false なら .env.example からコピー）

# 1. JS のみ変更の場合（高速ビルド）
.\scripts\build_fast.ps1

# 2. ネイティブ変更を含む場合（フルビルド）
.\scripts\build_native.ps1
```

### 3. Metro 開発サーバーのみ起動する場合

```powershell
npx react-native start
# キャッシュクリアが必要な場合:
npx react-native start --reset-cache
```

---

## よくあるエラーと対処法

### Metro バンドルエラー

| エラーメッセージ | 原因 | 解決方法 |
|----------------|------|---------|
| `Unable to resolve module '...'` | Metro キャッシュの不整合 | `npx react-native start --reset-cache` |
| `SHA-1 for file is not computed` | Watchman のファイル監視問題 | `watchman watch-del-all` → 再起動 |
| `Cannot read properties of undefined` (import 関連) | node_modules の不整合 | `Remove-Item -Recurse -Force node_modules; yarn install` |
| `Reanimated` / `worklet` transform エラー | Babel キャッシュ破損 | `Remove-Item -Recurse -Force node_modules\.cache; npx react-native start --reset-cache` |

### Gradle ビルドエラー

| エラーメッセージ | 原因 | 解決方法 |
|----------------|------|---------|
| `FAILURE: Build failed with an exception` | ビルドキャッシュ破損 | `cd android; .\gradlew.bat clean; cd ..` → `build_native.ps1` |
| `Could not determine the dependencies of task` | Gradle sync の問題 | `Remove-Item -Recurse -Force android\.gradle -ErrorAction SilentlyContinue` → `build_native.ps1` |
| `Execution failed for task ':app:mergeDebugResources'` | リソース重複 | `Remove-Item -Recurse -Force android\app\build` → `build_native.ps1` |
| `Duplicate class` | 依存ライブラリのバージョン衝突 | `cd android; .\gradlew.bat clean; Remove-Item -Recurse -Force .gradle; cd ..` → `build_native.ps1` |

### ネイティブ / 設定エラー

| エラーメッセージ | 原因 | 解決方法 |
|----------------|------|---------|
| `hermesc` 関連エラー | Hermes コンパイラ問題 | WSL が起動しているか確認。`wsl --status` で確認 |
| `Config.GOOGLE_MAPS_API_KEY` が undefined | `.env` ファイル未設定 | `.env.example` をコピーして `.env` を作成し、API キーを設定 |
| `No connected devices` | エミュレータ未起動 | Android Studio でエミュレータを起動、または実機を USB 接続 |

---

## 全キャッシュクリア（最終手段）

上記の個別対処で解決しない場合、以下のコマンドで全キャッシュを一括クリアする。

```powershell
# 1. Metro & Babel キャッシュ
Remove-Item -Recurse -Force node_modules\.cache -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force $env:TEMP\metro-* -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force $env:TEMP\haste-map-* -ErrorAction SilentlyContinue

# 2. Watchman
watchman watch-del-all 2>$null

# 3. node_modules 再インストール
Remove-Item -Recurse -Force node_modules -ErrorAction SilentlyContinue
yarn install

# 4. Gradle キャッシュ
Remove-Item -Recurse -Force android\app\build -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force android\.gradle -ErrorAction SilentlyContinue

# 5. フルビルド
.\scripts\build_native.ps1
```

---

## エラー対処の判断フロー

```
エラー発生
├── Metro (JS バンドル) エラー？
│   ├── import / resolve 系 → npx react-native start --reset-cache
│   ├── Reanimated / worklet 系 → node_modules\.cache 削除 → --reset-cache
│   └── まだ解消しない → node_modules 再インストール → --reset-cache
├── Gradle (ネイティブ) エラー？
│   ├── mergeResources / duplicate 系 → android\app\build 削除 → build_native.ps1
│   ├── dependency / sync 系 → android\.gradle 削除 → build_native.ps1
│   └── まだ解消しない → 全キャッシュクリア
└── まだ解消しない → 全キャッシュクリア（上記の手順を実行）
```

---

## テスト

```powershell
# ユニットテスト
npx jest --no-coverage

# E2E テスト（Maestro — エミュレータ必須）
yarn e2e           # スモーク
yarn e2e:full      # 全シナリオ
```

---

## プロジェクト構成

```
src/
├── components/     # 共通 UI コンポーネント
├── config/         # アプリ設定（プラン上限、定数）
├── hooks/          # カスタム React Hooks
├── i18n/           # 多言語対応（ja.ts / en.ts）
├── navigation/     # React Navigation 設定
├── screens/        # 画面コンポーネント
├── services/       # ビジネスロジック（通知、Firebase、ジオフェンス、共有）
├── storage/        # MMKV 永続ストレージ
├── store/          # Zustand 状態管理
├── types/          # TypeScript 型定義
└── utils/          # ユーティリティ関数
scripts/
├── build_fast.ps1     # JS のみ高速ビルド
├── build_native.ps1   # フルクリーンビルド
└── hermesc-win.js     # Hermes コンパイラ WSL ラッパー
```

## 注意事項

- デバッグビルドは **arm64-v8a** のみ（ビルド高速化のため）。リリースビルドは全アーキテクチャ対応
- `babel.config.js` の `react-native-reanimated/plugin` は **plugins 配列の最後** に配置する必要がある
- `metro.config.js` で `unstable_enablePackageExports: true` を設定済み（react-native-google-mobile-ads の依存解決に必要）
- Hermes コンパイラは Windows では WSL 経由で動作する（`scripts/hermesc-win.js`）
- Play Services Location は `21.3.0` に統一済み（バージョン衝突防止）
