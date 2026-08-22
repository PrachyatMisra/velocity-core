#!/usr/bin/env bash
# VELOCITY CORE — Build AI Sidecar binary via PyInstaller
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SIDECAR="$ROOT/sidecar"
OUT="$ROOT/src-tauri/binaries"

echo "▲ Building AI Sidecar (vcx)..."

for cmd in python3 pip3; do
    command -v "$cmd" &>/dev/null || { echo "✗ $cmd not found. Run: npm run setup"; exit 1; }
done

VENV="$SIDECAR/.venv"
[[ -d "$VENV" ]] || python3 -m venv "$VENV"
source "$VENV/bin/activate"
pip install --quiet --upgrade pip
pip install --quiet -r "$SIDECAR/requirements.txt"
pip install --quiet pyinstaller

mkdir -p "$OUT"
cd "$SIDECAR"

pyinstaller vcx_main.py \
    --name vcx \
    --onefile \
    --console \
    --hidden-import torch \
    --hidden-import sklearn \
    --hidden-import sklearn.ensemble._iforest \
    --hidden-import sklearn.utils._weight_vector \
    --hidden-import numpy \
    --hidden-import orjson \
    --hidden-import psutil \
    --distpath "$OUT" \
    --noconfirm \
    --clean \
    >"$SIDECAR/.pyinstaller.log" 2>&1 || {
      echo "✗ PyInstaller failed. Last log lines:"
      tail -40 "$SIDECAR/.pyinstaller.log" || true
      exit 1
    }

grep -E "(Building|INFO|ERROR|WARNING|vcx)" "$SIDECAR/.pyinstaller.log" | tail -15 || true

ARCH=$(uname -m)
TARGET=$([[ "$ARCH" == "arm64" ]] && echo "aarch64-apple-darwin" || echo "x86_64-apple-darwin")

if [[ -f "$OUT/vcx" ]]; then
    cp "$OUT/vcx" "$OUT/vcx-$TARGET"
    chmod +x "$OUT/vcx-$TARGET"
    echo "  ✓ $OUT/vcx-$TARGET ($(du -sh "$OUT/vcx-$TARGET" | cut -f1))"
else
    echo "✗ Build failed — no binary produced"
    exit 1
fi

deactivate
rm -rf "$SIDECAR/build" "$SIDECAR/vcx.spec" "$SIDECAR/__pycache__"
echo "  ✅ Sidecar ready"
