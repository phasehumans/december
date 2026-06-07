# Skill: Local Environment Management

**Context:** The December stack requires a Node/Bun frontend, a Bun backend, a Rust runtime, and Docker infrastructure.

**How to start everything cleanly:**

1. Ensure Docker Desktop is running.
2. Start the local infrastructure (Postgres and MinIO containers):
   `./scripts/containers.sh start`
3. Launch the full stack using the built-in tmux script:
   `./scripts/start.sh`

**Manual Debugging (Starting services individually):**
- **Server:** `cd server && bun run dev` (Runs on port 3000)
- **Web:** `cd web && bun run dev` (Runs on port 5173)
- **Runtime:** `cd runtime && cargo run`
