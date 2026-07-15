# December Codebase Architecture & Detailed 6-Week Roadmap

## 1. Vision & Identity

**December** is a full-stack, agentic AI coding assistant designed to operate as a self-hosted or cloud-scalable alternative to Devin. It allows developers to interact with an autonomous AI software engineer either locally via a terminal UI (CLI) or through a collaborative cloud web interface.

The core philosophy of December is **"Write once, run anywhere."** The core AI reasoning loop (`packages/agent`) is entirely decoupled from the environment it runs in. It executes identically whether it's running locally on a user's MacBook (via CLI) or securely inside an ephemeral Firecracker microVM in the cloud (via the Sidecar).

---

## 2. Monorepo Structure: Apps & Packages

### Apps

- **`apps/cli`**: The local command-line application (built with Ink). It runs the agent loop locally on the user's machine, executing bash/file tools directly on the host OS.
- **`apps/server`**: The Node.js backend API. Manages users, authentication, projects, billing, WebSocket connections, and queues up Agent jobs.
- **`apps/worker`**: A background Node.js process (using BullMQ) that pulls jobs from Redis. Its primary job is to orchestrate cloud sessions, spin up VMs via the Runtime, and manage async event streams.
- **`apps/runtime`**: A Rust application running on bare-metal servers. It manages the lifecycle of Firecracker microVMs and acts as a secure `vsock` relay between the VM and the Worker.
- **`apps/web`**: The Cloud frontend (Vite + React) offering a Devin-like workstation experience (Chat, Terminal, Code editor, Browser preview).
- **`apps/sidecar`**: A lightweight wrapper built around `packages/agent`, compiled into a standalone Linux binary using `bun build --compile`. It gets injected directly into the Firecracker VM by the Worker, runs the AI reasoning loop natively inside the sandbox, and streams telemetry back out.

### Packages

- **`packages/agent`**: The core AI logic, holding the context manager, loop generator, and prompt handling. Agnostic to where it runs.
- **`packages/tools`**: Implementations of various tools (Bash, FS, Browser, MCP).
- **`packages/providers`**: Integrations with various LLMs (Anthropic, Gemini, OpenAI, DeepSeek, etc.).
- **`packages/shared`**: Shared TypeScript types, utility functions, and Event definitions used across all apps.
- **`packages/database`**: Prisma schema and clients.
- **`packages/tui`**: UI components for the local CLI.

---

## 3. Cloud Architecture: The Injected Sidecar Model

To achieve maximum speed, ultimate security, and horizontal scalability, December utilizes the **"Injected Sidecar" Model (True Sandbox)** for cloud deployment.

### How it works:

1.  **The Binary Payload:** The AI Agent logic (`packages/agent`) is compiled into a standalone Linux binary (`apps/sidecar`). This keeps the Firecracker VM image completely generic (no Node/Bun pre-installation required).
2.  **The Injection & Handshake:** `apps/worker` provisions the VM and pushes the Sidecar binary into it. When the Sidecar boots, it connects to a `vsock` endpoint. The Rust Runtime securely transmits the initial configuration (prompt, context, encrypted secrets) directly into the agent's memory. No secrets touch the disk.
3.  **Zero Latency Execution:** Because the Agent lives on the same filesystem as the project, it executes bash tools instantly. It spawns long-running background servers (`npm run dev`) and monitors them directly without gRPC network latency.
4.  **The Communication Bridge (`vsock`):** The Sidecar streams its data out over Firecracker's Virtual Sockets (`vsock`). The Rust Runtime securely relays this `vsock` stream over gRPC to the Node Worker, keeping the VM 100% network-isolated from internal cloud infrastructure.
5.  **Event-Driven Sync & Billing:** The Sidecar acts purely as a dumb event emitter. It streams structured JSON events (e.g., `{ type: "USAGE", tokens: 150 }`) over `vsock`. The Node Worker consumes these events, updates Postgres, deducts credits, and broadcasts to WebSockets. If credits hit zero, the Worker instantly sends a `KillVM` signal.

---

## 4. Detailed 6-Week Execution Plan & Granular TODOs

### Phase 1 (Week 1): Core Agent & Tool Robustness

_Make the foundational logic bulletproof for both CLI and Cloud execution._

- [ ] Implement strict JSON-mode parsing for tool calls to prevent hallucinated text outside tool blocks.

### Phase 2 (Week 2): CLI Perfection & UX

_Fix lag and user experience issues in the local terminal UI._

- [ ] **2.1 CLI UX & Streaming**
    - [ ] Debug and fix the streaming pipeline from `packages/agent` to `packages/tui`.
    - [ ] Ensure text chunks are flushed to stdout in real-time, eliminating "bursty" lag.
    - [ ] Update Ink TUI components to cleanly render nested `<thought>` blocks (collapsible if possible, or dimmed).
    - [ ] Improve syntax highlighting for code blocks within the CLI chat feed.
- [ ] **2.2 Context Compaction**
    - [ ] Implement `ConversationManager` to actively track token usage per session.
    - [ ] Build a summarization prompt that compresses the oldest N messages into a single summary block.
    - [ ] Test context compaction on a simulated 100-turn conversation to ensure no crucial data is lost.
- [ ] **2.3 Testing & Stability**
    - [ ] Write Unit Tests for `packages/agent` loop generator.
    - [ ] Write Unit Tests for context compaction logic.
    - [ ] Ensure `mcp.json` parsing strictly injects MCP tools into the agent on CLI boot.

### Phase 3 (Week 3): Server, DB & Real-time Sync

_Solidify the backend API, state management, and communication layers._

- [ ] **3.1 Database & State Management**
    - [ ] Refactor `Session` and `Project` schemas in Prisma (Add fields for `vmStatus`, `minioPrefix`).
    - [ ] Implement `vmStatus` enums (`PROVISIONING`, `RUNNING`, `STOPPED`, `FAILED`).
    - [ ] Build row-level locking (`SELECT ... FOR UPDATE`) in Postgres for atomic wallet credit deductions.
- [ ] **3.2 Unify Transport Layer (Socket.io)**
    - [ ] Remove `generate.controller.ts` SSE endpoints completely.
    - [ ] Configure `Socket.io` on the Node server with `@socket.io/redis-adapter` for horizontal scaling.
    - [ ] Implement WebSocket authentication (JWT handshake) for secure connections.
    - [ ] Route all `THINKING`, `TOOL_CALL`, and `TERMINAL_DATA` events through specific socket rooms.
- [ ] **3.3 Core API Features**
    - [ ] Implement Express rate limiting (e.g., 100 req/min) based on `userId`.
    - [ ] Create the GitHub Repo Import API: Fetch repo URL, download tarball, and push to MinIO bucket.

### Phase 4 (Week 4): Orchestration (Worker & Sidecar)

_Finalize the Injected Sidecar architecture and remove blocking queues._

- [ ] **4.1 Sidecar Build & Injection**
    - [ ] Create `apps/sidecar` workspace and configure `bun build --compile`.
    - [ ] Write the Sidecar startup script to automatically bind to `/tmp/vsock`.
    - [ ] Implement the initialization handshake: Wait for `config` payload (prompt, secrets) from vsock.
- [ ] **4.2 Worker Refactor (Async State Machine)**
    - [ ] Update BullMQ job processor: Boot VM, inject Sidecar, update DB status, and _exit_ the job immediately.
    - [ ] Create a persistent Node.js background listener that consumes incoming `vsock` streams from the Rust Runtime.
    - [ ] Route vsock usage events to the billing service; route chat events to the Redis Pub/Sub channels.
- [ ] **4.3 Security & Cleanup**
    - [ ] Write bash scripts to apply `iptables` DROP rules for internal IPs (10.x, 192.x) on the host `tap` interfaces.
    - [ ] Apply `tc` (traffic control) scripts to throttle outbound VM bandwidth to 100Mbps.
    - [ ] Implement the Idle Timer in the Worker: Track last activity timestamp. After 15 mins, send SIGTERM, trigger MinIO backup, and destroy VM.

### Phase 5 (Week 5 & 6): The Devin-like Web UI

_Build the immersive, split-pane cloud workstation in React/Vite._

- [ ] **5.1 UI Layout & Clutter Reduction**
    - [ ] Build the left-pane Chat component. Filter out all raw tool execution logs.
    - [ ] Render Agent Summaries distinctly. Add accordion elements for `<thought>` blocks.
- [ ] **5.2 Workstation Tabs (Right Pane)**
    - [ ] **Activity Log Tab:** Create a raw streaming view of all system logs and tool inputs/outputs.
    - [ ] **Code Editor Tab:** Embed `@monaco-editor/react`. Hook up a Sidecar file watcher to emit `FILE_MODIFIED` events and render live diffs.
    - [ ] **Terminal Tab:** Embed `xterm.js`. Create logic to spawn a new sub-tab dynamically when the agent receives a new `Task ID` for a background process.
    - [ ] **Browser Preview Tab:** Configure the VM reverse proxy (e.g., exposing port 3000 to a public ngrok/localtunnel URL) and embed it via an `iframe`.
- [ ] **5.3 Live Browser Tab (Playwright integration)**
    - [ ] Embed `noVNC` client in a new Workstation Tab.
    - [ ] Configure the Sidecar's Browser tool to launch Playwright with a VNC server wrapper, streaming directly to the web UI.
