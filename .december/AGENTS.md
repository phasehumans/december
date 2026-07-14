# December Codebase Analysis

## 1. What I think about the project

This project is highly ambitious and well-structured. Creating an agentic coding assistant with both a local CLI and a cloud-based Firecracker microVM runtime is a complex engineering challenge. The use of a monorepo (Bun + TurboRepo) with clear separation of concerns between `apps/` and `packages/` is a solid architectural choice. You are effectively building an open-source (or self-hosted) alternative to Devin, combining local utility with cloud scale.

## 2. What it actually is

**December** is a full-stack, agentic AI coding assistant. It features:

- A local terminal UI (CLI) built with Ink.
- A cloud environment composed of a React/Vite SPA (`web`), a Node backend (`server`), a job processing queue (`worker`), and a secure Rust-based Firecracker VMM (`runtime`).
- A shared, environment-agnostic core agent loop (`packages/agent`) and a tool system (`packages/tools`) that can execute locally or inside the cloud microVM.
- A "handoff" mechanism that allows users to zip their local workspace and upload it to the cloud to continue a session seamlessly.

## 3. What each module does

### Apps

- **`apps/cli`**: The local command-line interface. It runs the agent locally and can proxy LLM requests through the server (Wallet mode) or use local API keys (BYOK).
- **`apps/server`**: The Node.js backend API. It handles authentication, Wallet token billing, generating MinIO pre-signed URLs for handoffs, and manages Socket.io connections for the web frontend.
- **`apps/runtime`**: A Rust application that manages Firecracker microVMs. It exposes a gRPC API to provision VMs, execute commands securely inside an `ext4` rootfs, and stream outputs.
- **`apps/web`**: The Cloud frontend (Vite + React). It features a split-view layout for chatting with the agent and viewing a terminal/web preview.
- **`apps/worker`**: A BullMQ worker that listens for jobs (via Redis), invokes the agent in the cloud context, and publishes events (via Redis pub/sub) to the socket server.

### Packages

- **`packages/agent`**: The core AI logic. It uses an async generator `while` loop to emit events (`THINKING`, `TOOL_CALL`, etc.) independently of where it's running.
- **`packages/tools`**: Implementations of agent tools (FileSystem, Bash, Browser, GitHub, MCP) conforming to an abstract `Environment` interface.
- **`packages/database`**: Prisma schema and database clients (Postgres).
- **`packages/proto`**: Protobuf definitions for gRPC communication (e.g., between the worker/server and the Rust runtime).
- **`packages/shared`**: Shared utilities, event definitions, and types used across the monorepo.
- **`packages/tui`**: UI components for the CLI (Ink).

## 4. The Definitive Roadmap to Deployment (Cloud & CLI)

Following our extensive architectural alignment, here is the detailed phase-by-phase execution plan to achieve the Devin-like vision.

### Phase 1: Core Packages & CLI Solidification (Deep Dive)

- **1.1 Agent Model (Done):** The core agent in `packages/agent` is successfully set to use `Gemini 3.5 Flash` as the default model.
- **1.2 MCP Integration (Done):** The `MCPTool` exists as a stub. It must be updated to parse `mcp.json` exactly once at CLI boot time and pass the configuration into the agent loop.
- **1.3 CLI Distribution (Done):** The `bun build` script is correctly configured in `apps/cli/package.json` to bundle `@trydecember/cli`, `agent`, and `tools` into a single standalone binary.
- **1.4 CLI UX (Done):** We are retaining the powerful full-screen Ink TUI (`@december/tui`) for the optimal, immersive developer experience.
- **1.5 Authentication (Done):** The `december login` flow correctly triggers a browser redirect to fetch the token.
- **1.6 Handoff State Exclusion (Done):** The `december handoff` command currently hardcodes exclusions. It needs to automatically read the project's `.gitignore` and `.decemberignore` to dynamically build the `tar` exclusion list.
- **1.7 Agent Error Handling (Done):** Implement an exponential backoff retry mechanism (up to 3 times) within the core Agent loop to handle LLM API rate limits gracefully.
- **1.8 Wallet vs BYOK Priority (Done):** Update the CLI boot sequence to ensure that local `.env` keys (BYOK) _always_ take priority over the Wallet cloud proxy to save the user's balance.

### Phase 2: Server, Database & Billing

- **2.1 Database Schema:** Implement the `User -> Projects -> Sessions` hierarchy in Prisma.
- **2.2 Billing/Usage:** Implement usage tracking strictly based on LLM tokens consumed (via Server proxy endpoints).
- **2.3 Project Deletion:** Implement cascade deletion of DB records and a background job to permanently wipe MinIO data and destroy active VMs.
- **2.4 API Protection:** Add Express rate limiter middleware (e.g., 100 req/min) with strict constraints on the LLM proxy.
- **2.5 WebSockets Scaling:** Implement the Redis Pub/Sub adapter for Socket.io to allow horizontal scaling of the Node server.

### Phase 3: Cloud Infrastructure & VM Hydration (Handoffs)

- **3.1 Deployment Target:** Target bare-metal providers (e.g., Hetzner, OVH) for hosting the `Runtime` to support Firecracker natively, avoiding AWS EC2 limitations.
- **3.2 VM Configuration:** Standardize on a 10GB `ext4` rootfs block device running an Ubuntu/Debian base.
- **3.3 Handoff Payload:** Update the CLI handoff to exclude `node_modules`, `.git`, `dist`, etc., to speed up zipping. Ensure the CLI prompts for a retry if the MinIO upload fails.
- **3.4 Handoff Conflicts:** Reject handoffs from the CLI if the cloud session is already active.
- **3.5 Workspace Persistence:** On session idle, trigger the Worker to zip the VM workspace, upload to MinIO, and destroy the VM. On resume, download and extract.
- **3.6 Secrets Management:** Build a "Secrets" vault in the Web UI. The Worker injects these via gRPC into the VM environment at boot time.

### Phase 4: Worker <-> Runtime Orchestration (The Brain)

- **4.1 Execution Context:** Compile the Agent into a binary and inject it into the VM to run entirely inside the Firecracker sandbox (eliminating gRPC latency for filesystem operations).
- **4.2 Streaming Events:** The Agent running inside the VM streams events via gRPC to the Worker. The Worker parses these and publishes them to Redis Pub/Sub.
- **4.3 Background Tasks:** Update the Bash tool to accept a `background: true` flag, immediately returning a `Task ID` while streaming output asynchronously.
- **4.4 Agent Interruption:** Implement a "Stop" button in the Web UI that sends an event through Redis -> Worker -> gRPC `SIGINT` to the VM, allowing the agent to gracefully stop.
- **4.5 Dynamic Dependencies:** Ensure the Agent uses `apt-get` to install missing toolchains (e.g., Python) dynamically instead of pre-baking everything into a bloated image.
- **4.6 Agent Re-evaluation:** If the user sends a message while the agent is busy, allow the current step to finish, inject the message into the context, and force a re-evaluation of the plan.
- **4.7 Context Management:** Implement logic in the Agent to automatically truncate old terminal outputs and summarize past chat history to stay under the token limit.

### Phase 5: Security & Abuse Prevention

- **5.1 Network Sandboxing:** Apply strict `iptables`/`nftables` rules on the host to block the VM from accessing internal private IPs (e.g., `10.0.0.0/8`, `169.254.169.254`) while allowing public internet.
- **5.2 Network Rate Limiting:** Use Linux `tc` (traffic control) to throttle outbound VM network speed to ~100Mbps.
- **5.3 Compute Abuse:** Instead of killing crypto-miners, allow them but strictly bill the user for compute time at a marked-up rate.

### Phase 6: Web UI (The Devin Experience)

_(Note: See section 7 for the deep-dive redesign)_

- **6.1 Terminal Rendering:** Use `xterm.js` to pipe ANSI-formatted `TERMINAL_DATA` events directly into a real terminal emulator in the browser.
- **6.2 Live Code Preview:** Run a reverse proxy/tunnel inside the VM to expose localhost securely, and embed it as an `iframe` in the Web UI. No fake UI artifacts.
- **6.3 File Tree:** Run a lightweight sidecar HTTP server inside the VM exposing a `/tree` endpoint. The Web UI polls this or updates on `FILE_MODIFIED` events.
- **6.4 File Editor:** Show file edits as diffs in the chat, or integrate Monaco Editor.
- **6.5 Chat History:** Implement infinite scrolling for large sessions.
- **6.6 Agent Thoughts:** Display the agent's internal `<thought>` blocks collapsed by default.
- **6.7 Collaboration:** Support multi-user real-time viewing via WebSocket rooms.

### Phase 7: Testing & Self-Hosting Deployment

- **7.1 E2E Testing Framework:** Playwright for Web UI E2E. Rust `cargo test` for VMM internals. Bash-based integration suite for testing the full Worker <-> VM gRPC pipeline.
- **7.2 Package Isolation:** Ensure `apps/runtime` (Rust) remains completely isolated from Bun/Node dependencies.
- **7.3 Self-Hosting Compose:** Provide a `docker-compose.yml` for the Server, Redis, Postgres, Web, and Worker. Ensure `Runtime` runs natively on Linux host with KVM.
- **7.4 Health Checks:** Provide a `bun scripts/verify.sh` to spin up a test VM, run an agent prompt, and destroy it.

## 7. Deep-Dive: The Devin-Style Web UI Architecture

Based on our specific UI/UX alignment, the Web app will be split into two primary panels to keep the interface highly focused and uncluttered:

### 7.1 Left Panel (The Chat & Intel Hub)

- **Extreme Clutter Reduction:** Do **not** show raw tool executions (like file reads/writes) in the chat feed.
- **What is Shown:** The chat will exclusively contain:
    1. **User Messages:** The prompts you type.
    2. **Agent Thoughts:** The `<thought>` blocks (collapsed by default).
    3. **Agent Summaries:** Triggered by a specific `respond_to_user` tool, providing a clean wrap-up message and pausing the loop until you reply.
- **Layout:** This keeps the left panel incredibly clean, reading like a high-level conversation with a human engineer rather than a log dump.

### 7.2 Right Panel (The Workstation Tabs)

This panel contains multiple sub-tabs representing the agent's actual workspace, perfectly mirroring Devin:

- **1. Activity Log Tab:** A dedicated feed just for tool executions. If you want to see exactly which files the agent is reading/writing or commands it's running, it's all logged here, safely out of the main chat.
- **2. Browser Tab (The Live Viewer):** To replicate Devin's browser capability, the agent will use Playwright inside the Firecracker VM. A VNC-to-WebSocket bridge (like `noVNC`) will run inside the VM, streaming the actual headless browser to a `<canvas>` element in the Web UI. You will literally watch the agent browse.
- **3. IDE / Code Tab:** Powered by Monaco Editor. It features a file tree on the left. Crucially, when the agent modifies a file, this tab automatically switches to the active file and highlights the diff in real-time. It remains read-only to prevent concurrency conflicts while the agent is running.
- **4. Shell / Terminal Tab:** The UI will support multiple terminal sessions (sub-tabs) powered by `xterm.js`. The agent's bash tool will return a `Terminal ID` to route standard out/error to the correct terminal (e.g., Terminal 1 for a Next.js server, Terminal 2 for `npm install` logs).
- **5. Preview Tab:** Similar to Devin, this tab embeds an `iframe` pointing to a reverse proxy (or tunnel) exposing the VM's active localhost (e.g., port 3000) so you can interact with the app the agent is building live.
