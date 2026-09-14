#!/usr/bin/env bash
# Build a distributable desktop installer (macOS DMG / Windows NSIS / Linux AppImage).
# Output lands in dist-electron/, e.g. Suricate-Desktop-0.1.0-arm64.dmg
set -euo pipefail
cd "$(dirname "$0")"

if [[ ! -d node_modules ]]; then
  echo "Installing dependencies..."
  npm install
fi

npm run build
echo
echo "Done. Artifacts:"
ls -lh dist-electron/*.{dmg,exe,AppImage,deb} 2>/dev/null || ls -lh dist-electron | head -40
