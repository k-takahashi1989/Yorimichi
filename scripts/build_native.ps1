#!/usr/bin/env pwsh
# build_native.ps1 — ネイティブ変更時のフルクリーンビルド
# 使うタイミング:
#   - 新しい npm パッケージ追加後 (npm install)
#   - android/build.gradle や AndroidManifest.xml を変更後
#   - Firebase 等ネイティブ設定変更後
#
# 所要時間の目安:
#   clean: ~10 秒
#   JS バンドル: ~20 秒
#   ネイティブコンパイル + インストール: ~2～3 分 (arm64 のみ)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$ROOT = "$PSScriptRoot\.."
Set-Location $ROOT

$env:JAVA_HOME  = "C:\Program Files\Android\Android Studio\jbr"
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"

# ── 1. Clean ──────────────────────────────────────────────────────
Write-Host "[1/4] Cleaning build cache..." -ForegroundColor Cyan
Remove-Item -Recurse -Force "android\app\build" -ErrorAction SilentlyContinue

# ── 2. JS バンドル生成 ────────────────────────────────────────────
Write-Host "[2/4] Bundling JS..." -ForegroundColor Cyan
New-Item -ItemType Directory -Force "android/app/src/main/assets" | Out-Null

npx react-native bundle `
    --platform android `
    --dev false `
    --entry-file index.js `
    --bundle-output android/app/src/main/assets/index.android.bundle `
    --assets-dest android/app/src/main/res

if ($LASTEXITCODE -ne 0) { Write-Error "Bundle failed"; exit 1 }

# ── 3. フルビルド & インストール ──────────────────────────────────
Write-Host "[3/4] Clean build + install (arm64 only)..." -ForegroundColor Cyan
Set-Location "android"

.\gradlew.bat clean installDebug 2>&1

if ($LASTEXITCODE -ne 0) { Write-Error "Build failed"; exit 1 }
Set-Location $ROOT

# ── 4. アプリ起動 ─────────────────────────────────────────────────
Write-Host "[4/4] Launching app..." -ForegroundColor Cyan
& "$env:ANDROID_HOME\platform-tools\adb.exe" shell am force-stop com.ktakahashi.yorimichi
Start-Sleep -Seconds 1
& "$env:ANDROID_HOME\platform-tools\adb.exe" shell am start -n "com.ktakahashi.yorimichi/.MainActivity"

Write-Host "Done!" -ForegroundColor Green
