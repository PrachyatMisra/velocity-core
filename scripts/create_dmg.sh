#!/usr/bin/env bash
set -euo pipefail
# ── VELOCITY CORE APEX — Professional DMG Builder ────────────────────────────
# Uses: create-dmg (Node.js) → hdiutil fallback → final compressed DMG
# Usage: bash scripts/create_dmg.sh [--skip-build]

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

BUNDLE_NAME="Velocity Core.app"
VERSION="$(node -p "require('$ROOT/package.json').version" 2>/dev/null || echo '0.0.0')"
VOLUME_NAME="Velocity Core $VERSION"
DMG_NAME="velocity-core-${VERSION}-macos"
DIST_DIR="$ROOT/dist"
ICON_DIR="$ROOT/src-tauri/icons"
BG_PATH="/tmp/vcx_dmg_bg.png"
TEMP_DMG="$DIST_DIR/tmp_$DMG_NAME.dmg"
FINAL_DMG="$DIST_DIR/$DMG_NAME.dmg"
SKIP_BUILD=false
DEVICE=""
STAGING=""

RED='\033[0;31m'; GREEN='\033[0;32m'; CYAN='\033[0;36m'; YELLOW='\033[1;33m'; NC='\033[0m'
info()  { echo -e "${CYAN}[INFO]${NC} $*"; }
ok()    { echo -e "${GREEN}[OK]${NC} $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $*"; }
error() { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }

while [[ $# -gt 0 ]]; do
    case "$1" in
        --skip-build) SKIP_BUILD=true; shift ;;
        *) error "Unknown flag: $1" ;;
    esac
done

cleanup() {
    if [[ -n "$DEVICE" ]]; then
        hdiutil detach "$DEVICE" -quiet 2>/dev/null || hdiutil detach "$DEVICE" -force -quiet 2>/dev/null || true
    fi
    if [[ -n "$STAGING" && -d "$STAGING" ]]; then
        rm -rf "$STAGING"
    fi
    if [[ -f "$TEMP_DMG" ]]; then
        rm -f "$TEMP_DMG"
    fi
}
trap cleanup EXIT

# ── Step 1: Build if needed ───────────────────────────────────────────────────
if ! $SKIP_BUILD; then
    info "Building Velocity Core APEX..."
    npm run tauri:build || error "Tauri build failed. Run with --skip-build to skip."
fi

if [[ -d "$ROOT/target/release/bundle/macos/$BUNDLE_NAME" ]]; then
    BUILD_DIR="$ROOT/target/release/bundle/macos"
elif [[ -d "$ROOT/src-tauri/target/release/bundle/macos/$BUNDLE_NAME" ]]; then
    BUILD_DIR="$ROOT/src-tauri/target/release/bundle/macos"
else
    BUILD_DIR="$ROOT/target/release/bundle/macos"
fi

APP_BUNDLE="$BUILD_DIR/$BUNDLE_NAME"
[[ -d "$APP_BUNDLE" ]] || error "App bundle not found at $APP_BUNDLE. Run tauri:build first."
command -v hdiutil >/dev/null || error "hdiutil not found. This script must run on macOS."

mkdir -p "$DIST_DIR"
rm -f "$FINAL_DMG"

# ── Step 2: Generate DMG background (Python) ──────────────────────────────────
info "Generating DMG background image..."
python3 << 'PYEOF'
import struct, zlib, math

def make_png(W, H, draw_fn):
    pixels = []
    for y in range(H):
        for x in range(W):
            pixels.append(draw_fn(x, y, W, H))
    
    raw = b''
    for yi in range(H):
        row = b'\x00'
        for xi in range(W):
            pix = pixels[yi*W + xi]
            row += bytes(pix[:3])  # RGB
        raw += row
    
    comp = zlib.compress(raw, 9)
    def u32(n): return struct.pack('>I', n)
    def chunk(name, data):
        return u32(len(data)) + name + data + u32(zlib.crc32(name+data)&0xffffffff)
    
    return (b'\x89PNG\r\n\x1a\n' +
            chunk(b'IHDR', u32(W)+u32(H)+b'\x08\x02\x00\x00\x00') +
            chunk(b'IDAT', comp) +
            chunk(b'IEND', b''))

def draw_bg(x, y, W, H):
    # Dark gradient base
    gy = y / H
    r = int(8 + gy * 4)
    g = int(0 + gy * 2)
    b = int(12 + gy * 8)
    
    # Radial glow from center
    cx, cy = W/2, H/2
    dist = math.sqrt((x-cx)**2 + (y-cy)**2)
    glow = max(0, 1.0 - dist/(W*0.6))
    r = min(255, r + int(glow*glow*18))
    g = min(255, g + int(glow*glow*0))
    b = min(255, b + int(glow*glow*12))
    
    # Grid lines
    gsize = 36
    if (x % gsize < 1) or (y % gsize < 1):
        r = min(255, r + 8)
        b = min(255, b + 4)
    
    # Title area highlight
    if 80 < y < 140 and 60 < x < W-60:
        r = min(255, r + 6)
        b = min(255, b + 3)
    
    return (r, g, b, 255)

W, H = 660, 400
data = make_png(W, H, draw_bg)
with open('/tmp/vcx_dmg_bg.png', 'wb') as f:
    f.write(data)
print("Background generated: 660x400")
PYEOF

# ── Step 3: Try create-dmg (optional) ─────────────────────────────────────────
if [[ "${VCX_DMG_USE_CREATE_DMG:-0}" == "1" ]] && command -v create-dmg &>/dev/null; then
    info "Using create-dmg for professional DMG..."

    create_dmg_args=(
        --volname "$VOLUME_NAME"
        --volicon "$ICON_DIR/icon.icns"
        --window-pos 200 120
        --window-size 660 400
        --icon-size 100
        --icon "$BUNDLE_NAME" 190 190
        --hide-extension "$BUNDLE_NAME"
        --app-drop-link 470 190
        --no-internet-enable
    )
    if [[ -f "$BG_PATH" ]]; then
        create_dmg_args+=(--background "$BG_PATH")
    fi

    if create-dmg "${create_dmg_args[@]}" "$FINAL_DMG" "$BUILD_DIR"; then
        ok "DMG created with create-dmg"
    else
        warn "create-dmg failed, falling back to hdiutil..."
        rm -f "$FINAL_DMG"
    fi
elif [[ "${VCX_DMG_USE_CREATE_DMG:-0}" == "1" ]]; then
    warn "VCX_DMG_USE_CREATE_DMG=1 set but create-dmg is not installed. Using hdiutil."
fi

# ── Step 4: hdiutil fallback ──────────────────────────────────────────────────
if [[ ! -f "$FINAL_DMG" ]]; then
    info "Using hdiutil to create DMG..."

    STAGING="$(mktemp -d)"

    cp -R "$APP_BUNDLE" "$STAGING/"
    ln -sfn /Applications "$STAGING/Applications"
    
    # Optional background
    if [[ -f "$BG_PATH" ]]; then
        mkdir -p "$STAGING/.background"
        cp "$BG_PATH" "$STAGING/.background/bg.png"
    fi
    
    # Create writable DMG
    hdiutil create -srcfolder "$STAGING" -volname "$VOLUME_NAME" \
        -fs HFS+ -fsargs "-c c=64,a=16,b=16" \
        -format UDRW -size 512m "$TEMP_DMG"
    
    # Mount it
    DEVICE="$(hdiutil attach -readwrite -noverify -noautoopen "$TEMP_DMG" | \
             awk '/^\/dev\/disk/ { print $1; exit }')"
    [[ -n "$DEVICE" ]] || error "Failed to attach temporary DMG"
    
    sleep 2
    
    # Set Finder view via AppleScript
    if [[ "${VCX_DMG_FINDER_LAYOUT:-0}" == "1" ]] && command -v osascript >/dev/null; then
        osascript << ASEOF || warn "Failed to apply Finder layout customization"
tell application "Finder"
    tell disk "$VOLUME_NAME"
        open
        set current view of container window to icon view
        set toolbar visible of container window to false
        set statusbar visible of container window to false
        set the bounds of container window to {100, 100, 760, 500}
        set viewOptions to the icon view options of container window
        set arrangement of viewOptions to not arranged
        set icon size of viewOptions to 100
        close
        open
    end tell
end tell
ASEOF
    else
        info "Skipping Finder layout customization (set VCX_DMG_FINDER_LAYOUT=1 to enable)."
    fi
    
    sync
    hdiutil detach "$DEVICE" -quiet || hdiutil detach "$DEVICE" -force -quiet
    DEVICE=""
    
    # Convert to read-only compressed
    hdiutil convert "$TEMP_DMG" -format UDZO -imagekey zlib-level=9 -o "$FINAL_DMG"
    [[ -f "${FINAL_DMG}.dmg" ]] && mv "${FINAL_DMG}.dmg" "$FINAL_DMG"
    rm -f "$TEMP_DMG"
    
    ok "DMG created with hdiutil"
fi

# ── Step 5: Final stats ───────────────────────────────────────────────────────
[[ -f "$FINAL_DMG" ]] || error "DMG not found after all methods."

SIZE=$(du -sh "$FINAL_DMG" | cut -f1)
ok "══════════════════════════════════════════════"
ok "  VELOCITY CORE APEX v$VERSION"
ok "  DMG: $FINAL_DMG"
ok "  Size: $SIZE"
ok "══════════════════════════════════════════════"
echo ""
info "Next: bash scripts/codesign.sh && bash scripts/notarize.sh"
