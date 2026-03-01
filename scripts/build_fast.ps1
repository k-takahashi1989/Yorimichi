#!/usr/bin/env pwsh
# build_fast.ps1 — JS のみ変更した場合の高速インストール (clean なし)
# ネイティブコード変更 (new package / build.gradle) は build_native.ps1 を使うこと
#
# 所要時間の目安:
#   JS バンドル生成: ~20 秒
#   APK 差分インストール: ~20 秒
#   合計: ~40 秒

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$ROOT = "$PSScriptRoot\.."
Set-Location $ROOT

$env:JAVA_HOME  = "C:\Program Files\Android\Android Studio\jbr"
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"

# ── 1. JS バンドル生成 ────────────────────────────────────────────
Write-Host "[1/3] Bundling JS..." -ForegroundColor Cyan
New-Item -ItemType Directory -Force "android/app/src/main/assets" | Out-Null

npx react-native bundle `
    --platform android `
    --dev false `
    --entry-file index.js `
    --bundle-output android/app/src/main/assets/index.android.bundle `
    --assets-dest android/app/src/main/res

if ($LASTEXITCODE -ne 0) { Write-Error "Bundle failed"; exit 1 }

# ── 2. APK ビルド & インストール（clean なし・デーモン使用）──────────────────────
Write-Host "[2/3] Building APK (incremental, no clean)..." -ForegroundColor Cyan
Set-Location "android"

.\gradlew.bat installDebug 2>&1

if ($LASTEXITCODE -ne 0) {
    Write-Error "Build failed. If you recently added a native package, run build_native.ps1 instead."
    exit 1
}
Set-Location $ROOT

# ── 3. アプリ起動 ─────────────────────────────────────────────────
Write-Host "[3/3] Launching app..." -ForegroundColor Cyan
& "$env:ANDROID_HOME\platform-tools\adb.exe" shell am force-stop com.ktakahashi.yorimichi
Start-Sleep -Seconds 1
& "$env:ANDROID_HOME\platform-tools\adb.exe" shell am start -n "com.ktakahashi.yorimichi/.MainActivity"

Write-Host "Done!" -ForegroundColor Green
