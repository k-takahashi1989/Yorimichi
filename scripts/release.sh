#!/usr/bin/env bash
# release.sh — リリースAABビルド（バージョン自動インクリメント + キャッシュクリア）
#
# 使い方:
#   ./scripts/release.sh                    → versionCode +1, patch +1 (例: 1.0.18 → 1.0.19)
#   ./scripts/release.sh --version 1.1.0    → versionCode +1, versionName を指定値に更新
#   ./scripts/release.sh --minor            → versionCode +1, minor +1 (例: 1.0.18 → 1.1.0)
#   ./scripts/release.sh --major            → versionCode +1, major +1 (例: 1.0.18 → 2.0.0)
#   ./scripts/release.sh --no-clean         → キャッシュクリアをスキップ
#
# 所要時間の目安:
#   キャッシュクリア込みフルビルド: ~5-10 分
#   --no-clean 指定時: ~2-5 分

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# ── 引数パース ────────────────────────────────────────────────────
VERSION_NAME=""
BUMP="patch"
CLEAN=true

while [[ $# -gt 0 ]]; do
    case "$1" in
        --version)  VERSION_NAME="$2"; BUMP="none"; shift 2 ;;
        --minor)    BUMP="minor"; shift ;;
        --major)    BUMP="major"; shift ;;
        --no-clean) CLEAN=false; shift ;;
        -h|--help)
            sed -n '2,11p' "$0"
            exit 0
            ;;
        *) echo "Unknown option: $1"; exit 1 ;;
    esac
done

# ── 環境変数（Windows WSL / macOS / Linux 共通） ─────────────────
if [[ -z "${ANDROID_HOME:-}" ]]; then
    if [[ -d "$HOME/Android/Sdk" ]]; then
        export ANDROID_HOME="$HOME/Android/Sdk"
    elif [[ -d "$HOME/Library/Android/sdk" ]]; then
        export ANDROID_HOME="$HOME/Library/Android/sdk"
    fi
fi

# ── 1. version.properties を読み込み & バージョンアップ ───────────
VERSION_FILE="android/version.properties"

if [[ ! -f "$VERSION_FILE" ]]; then
    echo "ERROR: $VERSION_FILE not found"
    exit 1
fi

OLD_CODE=$(grep '^VERSION_CODE=' "$VERSION_FILE" | cut -d= -f2)
OLD_NAME=$(grep '^VERSION_NAME=' "$VERSION_FILE" | cut -d= -f2)
NEW_CODE=$((OLD_CODE + 1))

if [[ -n "$VERSION_NAME" ]]; then
    NEW_NAME="$VERSION_NAME"
else
    IFS='.' read -r MAJOR MINOR PATCH <<< "$OLD_NAME"
    case "$BUMP" in
        patch) NEW_NAME="$MAJOR.$MINOR.$((PATCH + 1))" ;;
        minor) NEW_NAME="$MAJOR.$((MINOR + 1)).0" ;;
        major) NEW_NAME="$((MAJOR + 1)).0.0" ;;
    esac
fi

echo ""
echo "========================================"
echo "  Yorimichi Release Build"
echo "========================================"
echo ""
echo "[1/5] Bumping version: $OLD_CODE → $NEW_CODE ($OLD_NAME → $NEW_NAME)"

cat > "$VERSION_FILE" << EOF
VERSION_CODE=$NEW_CODE
VERSION_NAME=$NEW_NAME
EOF

# package.json の version も同期
if command -v node &>/dev/null; then
    node -e "
        const fs = require('fs');
        const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
        pkg.version = '$NEW_NAME';
        fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
    "
    echo "       package.json version → $NEW_NAME"
fi

# ── 2. キャッシュクリア ───────────────────────────────────────────
if $CLEAN; then
    echo ""
    echo "[2/5] Clearing caches..."

    # Metro bundler cache
    rm -rf "$ROOT/node_modules/.cache" 2>/dev/null || true
    rm -rf /tmp/metro-* 2>/dev/null || true
    rm -rf /tmp/haste-map-* 2>/dev/null || true

    # React Native build cache
    rm -rf "$ROOT/android/app/build" 2>/dev/null || true
    rm -rf "$ROOT/android/build" 2>/dev/null || true
    rm -rf "$ROOT/android/.gradle" 2>/dev/null || true

    # Gradle global cache (project-level only)
    rm -rf "$ROOT/android/app/src/main/assets/index.android.bundle" 2>/dev/null || true
    rm -rf "$ROOT/android/app/src/main/res/drawable-*" 2>/dev/null || true
    rm -rf "$ROOT/android/app/src/main/res/raw" 2>/dev/null || true

    # Watchman cache
    if command -v watchman &>/dev/null; then
        watchman watch-del-all 2>/dev/null || true
    fi

    echo "       Cache cleared!"
else
    echo ""
    echo "[2/5] Skipping cache clear (--no-clean)"
fi

# ── 3. 依存関係の確認 ────────────────────────────────────────────
echo ""
echo "[3/5] Checking dependencies..."
if [[ ! -d "node_modules" ]]; then
    echo "       Installing npm dependencies..."
    npm install
else
    echo "       node_modules OK"
fi

# ── 4. JS バンドル生成 ────────────────────────────────────────────
echo ""
echo "[4/5] Bundling JS..."
mkdir -p android/app/src/main/assets

npx react-native bundle \
    --platform android \
    --dev false \
    --entry-file index.js \
    --bundle-output android/app/src/main/assets/index.android.bundle \
    --assets-dest android/app/src/main/res \
    --reset-cache

# ── 5. AAB リリースビルド ─────────────────────────────────────────
echo ""
echo "[5/5] Building release AAB..."
cd android

if [[ -f "./gradlew" ]]; then
    chmod +x ./gradlew
    ./gradlew bundleRelease \
        -PreactNativeArchitectures=armeabi-v7a,arm64-v8a,x86,x86_64
elif [[ -f "./gradlew.bat" ]]; then
    # WSL environment
    ./gradlew.bat bundleRelease \
        -PreactNativeArchitectures=armeabi-v7a,arm64-v8a,x86,x86_64
else
    echo "ERROR: gradlew not found"
    exit 1
fi

cd "$ROOT"

# ── 完了 ──────────────────────────────────────────────────────────
AAB_PATH="android/app/build/outputs/bundle/release/app-release.aab"
echo ""
if [[ -f "$AAB_PATH" ]]; then
    SIZE=$(du -h "$AAB_PATH" | cut -f1)
    echo "========================================"
    echo "  Release build complete!"
    echo "========================================"
    echo "  AAB:     $AAB_PATH"
    echo "  Size:    $SIZE"
    echo "  Version: $NEW_NAME ($NEW_CODE)"
    echo "========================================"
else
    echo "ERROR: AAB not found at $AAB_PATH"
    exit 1
fi
