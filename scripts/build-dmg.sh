#!/usr/bin/env bash
set -e

# ==============================================================================
# Molecule POS - macOS DMG Build Script
# ==============================================================================
# Usage:
#   ./scripts/build-dmg.sh [arm64 | x64 | universal | all]
#
# Examples:
#   ./scripts/build-dmg.sh          # Builds both arm64 and x64 DMGs
#   ./scripts/build-dmg.sh arm64    # Builds Apple Silicon DMG only
#   ./scripts/build-dmg.sh x64      # Builds Intel Mac DMG only
#   ./scripts/build-dmg.sh universal# Builds Universal Mac DMG
# ==============================================================================

echo "==========================================="
echo "   Building Molecule macOS DMG Installer   "
echo "==========================================="

# Check operating system
OS="$(uname -s 2>/dev/null || echo "$OSTYPE")"
if [[ "$OS" != "Darwin"* ]]; then
  echo "⚠️  Note: Generating macOS .dmg disk images natively requires macOS (Darwin)."
  echo "   Current OS detected: $OS"
  echo "   For automated CI/CD builds, run on GitHub Actions 'macos-latest'."
  echo ""
fi

# Determine target architecture
TARGET_ARCH="${1:-all}"
echo "📦 Target Architecture: $TARGET_ARCH"

# Ensure dependencies are installed
if [ ! -d "node_modules" ]; then
  echo "📥 Installing dependencies..."
  npm ci || npm install
fi

# Rebuild native modules (better-sqlite3, @grandchef/node-printer) for Electron
echo "🔨 Rebuilding native dependencies..."
npx electron-builder install-app-deps

# Build Vite application (main, preload, renderer)
echo "⚡ Compiling application bundles with electron-vite..."
npm run build

# Package DMG with electron-builder
echo "💿 Packaging macOS DMG..."
case "$TARGET_ARCH" in
  arm64)
    npx electron-builder --mac --arm64
    ;;
  x64)
    npx electron-builder --mac --x64
    ;;
  universal)
    npx electron-builder --mac --universal
    ;;
  all)
    npx electron-builder --mac
    ;;
  *)
    echo "❌ Unknown architecture: '$TARGET_ARCH'"
    echo "   Allowed values: arm64, x64, universal, all"
    exit 1
    ;;
esac

echo ""
echo "==========================================="
echo "✅ Build finished successfully!"
echo "   DMG files are available in: release/"
echo "==========================================="
