#!/usr/bin/env bash

set -e

SESSION_NAME="phasehumans"

# Resolve project root from script location
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

RUNTIME_DIR="$PROJECT_ROOT/runtime"
SERVER_DIR="$PROJECT_ROOT/server"
WEB_DIR="$PROJECT_ROOT/web"

# Check required tools
if ! command -v tmux >/dev/null 2>&1; then
  echo "[ERROR] tmux is not installed."
  echo "Install it with:"
  echo "  sudo apt update && sudo apt install -y tmux"
  exit 1
fi

if ! command -v cargo >/dev/null 2>&1; then
  echo "[ERROR] cargo is not installed or not in PATH."
  exit 1
fi

if ! command -v bun >/dev/null 2>&1; then
  echo "[ERROR] bun is not installed or not in PATH."
  exit 1
fi

# Check directories
if [ ! -d "$RUNTIME_DIR" ]; then
  echo "[ERROR] Runtime directory not found: $RUNTIME_DIR"
  exit 1
fi

if [ ! -d "$SERVER_DIR" ]; then
  echo "[ERROR] Server directory not found: $SERVER_DIR"
  exit 1
fi

if [ ! -d "$WEB_DIR" ]; then
  echo "[ERROR] Web directory not found: $WEB_DIR"
  exit 1
fi

# Prevent duplicate session
if tmux has-session -t "$SESSION_NAME" 2>/dev/null; then
  echo "[INFO] tmux session '$SESSION_NAME' already exists."
  echo "[INFO] Attaching to existing session..."
  tmux attach -t "$SESSION_NAME"
  exit 0
fi

echo "[phasehumans] Starting runtime..."
tmux new-session -d -s "$SESSION_NAME" -n runtime
tmux send-keys -t "$SESSION_NAME:runtime" "cd \"$RUNTIME_DIR\" && echo '[runtime] starting...' && cargo run" C-m

sleep 2

echo "[phasehumans] Starting server..."
tmux new-window -t "$SESSION_NAME" -n server
tmux send-keys -t "$SESSION_NAME:server" "cd \"$SERVER_DIR\" && echo '[server] starting...' && bun run dev" C-m

echo "[phasehumans] Waiting 10 seconds before starting web..."
sleep 10

echo "[phasehumans] Starting web..."
tmux new-window -t "$SESSION_NAME" -n web
tmux send-keys -t "$SESSION_NAME:web" "cd \"$WEB_DIR\" && echo '[web] starting...' && bun run dev" C-m

tmux select-window -t "$SESSION_NAME:runtime"

echo "[phasehumans] All services started."
echo "[phasehumans] Attaching to tmux session..."

exec tmux attach -t "$SESSION_NAME"