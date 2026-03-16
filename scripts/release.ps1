#!/usr/bin/env pwsh
# release.ps1 — リリースAABビルド（versionCode 自動インクリメント付き）
#
# 使い方:
#   .\scripts\release.ps1              → versionCode +1, versionName そのまま
#   .\scripts\release.ps1 -VersionName "1.1.0"  → versionCode +1, versionName を指定値に更新
#
# 所要時間の目安:
#   インクリメンタルビルド: ~2-5 分
#   クリーンビルド不要（version.properties の変更を Gradle が検知）

param(
    [string]$VersionName = ""
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$ROOT = "$PSScriptRoot\.."
Set-Location $ROOT

$env:JAVA_HOME    = "C:\Program Files\Android\Android Studio\jbr"
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"

# ── 1. version.properties を読み込み & インクリメント ──────────────
$versionFile = "android\version.properties"
$props = @{}
Get-Content $versionFile | ForEach-Object {
    if ($_ -match '^(\w+)=(.*)$') {
        $props[$Matches[1]] = $Matches[2]
    }
}

$oldCode = [int]$props['VERSION_CODE']
$newCode = $oldCode + 1
$newName = if ($VersionName) { $VersionName } else { $props['VERSION_NAME'] }

Write-Host "[1/4] Bumping version: $oldCode -> $newCode ($newName)" -ForegroundColor Cyan

Set-Content $versionFile "VERSION_CODE=$newCode`nVERSION_NAME=$newName`n"

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

# ── 3. AAB リリースビルド（クリーン不要）──────────────────────────
Write-Host "[3/4] Building release AAB (incremental)..." -ForegroundColor Cyan
Set-Location "android"

.\gradlew.bat bundleRelease -PreactNativeArchitectures=armeabi-v7a,arm64-v8a,x86,x86_64 2>&1

if ($LASTEXITCODE -ne 0) { Write-Error "Build failed"; exit 1 }
Set-Location $ROOT

# ── 4. 成果物の確認 ──────────────────────────────────────────────
$aabPath = "android\app\build\outputs\bundle\release\app-release.aab"
if (Test-Path $aabPath) {
    $size = [math]::Round((Get-Item $aabPath).Length / 1MB, 1)
    Write-Host ""
    Write-Host "Release build complete!" -ForegroundColor Green
    Write-Host "  AAB: $aabPath" -ForegroundColor Green
    Write-Host "  Size: ${size} MB" -ForegroundColor Green
    Write-Host "  Version: $newName ($newCode)" -ForegroundColor Green
} else {
    Write-Error "AAB not found at $aabPath"
}
