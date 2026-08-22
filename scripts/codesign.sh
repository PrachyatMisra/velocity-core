#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP="$ROOT/target/release/bundle/macos/Velocity Core.app"
[[ -d "$APP" ]] || APP="$ROOT/src-tauri/target/release/bundle/macos/Velocity Core.app"
ID="${CODESIGN_IDENTITY:--}"
ENT="$ROOT/src-tauri/entitlements.plist"

echo "▲ Code Signing: $(basename "$APP")"
[[ -d "$APP" ]] || { echo "✗ Build first: npm run tauri:build"; exit 1; }
command -v codesign >/dev/null || { echo "✗ codesign not found."; exit 1; }

if [[ "$ID" == "-" ]]; then
    echo "  ⚠ Using ad-hoc signing (-). Use --sign for Developer ID signing."
fi

# Sign libraries first
find "$APP" \( -name "*.dylib" -o -name "*.so" \) -print0 | while IFS= read -r -d '' lib; do
    codesign --force --sign "$ID" --options runtime "$lib" 2>/dev/null || true
done

# Sign sidecar binaries
for s in "$APP/Contents/MacOS/vcx"*; do
    [[ -f "$s" ]] && codesign --force --sign "$ID" --options runtime --entitlements "$ENT" "$s" && echo "  ✓ Signed: $(basename "$s")"
done

# Sign app bundle
codesign --force --sign "$ID" --options runtime --entitlements "$ENT" --deep "$APP"
codesign --verify --verbose=2 --deep "$APP"
spctl --assess --type execute "$APP" >/dev/null 2>&1 || true
echo "  ✅ Code signing complete"
