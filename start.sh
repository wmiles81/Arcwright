#!/usr/bin/env bash
# Arcwright launcher — Linux
# Run this script to install dependencies (first run only) and start the app.

set -e
cd "$(dirname "$0")"

echo "── Arcwright ───────────────────────────────────────────────────"
echo "Working directory: $(pwd)"
echo

# ── Node.js check ──
if ! command -v node >/dev/null 2>&1; then
  echo "ERROR: Node.js is not installed."
  echo "Install Node.js v18 or later (e.g. via your package manager or https://nodejs.org),"
  echo "then run this script again."
  exit 1
fi

NODE_MAJOR=$(node -v | sed 's/v//' | cut -d. -f1)
if [ "$NODE_MAJOR" -lt 18 ]; then
  echo "ERROR: Arcwright requires Node.js v18 or later."
  echo "You have: $(node -v)"
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
if command -v xdg-open >/dev/null 2>&1; then
  ( sleep 2 && xdg-open http://localhost:3000 >/dev/null 2>&1 ) &
fi

exec npm start
