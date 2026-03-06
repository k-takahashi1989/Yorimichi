# トラブルシューティングガイド

## 目次

1. [8081エラー：Metroが起動できない](#1-8081エラーmetroが起動できない)
2. [デバッグビルドに変更が反映されない](#2-デバッグビルドに変更が反映されない)
3. [Gradle ビルドエラー](#3-gradle-ビルドエラー)

---

## 1. 8081エラー：Metroが起動できない

### 症状

```
Error: listen EADDRINUSE: address already in use :::8081
```

または `npx react-native start` 実行時に起動できない、アプリがバンドルを読み込めない。

### 原因

ポート **8081** が別のプロセス（前回のMetroの残骸、他のReact Nativeプロジェクトなど）に占有されている。

### 解決手順

#### ステップ1：ポート8081を使用しているPIDを確認

```powershell
netstat -ano | findstr :8081
```

出力例：
```
TCP  0.0.0.0:8081  0.0.0.0:0  LISTENING  23380
```
→ 右端の数字（例: `23380`）がPID。

#### ステップ2：そのプロセスを強制終了

```powershell
taskkill /PID <PID番号> /F
```

例：
```powershell
taskkill /PID 23380 /F
```

#### ステップ3：Metroをキャッシュクリアで再起動

```powershell
cd c:\Users\neigh\Documents\ShoppingReminder
npx react-native start --reset-cache
```

`INFO  Dev server ready.` が表示されれば成功。

#### ステップ4：デバイスにAPKをインストール（必要な場合）

別のターミナルで：
```powershell
cd c:\Users\neigh\Documents\ShoppingReminder\android
.\gradlew.bat installDebug --no-daemon
```

---

## 2. デバッグビルドに変更が反映されない

### 症状

コードを変更してもアプリの動作が変わらない。

### 原因

デバッグビルドのAPKはデバイスにキャッシュされた `ReactNativeDevBundle.js` を使う。
Metroが起動していない場合、古いキャッシュのまま動作する。

### 解決手順

1. **必ずMetroを起動してからアプリをテストする**

   ```powershell
   npx react-native start --reset-cache
   ```

2. Gradleキャッシュも疑われる場合は `app\build` を削除してから再インストール：

   ```powershell
   cd android
   Remove-Item -Recurse -Force app\build
   .\gradlew.bat installDebug --no-daemon --no-build-cache
   ```

---

## 3. Gradle ビルドエラー

### よくあるエラーと対処

| エラー | 対処 |
|---|---|
| `SDK location not found` | `android/local.properties` に `sdk.dir` を設定 |
| `JAVA_HOME is not set` | Android Studio の JDK パスを環境変数に設定 |
| `Execution failed for task ':app:mergeDebugResources'` | `app\build` を削除して再ビルド |

### クリーンビルド手順

```powershell
cd android
.\gradlew.bat clean
.\gradlew.bat installDebug --no-daemon
```
