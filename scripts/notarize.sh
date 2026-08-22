#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VERSION=$(node -p "require('$ROOT/package.json').version" 2>/dev/null || echo "2.0.0")
DMG="$ROOT/dist/velocity-core-${VERSION}-macos.dmg"

[[ -f "$DMG" ]] || { echo "✗ DMG not found. Run: npm run dmg"; exit 1; }
command -v xcrun >/dev/null || { echo "✗ xcrun not found. Install Xcode Command Line Tools."; exit 1; }

echo "▲ Notarizing: $(basename "$DMG")"

if [[ -n "${APPLE_NOTARY_PROFILE:-}" ]]; then
    xcrun notarytool submit "$DMG" \
        --keychain-profile "$APPLE_NOTARY_PROFILE" \
        --wait \
        --progress
else
    : "${APPLE_ID:?Set APPLE_ID env var}"
    : "${APPLE_TEAM_ID:?Set APPLE_TEAM_ID env var}"
    : "${APPLE_APP_PASSWORD:?Set APPLE_APP_PASSWORD env var (app-specific password)}"

    xcrun notarytool submit "$DMG" \
        --apple-id "$APPLE_ID" \
        --team-id "$APPLE_TEAM_ID" \
        --password "$APPLE_APP_PASSWORD" \
        --wait \
        --progress
fi

echo "  Stapling..."
xcrun stapler staple "$DMG"
echo "  ✅ Notarization complete: $DMG"
