#!/usr/bin/env bash
set -euo pipefail
# VELOCITY CORE APEX — One-command full build pipeline
# Usage: bash scripts/build_all.sh [--release] [--dmg] [--sign IDENTITY]

RED='\033[0;31m'; GREEN='\033[0;32m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'
info() { echo -e "${CYAN}[BUILD]${NC} $*"; }
ok()   { echo -e "${GREEN}[OK]${NC} $*"; }
warn() { echo -e "\033[1;33m[WARN]\033[0m $*"; }
die()  { echo -e "${RED}[FAIL]${NC} $*"; exit 1; }

RELEASE=false; DMG=false; SIGN_IDENTITY="-"
while [[ $# -gt 0 ]]; do
    case "$1" in
        --release) RELEASE=true; shift ;;
        --dmg) DMG=true; RELEASE=true; shift ;;
        --sign) SIGN_IDENTITY="$2"; shift 2 ;;
        *) die "Unknown flag: $1" ;;
    esac
done

echo -e "${BOLD}"
echo "  ██╗   ██╗███████╗██╗      ██████╗  ██████╗██╗████████╗██╗   ██╗"
echo "  ██║   ██║██╔════╝██║     ██╔═══██╗██╔════╝██║╚══██╔══╝╚██╗ ██╔╝"
echo "  ██║   ██║█████╗  ██║     ██║   ██║██║     ██║   ██║    ╚████╔╝ "
echo "  ╚██╗ ██╔╝██╔══╝  ██║     ██║   ██║██║     ██║   ██║     ╚██╔╝  "
echo "   ╚████╔╝ ███████╗███████╗╚██████╔╝╚██████╗██║   ██║      ██║   "
echo "    ╚═══╝  ╚══════╝╚══════╝ ╚═════╝  ╚═════╝╚═╝   ╚═╝      ╚═╝  "
echo "  CORE APEX v3.0 — Build Pipeline"
echo -e "${NC}"

# Step 1: Prerequisites check
info "Checking prerequisites..."
command -v node >/dev/null || die "Node.js not found. Run: bash scripts/setup.sh"
command -v cargo >/dev/null || die "Rust not found. Run: bash scripts/setup.sh"
command -v python3 >/dev/null || die "Python 3 not found."
command -v npm >/dev/null || die "npm not found."
ok "Prerequisites OK"

# Step 2: Build Python sidecar
info "Building Python AI sidecar..."
bash scripts/build_sidecar.sh
ok "Sidecar built"

# Step 3: Install JS deps
info "Installing Node.js dependencies..."
if [[ -f package-lock.json ]]; then
    npm ci --silent
else
    npm install --silent
fi
ok "npm deps installed"

# Step 4: TypeScript check
info "TypeScript validation..."
npx tsc --noEmit && ok "TypeScript OK" || die "TypeScript errors. Fix before building."

# Step 5: Build
if $RELEASE; then
    info "Building release bundle..."
    npm run tauri:build
    ok "Release build complete"
else
    info "Build ready. Run: npm run tauri:dev"
    exit 0
fi

# Step 6: Code sign
if $DMG; then
    command -v hdiutil >/dev/null || die "hdiutil is required on macOS for DMG creation."
    info "Code signing..."
    CODESIGN_IDENTITY="$SIGN_IDENTITY" bash scripts/codesign.sh || warn "Code signing skipped (no identity)"
    
    info "Creating DMG..."
    bash scripts/create_dmg.sh --skip-build
    ok "DMG ready in dist/"
fi

echo ""
ok "══════════════════════════════════════════"
ok "  VELOCITY CORE APEX — BUILD COMPLETE ✓"
ok "══════════════════════════════════════════"
