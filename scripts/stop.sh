#!/usr/bin/env bash

SESSION_NAME="phasehumans"

if tmux has-session -t "$SESSION_NAME" 2>/dev/null; then
  tmux kill-session -t "$SESSION_NAME"
  echo "[phasehumans] Stopped tmux session '$SESSION_NAME'."
else
  echo "[phasehumans] No running session named '$SESSION_NAME'."
fi