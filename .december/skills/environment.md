# Skill: Environment Orchestration

December requires coordinating multiple services. Use the built-in scripts to manage the full stack cleanly.

## The One-Command Start
Run `./scripts/start.sh` from the root. This script uses `tmux` to split your terminal and run:
- Local Postgres and MinIO containers.
- The Bun API Server (`cd server && bun run dev`).
- The Vite Web Client (`cd web && bun run dev`).
- The Rust Execution Runtime (`cd runtime && cargo run`).

## Teardown
If the runtime gets stuck or port 3000/5173 is in use, kill the tmux session using `tmux kill-server`. If Docker preview containers get orphaned, run `bun run docker:kill` from the root.
