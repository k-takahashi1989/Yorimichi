@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

REM release.bat — リリースAABビルド（バージョン自動インクリメント + キャッシュクリア）
REM
REM 使い方:
REM   scripts\release.bat                    → versionCode +1, patch +1
REM   scripts\release.bat --version 1.1.0    → versionCode +1, versionName を指定値に更新
REM   scripts\release.bat --minor            → versionCode +1, minor +1
REM   scripts\release.bat --major            → versionCode +1, major +1
REM   scripts\release.bat --no-clean         → キャッシュクリアをスキップ

set "ROOT=%~dp0.."
cd /d "%ROOT%"

REM ── 引数パース ──
set "VERSION_NAME="
set "BUMP=patch"
set "CLEAN=true"

:parse_args
if "%~1"=="" goto done_args
if "%~1"=="--version"  ( set "VERSION_NAME=%~2" & set "BUMP=none" & shift & shift & goto parse_args )
if "%~1"=="--minor"    ( set "BUMP=minor" & shift & goto parse_args )
if "%~1"=="--major"    ( set "BUMP=major" & shift & goto parse_args )
if "%~1"=="--no-clean" ( set "CLEAN=false" & shift & goto parse_args )
if "%~1"=="-h"         ( goto show_help )
if "%~1"=="--help"     ( goto show_help )
echo Unknown option: %~1
exit /b 1

:show_help
echo release.bat — リリースAABビルド
echo   --version X.Y.Z   バージョン指定
echo   --minor            minor +1
echo   --major            major +1
echo   --no-clean         キャッシュクリアをスキップ
exit /b 0

:done_args

REM ── 1. version.properties 読み込み & バージョンアップ ──
set "VERSION_FILE=android\version.properties"

if not exist "%VERSION_FILE%" (
    echo ERROR: %VERSION_FILE% not found
    exit /b 1
)

for /f "tokens=2 delims==" %%a in ('findstr "^VERSION_CODE=" "%VERSION_FILE%"') do set "OLD_CODE=%%a"
for /f "tokens=2 delims==" %%a in ('findstr "^VERSION_NAME=" "%VERSION_FILE%"') do set "OLD_NAME=%%a"

set /a NEW_CODE=OLD_CODE + 1

if not "%VERSION_NAME%"=="" (
    set "NEW_NAME=%VERSION_NAME%"
) else (
    for /f "tokens=1,2,3 delims=." %%a in ("%OLD_NAME%") do (
        set "MAJOR=%%a"
        set "MINOR=%%b"
        set "PATCH=%%c"
    )
    if "%BUMP%"=="patch" (
        set /a PATCH=PATCH + 1
        set "NEW_NAME=!MAJOR!.!MINOR!.!PATCH!"
    )
    if "%BUMP%"=="minor" (
        set /a MINOR=MINOR + 1
        set "NEW_NAME=!MAJOR!.!MINOR!.0"
    )
    if "%BUMP%"=="major" (
        set /a MAJOR=MAJOR + 1
        set "NEW_NAME=!MAJOR!.0.0"
    )
)

echo.
echo ========================================
echo   Yorimichi Release Build
echo ========================================
echo.
echo [1/5] Bumping version: %OLD_CODE% → %NEW_CODE% (%OLD_NAME% → %NEW_NAME%)

(
    echo VERSION_CODE=%NEW_CODE%
    echo VERSION_NAME=%NEW_NAME%
) > "%VERSION_FILE%"

REM package.json の version も同期
where node >nul 2>&1
if %errorlevel%==0 (
    node -e "const fs=require('fs');const p=JSON.parse(fs.readFileSync('package.json','utf8'));p.version='%NEW_NAME%';fs.writeFileSync('package.json',JSON.stringify(p,null,2)+'\n');"
    echo        package.json version → %NEW_NAME%
)

REM ── 2. キャッシュクリア ──
if "%CLEAN%"=="true" (
    echo.
    echo [2/5] Clearing caches...

    if exist "node_modules\.cache" rmdir /s /q "node_modules\.cache" 2>nul
    if exist "android\app\build" rmdir /s /q "android\app\build" 2>nul
    if exist "android\build" rmdir /s /q "android\build" 2>nul
    if exist "android\.gradle" rmdir /s /q "android\.gradle" 2>nul
    if exist "android\app\src\main\assets\index.android.bundle" del /q "android\app\src\main\assets\index.android.bundle" 2>nul

    echo        Cache cleared!
) else (
    echo.
    echo [2/5] Skipping cache clear --no-clean
)

REM ── 3. 依存関係の確認 ──
echo.
echo [3/5] Checking dependencies...
if not exist "node_modules" (
    echo        Installing npm dependencies...
    call npm install
) else (
    echo        node_modules OK
)

REM ── 4. JS バンドル生成 ──
echo.
echo [4/5] Bundling JS...
if not exist "android\app\src\main\assets" mkdir "android\app\src\main\assets"

call npx react-native bundle --platform android --dev false --entry-file index.js --bundle-output android\app\src\main\assets\index.android.bundle --assets-dest android\app\src\main\res --reset-cache

if %errorlevel% neq 0 (
    echo ERROR: JS bundle failed
    exit /b 1
)

REM ── 5. AAB リリースビルド ──
echo.
echo [5/5] Building release AAB...
cd android

if exist "gradlew.bat" (
    call gradlew.bat bundleRelease -PreactNativeArchitectures=armeabi-v7a,arm64-v8a,x86,x86_64
) else (
    echo ERROR: gradlew.bat not found
    exit /b 1
)

cd /d "%ROOT%"

REM ── 完了 ──
set "AAB_PATH=android\app\build\outputs\bundle\release\app-release.aab"
echo.
if exist "%AAB_PATH%" (
    echo ========================================
    echo   Release build complete!
    echo ========================================
    echo   AAB:     %AAB_PATH%
    echo   Version: %NEW_NAME% ^(%NEW_CODE%^)
    echo ========================================
) else (
    echo ERROR: AAB not found at %AAB_PATH%
    exit /b 1
)

endlocal
