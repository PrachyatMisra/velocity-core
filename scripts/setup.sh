#!/usr/bin/env bash
# VELOCITY CORE — One-Command Setup Script
# Installs all prerequisites for building on macOS
set -euo pipefail
RED='\033[0;31m'; GREEN='\033[0;32m'; CYAN='\033[0;36m'; DIM='\033[2m'; NC='\033[0m'

info()    { echo -e "${CYAN}▲ $*${NC}"; }
success() { echo -e "${GREEN}  ✓ $*${NC}"; }
warn()    { echo -e "${RED}  ⚠ $*${NC}"; }

info "VELOCITY CORE — Setup"
echo ""

# Xcode CLT
if ! xcode-select -p &>/dev/null; then
    info "Installing Xcode Command Line Tools..."
    xcode-select --install
    echo "  Wait for the installer to complete, then re-run this script."
    exit 0
fi
success "Xcode CLT: $(xcode-select -p)"

# Homebrew
if ! command -v brew &>/dev/null; then
    info "Installing Homebrew..."
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    eval "$(/opt/homebrew/bin/brew shellenv)" 2>/dev/null || eval "$(/usr/local/bin/brew shellenv)" 2>/dev/null
fi
success "Homebrew: $(brew --version | head -1)"

# Rust
if ! command -v rustc &>/dev/null; then
    info "Installing Rust toolchain..."
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --quiet
    source "$HOME/.cargo/env"
fi
rustup target add aarch64-apple-darwin x86_64-apple-darwin 2>/dev/null || true
success "Rust: $(rustc --version)"

# Node.js
if ! command -v node &>/dev/null || [[ $(node -v | tr -d 'v' | cut -d. -f1) -lt 20 ]]; then
    info "Installing Node.js 20+..."
    brew install node
fi
success "Node: $(node --version)"

# Python
if ! command -v python3 &>/dev/null || ! python3 -c 'import sys; raise SystemExit(0 if sys.version_info >= (3, 11) else 1)' 2>/dev/null; then
    info "Installing Python 3.11..."
    brew install python@3.11
fi
success "Python: $(python3 --version)"

# PyInstaller
if ! python3 -c "import PyInstaller" 2>/dev/null; then
    info "Installing PyInstaller..."
    pip3 install --quiet pyinstaller --break-system-packages 2>/dev/null || pip3 install --quiet pyinstaller
fi
success "PyInstaller: $(pyinstaller --version)"

# Tauri CLI
if ! cargo tauri --version &>/dev/null; then
    info "Installing Tauri CLI (this takes a few minutes)..."
    cargo install tauri-cli --version "^2.0" --quiet
fi
success "Tauri CLI: $(cargo tauri --version)"

# create-dmg (optional)
if ! command -v create-dmg &>/dev/null; then
    info "Installing create-dmg..."
    brew install create-dmg
fi
success "create-dmg: $(create-dmg --version 2>/dev/null || echo 'installed')"

echo ""
echo -e "${GREEN}✅ All prerequisites installed!${NC}"
echo ""
echo -e "${DIM}Next steps:${NC}"
echo -e "  ${CYAN}npm install${NC}              — Install JS dependencies"
echo -e "  ${CYAN}npm run sidecar${NC}          — Build Python AI sidecar (~5 min first time)"
echo -e "  ${CYAN}npm run tauri:dev${NC}        — Launch development mode"
echo -e "  ${CYAN}npm run tauri:build${NC}      — Production build"
echo -e "  ${CYAN}npm run dmg${NC}              — Create distributable DMG"
