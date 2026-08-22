#!/usr/bin/env bash
set -e
# Path to the built DMG
DMG=$(find target/release/bundle -name "*.dmg" | head -n1)
if [[ -z "$DMG" ]]; then
  echo "No DMG found in src-tauri/target/release/bundle/dmg/"
  exit 1
fi

echo "Testing DMG: $DMG"
# Mount the DMG
MOUNT_POINT="/tmp/velocitycore_test"
mkdir -p "$MOUNT_POINT"
hdiutil attach "$DMG" -mountpoint "$MOUNT_POINT" -quiet
# Open the app (background)
APP_PATH="$MOUNT_POINT/Velocity Core.app"
if [[ -d "$APP_PATH" ]]; then
  open "$APP_PATH" &
  echo "Launched Velocity Core app..."
else
  echo "App not found inside DMG"
  hdiutil detach "$MOUNT_POINT" -quiet
  exit 1
fi
# Wait a few seconds for the app to start
sleep 5
# Kill the app if still running
pkill -f "Velocity Core" || true
# Unmount the DMG
hdiutil detach "$MOUNT_POINT" -quiet

echo "DMG test completed successfully"
