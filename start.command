#!/usr/bin/env bash
# Arcwright launcher — macOS
# Double-click to install dependencies (first run only) and start the app.

set -e
cd "$(dirname "$0")"

# Bring this Terminal window to the front so the user sees progress.
osascript -e 'tell application "Terminal" to activate' >/dev/null 2>&1 || true

echo "── Arcwright ───────────────────────────────────────────────────"
echo "Working directory: $(pwd)"
echo

# ── Node.js check ──
if ! command -v node >/dev/null 2>&1; then
  echo "ERROR: Node.js is not installed."
  echo "Install Node.js v18 or later from https://nodejs.org"
  echo "Then double-click this file again."
  echo
  read -p "Press Return to close..." _
  exit 1
fi

NODE_MAJOR=$(node -v | sed 's/v//' | cut -d. -f1)
if [ "$NODE_MAJOR" -lt 18 ]; then
  echo "ERROR: Arcwright requires Node.js v18 or later."
  echo "You have: $(node -v)"
  echo "Update from https://nodejs.org"
  echo
  read -p "Press Return to close..." _
  exit 1
fi

echo "Node.js: $(node -v) ✓"

# ── Install deps if needed ──
if [ ! -d node_modules ]; then
  echo
  echo "First-time setup — installing dependencies."
  echo "This will take 1–2 minutes and uses about 500 MB of disk space."
  echo
  npm install --production
  echo
  echo "Setup complete."
fi

echo
echo "Starting Arcwright on http://localhost:3000"
echo "── KEEP THIS TERMINAL WINDOW OPEN while using the app ──────────"
echo

# Open the browser once the server has had a moment to bind.
( sleep 2 && open http://localhost:3000 ) &

# Run in foreground so the user can Ctrl+C to stop.
exec npm start
