#!/usr/bin/env bash

SESSION_NAME="december"

if tmux has-session -t "$SESSION_NAME" 2>/dev/null; then
  tmux kill-session -t "$SESSION_NAME"
  echo "[december] Stopped tmux session '$SESSION_NAME'."
else
  echo "[december] No running session named '$SESSION_NAME'."
fi