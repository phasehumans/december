# December Codebase Architecture & 6-Week Roadmap

## 1. What is December?

**December** is a full-stack, agentic AI coding assistant designed to operate as a self-hosted or cloud-scalable alternative to Devin. It allows developers to interact with an autonomous AI software engineer either locally via a terminal UI (CLI) or through a collaborative cloud web interface.

The core philosophy of December is "Write once, run anywhere." The core AI reasoning loop (`packages/agent`) is entirely decoupled from the environment it runs in. It can execute locally on a user's MacBook (via CLI) or securely inside an ephemeral Firecracker microVM in the cloud (via Worker & Runtime).

## 2. Monorepo Structure: Apps & Packages

### Apps

- **`apps/cli`**: The local command-line application (built with Ink). It runs the agent loop locally on the user's machine, executing bash/file tools directly on the host OS.
- **`apps/server`**: The Node.js backend API. Manages users, authentication, projects, billing, WebSocket connections, and queues up Agent jobs.
- **`apps/worker`**: A background Node.js process (using BullMQ) that pulls jobs from Redis. Its primary job is to orchestrate cloud sessions, spin up VMs via the Runtime, and bridge the AI agent to the secure environment.
- **`apps/runtime`**: A Rust application running on bare-metal servers. It manages the lifecycle of Firecracker microVMs and exposes a gRPC interface to execute commands securely inside those VMs.
- **`apps/web`**: The Cloud frontend (Vite + React) offering a Devin-like workstation experience (Chat, Terminal, Code editor, Browser preview).
- **`apps/sidecar`**: A lightweight wrapper built around `packages/agent`, compiled into a standalone Linux binary using Bun. It gets injected directly into the Firecracker VM by the Worker, runs the AI reasoning loop natively inside the sandbox, and streams telemetry/tool events back out via `vsock`.

### Packages

- **`packages/agent`**: The core AI logic, holding the context manager, loop generator, and prompt handling. Agnostic to where it runs.
- **`packages/tools`**: Implementations of various tools (Bash, FS, Browser, MCP).
- **`packages/providers`**: Integrations with various LLMs (Anthropic, Gemini, OpenAI, etc.).
- **`packages/shared`**: Shared TypeScript types, utility functions, and Event definitions used across all apps.
- **`packages/database`**: Prisma schema and clients.
- **`packages/tui`**: UI components for the local CLI.

## 3. Architecture & Data Flow

### The Cloud Flow

1. **Request:** User sends a prompt via `apps/web`. The `apps/server` authenticates the request, checks billing, and pushes a Job to Redis.
2. **Boot:** `apps/worker` picks up the Job. It requests `apps/runtime` (via gRPC) to boot a new Firecracker VM for the session.
3. **Execution:** The AI Agent loop starts. (Where exactly it runs—in the worker vs in the VM—is currently under architectural review; see open questions below).
4. **Tool Bridging:** When the Agent calls a tool (e.g., `execute_bash`), the command is securely forwarded to the VM.
5. **Streaming:** Outputs, thought processes, and terminal data are streamed back via Redis Pub/Sub to the `apps/server`, which forwards them to the user via WebSockets.

---

## 4. The 6-Week Execution Plan

### Week 1: Core Agent & Tool Robustness

- **Goal:** Make the foundational `packages/agent`, `packages/tools`, and `packages/providers` bulletproof for both CLI and Cloud.
- **Tasks:**
    - Test and stabilize all LLM providers (Anthropic, Gemini, DeepSeek, etc.).
    - Refactor tools to ensure they work seamlessly via local OS execution and remote VM execution.
    - Improve agent prompts to reduce hallucination and encourage strict tool usage (referencing PI agent strategies).

### Week 2: CLI Perfection & UX

- **Goal:** Fix all lag and user experience issues in the local terminal UI.
- **Tasks:**
    - Fix the streaming lag in the CLI output.
    - Refine context compaction to prevent the agent from losing track of long conversations.
    - Improve the `packages/tui` chat interface.
    - Add comprehensive tests for `apps/cli` to lock in stability.

### Week 3: Server, DB & Real-time Communications

- **Goal:** Solidify the backend API and state management.
- **Tasks:**
    - Fix how Sessions and Projects are handled in the DB.
    - Migrate all frontend/backend communication to unified WebSockets (Socket.io) instead of mixed SSE.
    - Implement strict billing, usage tracking, and rate limiting.
    - Add GitHub repo import capabilities.

### Week 4: Worker / Runtime / VM Architecture (The Brainstorm Phase)

- **Goal:** Finalize and implement the exact relationship between Worker, Runtime, and the VM Sidecar.
- **Tasks:**
    - Determine the Execution Context (See Open Question below).
    - Refactor `apps/worker` to handle async state tracking instead of blocking BullMQ threads for hours.
    - Implement robust background task tracking (e.g., `npm run dev`) inside the VM.

### Week 5 & 6: The Devin-like Web UI

- **Goal:** Build the immersive cloud workstation.
- **Tasks:**
    - Implement the split-pane layout (Chat on left, Workstation tabs on right).
    - Build out Monaco editor integration with live diffing.
    - Implement multiplexed `xterm.js` terminal tabs.
    - Add Playwright + noVNC for the live Browser preview tab.

---

## 5. Architectural Decision: The Injected Sidecar Model

We have decided to proceed with the **"Injected Sidecar" Model (True Sandbox)** for our cloud deployment, finalizing the following deep technical specifications:

### How it works (The Grill Session Decisions):

- **The Binary Payload:** The AI Agent logic (`packages/agent`) is compiled into a standalone Linux binary using `bun build --compile`. This keeps the Firecracker VM image completely generic (no need to pre-install Node/Bun inside the VM) and ensures ultra-fast boot times.
- **The Injection & Initialization Handshake:** The `apps/worker` provisions the VM and pushes this binary _into_ the VM (the Sidecar). When the Sidecar boots, it connects to a `vsock` endpoint. The Rust Runtime (`apps/runtime`) securely transmits the initial configuration payload (prompt, project context, encrypted secrets) directly into the agent's memory via this handshake. No secrets are ever written to disk.
- **Zero Latency Execution:** Because the Agent lives on the same local filesystem as the project, it executes bash tools and file reads instantly on the VM's local SSD. It can seamlessly spawn long-running background servers (`npm run dev`) and monitor them directly.
- **The Communication Bridge (`vsock`):** The Sidecar streams its data out over Firecracker's Virtual Sockets (`vsock`). The Rust Runtime acts as a secure relay, forwarding this `vsock` stream over gRPC to the Node.js Worker. This guarantees the VM remains 100% network-isolated from internal cloud infrastructure.
- **Event-Driven Sync & Billing:** The Sidecar acts purely as a dumb event emitter. When it consumes LLM tokens, it streams structured JSON events (e.g., `{ type: "USAGE", tokens: 150 }`) over the `vsock`. The Node.js Worker consumes these events, updates Postgres, deducts credits, and broadcasts to WebSockets. If credits hit zero, the Worker instantly sends a `KillVM` signal to the Runtime.

### Why this approach?

- **Maximum Speed:** Zero latency for file and bash operations.
- **Ultimate Security:** Total network isolation via `vsock`. Secrets exist only in ephemeral memory.
- **True Scalability:** Worker nodes simply route async gRPC streams and handle DB transactions; they don't block threads running heavy LLM iteration loops.
