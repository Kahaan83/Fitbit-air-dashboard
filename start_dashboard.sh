#!/usr/bin/env bash
# =====================================================================
#                Fitbit Air Physiological Dashboard
#              macOS / Linux One-Click Startup Script
# =====================================================================
set -euo pipefail

BACKEND_PID=""

# ── Cleanup: kill background backend on Ctrl+C ────────────────────────
cleanup() {
  echo ""
  echo "Shutting down..."
  if [ -n "$BACKEND_PID" ] && kill -0 "$BACKEND_PID" 2>/dev/null; then
    echo "Stopping backend (PID $BACKEND_PID)..."
    kill "$BACKEND_PID"
  fi
  exit 0
}
trap cleanup SIGINT SIGTERM

# ── 1. Check python3 ──────────────────────────────────────────────────
if ! command -v python3 &>/dev/null; then
  echo "[ERROR] python3 is not installed or not in your PATH."
  echo "        Install Python 3.11+ from https://python.org and ensure it is on PATH."
  exit 1
fi
echo "[OK] python3 found: $(python3 --version)"

# ── 2. Check node and npm ─────────────────────────────────────────────
if ! command -v node &>/dev/null; then
  echo "[ERROR] Node.js is not installed or not in your PATH."
  echo "        Install Node.js 18 LTS from https://nodejs.org."
  exit 1
fi
if ! command -v npm &>/dev/null; then
  echo "[ERROR] npm is not installed or not in your PATH."
  echo "        Install Node.js 18 LTS (includes npm) from https://nodejs.org."
  exit 1
fi
echo "[OK] node $(node --version) / npm $(npm --version) found."

# ── 3. Create venv if needed ──────────────────────────────────────────
VENV_DIR="google-health-service/venv"
if [ ! -d "$VENV_DIR" ]; then
  echo "[1/3] Creating Python virtual environment in $VENV_DIR..."
  python3 -m venv "$VENV_DIR"
  echo "[OK] Virtual environment created."
else
  echo "[1/3] Virtual environment already exists — skipping creation."
fi

# ── 4. Install backend dependencies ──────────────────────────────────
echo "[2/3] Installing backend dependencies..."
# shellcheck source=/dev/null
source "$VENV_DIR/bin/activate"
pip install -r google-health-service/requirements.txt -q
echo "[OK] Backend dependencies satisfied."

# ── 5. Install frontend dependencies if needed ────────────────────────
echo "[3/3] Checking frontend dependencies..."
if [ ! -d "health-dashboard/node_modules" ]; then
  echo "      Installing Next.js dependencies (this may take a minute)..."
  npm install --prefix health-dashboard --silent
  echo "[OK] Frontend dependencies installed."
else
  echo "[OK] node_modules already present — skipping npm install."
fi

# ── 6. Launch FastAPI backend in background ───────────────────────────
echo ""
echo "Starting Google Health API Gateway (FastAPI) on port 8000..."
(
  cd google-health-service
  source venv/bin/activate
  uvicorn main:app --port 8000
) &
BACKEND_PID=$!
echo "[OK] Backend launched (PID $BACKEND_PID)."

# Give the backend a moment to start up
sleep 1

# ── 7. Open browser ───────────────────────────────────────────────────
echo "Opening http://localhost:3000 in your browser..."
OS="$(uname -s)"
case "$OS" in
  Darwin*)  open "http://localhost:3000" ;;
  Linux*)   xdg-open "http://localhost:3000" 2>/dev/null || true ;;
  *)        echo "      (Cannot auto-open browser on $OS — visit http://localhost:3000 manually)" ;;
esac

# ── 8. Launch Next.js frontend in foreground ──────────────────────────
echo ""
echo "Starting Next.js frontend on port 3000..."
echo "Press Ctrl+C to stop both servers."
echo ""
cd health-dashboard
npm run dev
