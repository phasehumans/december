# December Codebase Architecture

## 1. Vision & Identity

**December** is a full-stack, agentic AI coding assistant designed to operate as a self-hosted or cloud-scalable alternative to Devin. It allows developers to interact with an autonomous AI software engineer either locally via a terminal UI (CLI) or through a collaborative cloud web interface.

The core philosophy of December is **"Write once, run anywhere."** The core AI reasoning loop (`packages/agent`) is entirely decoupled from the environment it runs in. It executes identically whether it's running locally on a user's MacBook (via CLI) or securely inside an ephemeral Firecracker microVM in the cloud (via the Sidecar).

---

## 2. Monorepo Structure: Apps & Packages

### Apps

- **`apps/cli`**: The local command-line application (built with Ink). It runs the agent loop locally on the user's machine, executing bash/file tools directly on the host OS.
- **`apps/server`**: The Node.js backend API. Manages users, authentication, projects (folders), sessions (workspaces), billing, WebSocket connections, and queues up Agent jobs.
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
3.  **Zero Latency Execution:** Because the Agent lives on the same filesystem as the session workspace, it executes bash tools instantly. It spawns long-running background servers (`npm run dev`) and monitors them directly without gRPC network latency.
4.  **The Communication Bridge (`vsock`):** The Sidecar streams its data out over Firecracker's Virtual Sockets (`vsock`). The Rust Runtime securely relays this `vsock` stream over gRPC to the Node Worker, keeping the VM 100% network-isolated from internal cloud infrastructure.
5.  **Event-Driven Sync & Billing:** The Sidecar acts purely as a dumb event emitter. It streams structured JSON events (e.g., `{ type: "USAGE", tokens: 150 }`) over `vsock`. The Node Worker consumes these events, updates Postgres, deducts credits, and broadcasts to WebSockets. If credits hit zero, the Worker instantly sends a `KillVM` signal.

---

## 4. Section 1: The "Project" Concept & Data Model Refactoring

In the refactored architecture, we completely separate workspace environments and persistent sessions from files and folders:

> [!NOTE]
> **Pre-Production Schema Development:**
> Because this application is not yet hosted in production and has no real users, we do not need to construct a backward-compatible custom SQL migration. A standard development schema reset (`bunx prisma migrate dev` or `bunx prisma db push --force-reset`) is sufficient to sync local database models.

- **The Legacy Project Model:** Formerly, a `Project` acted as the primary environment wrapper. It held configuration details for GitHub integrations, Vercel deployment credentials, MinIO storage prefixes, templates, star flags, and category metadata. This design tightly coupled the active workspace context to a single project, making multi-session workspace isolation and lifecycle management difficult to coordinate.
- **The Refactored "Project as a Folder" Model:** In the simplified design, a **Project** represents a simple, lightweight **Folder** or container. It strips away all integrations, configurations, and versioning features:
    - **Fields Stripped:** `isStarred`, `isFeatured`, `isSharedAsTemplate`, and the `ProjectCategory` enum.
    - **Fields Kept:** Basic folder metadata: `id`, `name`, `userId`, `description`, `createdAt`, and `updatedAt`.
    - **Wiki Documentation:** Documentation pages at the project level are now represented by the new `WikiPage` model, linked to the `projectId`.
- **Model Deletions and Renames:**
    - **Deleted Models:** `ProjectVersion`, `ProjectVersionStatus` enum, and `ProjectLike` are completely removed.
    - **Renamed Models:**
        - `ProjectMemory` ➔ `SessionMemory`
        - `ProjectImport` ➔ `SessionImport`
        - `ProjectCollaborator` ➔ `SessionCollaborator`
        - `AgentSessionMemory` is updated to explicitly map to `Session` instead of `Project`.
    - **New Models:**
        - `SessionSettings`: Holds flexible runtime JSON configuration.
        - `ReviewComment`: Stores PR and peer review feedback.
        - `WikiPage`: Represents folder-level documentation.
- **The "Session" as the Workspace Wrapper:** A **Session** is now the primary workspace where an Agent's execution loop runs:
    - **Integrations Transferred:** GitHub configurations, Vercel deployments, and MinIO storage prefixes are now attributes of the `Session` model.
    - **Standalone Sessions:** By making `projectId` nullable, a session can exist independently (Standalone Session) without residing inside a folder/Project.
    - **Workspace State & Settings:** Sessions track their runtime state (`vmStatus` enum: `PROVISIONING`, `RUNNING`, `STOPPED`, `FAILED`), configuration settings via the new `SessionSettings` model, and persistent agent/peer reviews via `ReviewComment`.
    - **Removed Versioning:** We completely deleted `ProjectVersion` and `ProjectVersionStatus` to avoid complex rollback state tracking.
- **The Wiki Feature (Documentation Management):**
    - **Scope:** Organized at the Project (Folder) level. Mapped via the `WikiPage` model.
    - **Purpose:** Holds architectural decisions, styling guides, and developer documentation relevant to all sessions in that folder.
    - **User Interface:** Accessible via the workspace sidebar. Features a split markdown rendering viewer and a full editing suite.
    - **Agent Integration:** Equipped with `read_wiki` and `update_wiki` tools, enabling the agent to learn project rules before coding and document its changes autonomously.
- **The Review Feature (PR & Feedback Loops):**
    - **Scope:** Organized at the active `Session` level. Mapped via the `ReviewComment` model.
    - **Purpose:** Collects review feedback, Pull Request links, and peer developer review streams.
    - **User Interface:** Displays as a dedicated Review Pane in the workspace split screen, grouping comments and verification status.
    - **Autonomous GitHub App Bot:** Backed by the December GitHub App. When a user installs the app on their GitHub repository and grants access permissions:
        - **Webhook Triggers:** The December backend listens for repository webhooks (e.g. Pull Request creation or update events).
        - **Autonomous Reviewing:** The system automatically spins up a VM session, analyzes the repository changes, and executes reviews on the codebase.
        - **GitHub Integration:** The agent acts as an autonomous bot, using the `create_pr_review` tool to comment directly on specific code lines within the GitHub PR UI, and the `submit_pr` tool to push fixes, bridging local workspace executions with the remote GitHub repository interface.

---

## 5. Section 2: Detailed Phase-Wise Implementation Roadmap & TODOs

### Phase 0: Unbreak the Build (Prisma Schema Migration & Deprecation Cleanup) [DONE]

_Focuses on establishing typecheck validation, resolving monorepo dependency conflicts, applying the new Prisma schema, and cleaning up legacy modules._

- [x] **P0.T0: Establish Per-Workspace Scripts & Turbo Pipelines**
    - _Task Details:_
        - Add `"typecheck": "tsc --noEmit"` and `"build"` scripts into all package files (`apps/server`, `apps/web`, `apps/worker`, `packages/*`).
        - Configure `"test": "bun test"` where tests are implemented.
        - Update root `turbo.json` with a clean `typecheck` task and map `build` dependencies to include `db:generate` as a prerequisite.
        - Document these gates (`turbo run build`, `turbo run typecheck`, `turbo run test`) inside the root [README.md](file:///home/chaitanya/code/december/README.md).
    - _Verification:_ Running `turbo run typecheck` runs compilation checks across all monorepo workspaces and returns typescript errors cleanly.
- [x] **P0.T1: Toolchain Paths, TS Compilation, and Dependency Deduplication**
    - _Task Details:_
        - Map `@december/shared` to `./packages/shared/src/index.ts` under compiler options in `tsconfig.base.json`.
        - Add `"@december/shared": "workspace:*"` dependency inside `apps/server/package.json`.
        - Add `overrides` under root `package.json` to resolve S3 `@smithy/types` conflicts and BullMQ `ioredis` version skews.
        - Resolve compiler duplication errors by merging `truncateOutput` and cleaning duplicate imports of `Tool` and `ToolExecuteContext` inside `packages/tools/src/github.ts` and `browser.ts`.
        - Fix `rate-limiter.ts` inside `apps/server` to map `req.user.id` to `req.user.userId`.
    - _Verification:_ Running `cd apps/server && bunx tsc --noEmit` and compilation in `packages/tools` completes without path errors.
- [x] **P0.T2: Database Migration & Schema Reconciliation**
    - _Task Details:_
        - Apply schema migrations to create `SessionSettings`, `ReviewComment`, `WikiPage`, `GithubAppInstallation` models and delete `ProjectVersion`, `ProjectLike` models.
        - Rebuild the local database schema via `bunx prisma migrate dev` or database reset since there is no production user data to preserve.
        - Clean up code reference errors across:
            - `app.ts`: Delete the `templateRouter` routes.
            - `project/` module: Delete `projectVersion` select statements, `toggleStarProject` endpoints, and duplication helpers.
            - `runtime/` and `platform/`: Remove project version parameters; locate resources using the session's MinIO prefix.
            - `import/`: Map relations to `SessionImport` instead of `ProjectImport`.
            - `canvas/` & `memory/`: Rename queries to use `sessionMemory` and `SessionSettings` config JSON.
            - `profile/`: Delete endpoints and controller logic for user-design preferences, avatar uploads, and feedbacks.
    - _Verification:_ Monorepo builds with zero typescript compile-time errors; database integration tests verify session creation.
- [x] **P0.T3: Remove Legacy Server-Sent Events (SSE) Generate Module**
    - _Task Details:_
        - Delete the `apps/server/src/modules/generate/` directory completely.
        - Remove SSE imports and route mountings inside `app.ts`.
        - Verify no background modules try to import or call `generateProjectStream` or SSE methods.
    - _Verification:_ Running `grep` for `event-stream` or `generateProjectStream` returns no occurrences inside `apps/server`.

### Phase 1: Milestone - End-to-End Cloud Session Execution

_Focuses on establishing the gRPC contracts, building the guest rootfs, managing Firecracker VM lifecycles, and relaying events/input over secure vsock channels._

- [x] **P1.T0: Canonical Real-time Event Wire Shape**
    - _Task Details:_
        - Define `WireAgentEvent = { type: string, data: unknown }` wrapper with serialization utilities `toWire()` and `fromWire()` in `packages/shared/src/types.ts`.
        - Keep the base `AgentEvent` union flat in `packages/shared` so local Ink CLI/TUI components don't break.
        - Add flat events `TerminalData` (having `taskId` and `chunk`) and `FileModified` (having `path` and optional `diff`).
        - Route Socket.io events on a single `agent_event` channel rather than separate channels.
    - _Verification:_ Unit tests verify encoding and decoding flat event variants (like terminal chunks) to/from the `WireAgentEvent` schema.
- [x] **P1.T1: Protobuf gRPC Definitions & Streaming RPCs**
    - _Task Details:_
        - Write gRPC contracts in `packages/proto/runtime.proto` for `StartAgentSession(SessionConfig) returns (stream SidecarEvent)`, `SendControl(ControlMessage) returns (ControlAck)`, and `InterruptSession(InterruptRequest) returns (InterruptResponse)`.
        - Struct `SessionConfig` to pass VM identifier, prompts, workspace directory, model/provider settings, secrets list (`[{name, value}]`), temporary JWT tokens, and API host URLs.
        - Extend `CreateVMRequest` with `sidecar_binary_url` and `workspace_zip_url` presigned fields.
        - Configure compilation pipeline to compile TS proto bindings into `packages/proto/generated/`.
    - _Verification:_ `bun run build` in `packages/proto` generates bindings; `cargo build` in `apps/runtime` builds proto modules.
- [x] **P1.T2: Base rootfs & Guest Kernel Provisioning**
    - _Task Details:_
        - Extend `apps/runtime/scripts/build_rootfs.sh` to compile an ext4 base filesystem container containing an init wrapper that executes `december-sidecar` on guest VM boot.
        - Ensure Node or Bun are not pre-installed inside the rootfs (the sidecar agent is a compiled standalone binary).
        - Create `fetch-kernel.sh` to download/compile a Firecracker-ready kernel (`vmlinux`).
    - _Verification:_ Kernel and rootfs files are generated; mock booting launches `december-sidecar` binding to vsock port 50051.
- [x] **P1.T3: Firecracker Runtime Hardening & Lifecycle Management**
    - _Task Details:_
        - Map paths, network bridges, subnets (`172.16.0.0/24`), TAP interfaces, and memory boundaries from environment configurations in `config.rs`.
        - Implement nat rules (`iptables -A POSTROUTING -o <egress> -j MASQUERADE`) inside network setup to provide public internet egress to guest VMs.
        - Implement `restore_workspace` to mount the guest filesystem, download and extract the workspace zip file, and copy `december-sidecar` and `december-agent` binaries to `/usr/local/bin/`.
        - Implement vsock CID paths `/tmp/fc-<vmid>.vsock` with guest CID >= 3.
    - _Verification:_ Creating a VM boots Firecracker, binds vsock ports, configures network access, and destroys VM cleanly upon calling destroy.
- [x] **P1.T4: Host-Guest Vsock-to-gRPC Relay**
    - _Task Details:_
        - Integrate `tokio-vsock` in `apps/runtime/Cargo.toml`.
        - Build `vsock_relay.rs` using a 4-byte big-endian length-prefixed frame decoder.
        - Implement the handshake protocol: downstream config frame #0 is written first, then upstream events and downstream control inputs are relayed concurrently over full-duplex vsock connections.
        - Link gRPC stream methods to return Receiver streams of these events.
    - _Verification:_ Relay codec unit tests verify envelope serialization; mock vsock endpoints verify configuration delivery.
- [x] **P1.T5: In-VM Compiled Sidecar Shim & Bun Agent Execution**
    - _Task Details:_
        - Build `december-sidecar` in Rust as a simple vsock ↔ stdio wrapper inside `apps/sidecar/src/main.rs`. It binds to vsock, launches `december-agent` as a child process, and pipes the vsock stream directly to standard input/output.
        - Build `december-agent` inside `apps/sidecar/index.ts` by compiling using `bun build --compile`. It reads config frame #0 from stdin, configures LLM providers, runs the agent loop, and monitors background tasks under a PTY.
        - Route background stdout/stderr streams to emit flat `TerminalData` events under the matching `taskId`.
    - _Verification:_ Running compiled binaries locally runs loop prompts, executes tools inside VM paths, and streams xterm PTY chunks.
- [x] **P1.T6: Secret Encryption Model & Service**
    - _Task Details:_
        - Add `Secret` schema to Prisma with encrypt/decrypt operations based on an encryption key (`SECRETS_ENC_KEY`) using AES-256-GCM.
        - Create controller routes (`GET/POST/DELETE /api/v1/secrets`) with zod validators and auth middlewares.
    - _Verification:_ Secrets repository unit tests verify that encrypting a key and decrypting it returns the matching value, and lists mask raw keys.
- [x] **P1.T7: Worker State Machine & Persistent Event Listener**
    - _Task Details:_
        - Build `apps/worker/src/workspace.ts` to compress repositories, push packages to MinIO, and return presigned URLs.
        - Refactor the BullMQ job processor to provision VMs, set `vmStatus` to `RUNNING`, record metadata, and exit the job handler instantly.
        - Build `listener.ts` to process gRPC streams, publish events to Redis socket rooms, track token usage, check credit balances, and trigger workspace backups upon termination or 15-minute idle timeouts.
    - _Verification:_ Job states transition correctly; event streams route to Redis queues; idle timeouts shut down VMs cleanly.
- [x] **P1.T8: Secrets & Token Secure In-Memory Delivery**
    - _Task Details:_
        - Retrieve user secrets and merge API keys (Google, OpenAI, Anthropic) in the socket controller.
        - Mint a short-lived JWT token (`agent_api_token`) using a dedicated backend server secret (`AGENT_TOKEN_SECRET`).
        - Inject secrets and JWT tokens directly into `SessionConfig` parameters, flowing them into VM memory via vsock frame #0.
    - _Verification:_ VM agent loads credential variables in-memory (`agent.env.get`); auditing disk paths verifies no credentials touch filesystems.
- [x] **P1.T9: Real-time Web Socket Transport Cutover**
    - _Task Details:_
        - Update Socket.io middleware to authorize handshakes using `httpOnly` `accessToken` cookies. Restrict socket rooms and actions to verified session owners.
        - Wire xterm.js terminal instances to send inputs to `terminal_input` socket routes, routing PTY updates back.
        - Wire Monaco code editor features to update directory lists and render inline diffs using `@codemirror/merge` upon receiving `FileModified` events.
    - _Verification:_ WebSocket authorization fails for incorrect credentials or foreign session scopes; Monaco editor updates diff views on file events.

### Phase 2: Devin Workstation UI & Platform Features

_Focuses on completing the Devin-style split-pane workstation interface, code diff viewers, and auxiliary tools (Wiki, PR Reviews)._

- [x] **P2.T1: Review Backend Service**
    - _Task Details:_
        - Create CRUD database schemas and controllers for `ReviewComment` under `apps/server/src/modules/review/`.
        - Validate session ownership when fetching review comment lists.
    - _Verification:_ Review controller unit tests verify CRUD actions; requests from non-owners return 404/403 errors.
- [x] **P2.T2: Folder-Level Wiki Backend Service**
    - _Task Details:_
        - Create CRUD schemas and endpoints in `apps/server/src/modules/wiki/` to support project-level `WikiPage` configurations.
        - Add conflict logic returning 409 status codes for duplicate wiki titles.
    - _Verification:_ Pages can be fetched, saved, and updated; unique title conflicts throw correct HTTP exceptions.
- [x] **P2.T3: GitHub App OAuth & Installation Webhook Flow**
    - _Task Details:_
        - Create OAuth redirect controllers (`/install-start`) and verify installation callback tokens.
        - Implement signature verification for webhooks (`GITHUB_APP_WEBHOOK_SECRET`) and update installations in `GithubAppInstallation`.
        - Build integration API wrappers to interact with GitHub REST interfaces using installation tokens.
    - _Verification:_ Webhook signatures verify successfully; mock calls generate installation tokens without hitting GitHub rates.
- [x] **P2.T4: Session Concurrency Limit Enforcement**
    - _Task Details:_
        - Update `session.service.ts` to initialize sessions as `STOPPED`.
        - Query active sessions upon session startup, throwing a workspace exception if an active session is running for the user.
    - _Verification:_ Starting a second concurrent session fails validation checks.
- [x] **P2.T5: Activity Log Component**
    - _Task Details:_
        - Build `ActivityLog.tsx` in the web application.
        - Parse incoming agent events, filter thought logs, and show structured tool execution steps (tool name, parameters, execution times, outputs).
    - _Verification:_ Component lists execution steps sequentially based on stream updates.
- [x] **P2.T6: Live Browser Tab (noVNC Integration)**
    - _Task Details:_
        - Install `@novnc/novnc` in `apps/web`.
        - Build `LiveBrowser.tsx` to render VNC WebSocket streams within an iframe.
    - _Verification:_ Renders a placeholder state when VNC endpoints are empty, and initializes noVNC when URLs are available.
- [x] **P2.T7: Sessions Hub landing & Filters**
    - _Task Details:_
        - Convert `/sessions` into the primary landing dashboard.
        - Update session query endpoints and views to support searching, tagging, pinning, and archiving workspaces.
    - _Verification:_ Query variables filter lists correctly; landing route opens session hub dashboard.
- [x] **P2.T8: Review Pane Wiring**
    - _Task Details:_
        - Build `ReviewPage.tsx` and integrate backend API wrappers.
        - List review feedback comments, accept user PR URLs, and display verification statuses.
    - _Verification:_ Submitting a verification review records comment details and shows updates in the view list.
- [x] **P2.T9: Folder Wiki Interface**
    - _Task Details:_
        - Build `WikiView.tsx` and `WikiEditor.tsx` in the UI directory.
        - Bind sidebar link to project folders, rendering markdown layouts and routing edits to wiki endpoints.
    - _Verification:_ Wiki pages render, support editing, and update project-specific directories.
- [x] **P2.T10: Session Settings Modal**
    - _Task Details:_
        - Build `SessionSettingsModal.tsx` to configure tags, archive sessions, and adjust folder/project linkages.
    - _Verification:_ Submitting changes routes request payloads to session update endpoints.
- [x] **P2.T11: Legacy View Cleanups, Route Rename & Endpoint Overhaul**
    - _Task Details:_
        - Rename workspace paths from `/project/:id` to `/session/:id` and configure redirects.
        - Delete legacy routes and files for projects dashboards, templates, version selectors, and Canvas components.
        - Update all TRPC/REST endpoints in `apps/server` to query `Session` instead of `Project` for app data, and completely delete all templates and project versioning API routes.
    - _Verification:_ Workspace routes open sessions dashboard; legacy paths redirect or return 404s.
- [x] **P2.T12: Agent Wiki & PR Tools**
    - _Task Details:_
        - Write tools `read_wiki`, `update_wiki`, `create_pr_review`, and `submit_pr` under `packages/tools/src/`.
        - Ensure tools use the session's temporary JWT `agent_api_token` for authorization rather than user cookie parameters.
    - _Verification:_ Mock tool invocations send headers containing JWT tokens and verify request properties.
- [x] **P2.T13: Browser Preview Tab**
    - _Task Details:_
        - Build `BrowserPreview.tsx` to render guest VM dev-servers using an iframe.
        - Provide URL search inputs, refresh actions, and placeholder states when no dev server is active.
    - _Verification:_ Iframe reloads correctly; active dev server view renders guest workspace screens.
- [x] **P2.T14: VM Lifecycle Header Controls**
    - _Task Details:_
        - Build `SessionStatusHeader.tsx` to show status badges and lifecycle actions (Start/Stop controls) based on `vmStatus`.
    - _Verification:_ Status updates trigger badge updates and toggle start/stop button states.

### Phase 3: Agent Core Polish

_Enhances reasoning accuracy, token measurement, and extensibility._

- [x] **P3.T1: Token Usage Tracking and Context Window Compaction**
    - _Task Details:_
        - Parse token usage headers from OpenAI and Anthropic streams.
        - Map dynamic context windows based on `MODEL_CONTEXT_WINDOWS`.
        - Replace static conversation compaction limits with dynamic boundaries computed from model catalog details.
    - _Verification:_ Prompt outputs contain usage statistics; compaction hooks trigger at correct limits.
- [x] **P3.T2: Model Context Protocol (MCP) Stdio Client**
    - _Task Details:_
        - Integrate `@modelcontextprotocol/sdk` in `packages/tools/package.json`.
        - Build stdio transport managers inside `packages/tools/src/mcp.ts` to spawn server processes listed in `mcp.json`.
        - Route MCP commands to target processes.
    - _Verification:_ MCP integration tests verify transport setup, tool discovery, and tool call routing.
- [x] **P3.T3: Skills Directory Discovery & Slash Commands**
    - _Task Details:_
        - Write `discoverSkills()` inside `agent-harness.ts` to read files under `<workspace>/.december/skills/*/SKILL.md`.
        - Map leading slash keys (like `/plan` or `/schedule`) to format prompt buffers.
        - Clean up unused context compaction code inside `agent.ts`.
    - _Verification:_ Temp directory containing mock skills resolves successfully; mock slash commands inject prompts.

### Phase 4: Network Isolation & Hypervisor Hardening

_Focuses on security containment, network performance constraints, and live browser streaming._

- [x] **P4.T1: Subnet Traffic Isolation**
    - _Task Details:_
        - Update network setup scripts in `firecracker.rs` to apply `iptables` drop filters.
        - Restrict guest VM access to private subnets (e.g. `10.0.0.0/8`, `172.16.0.0/12` except the VM subnet, and `192.168.0.0/16`) to prevent VMs from reaching internal host infrastructure.
    - _Verification:_ Running commands inside VM to reach host gateways fails, while public web addresses are reachable.
- [x] **P4.T2: VM Network Bandwidth Limiting**
    - _Task Details:_
        - Apply traffic control (`tc`) shaper configurations on the host tap interface to restrict VM egress to 100 Mbps.
    - _Verification:_ Network testing tools verify transfer rates do not exceed 100 Mbps.
- [x] **P4.T3: Snapshot Warm Boots & Secure Config Encryptions**
    - _Task Details:_
        - Implement Firecracker snapshot-restore configurations to bypass cold boots.
        - Encrypt configuration packages passed over vsock.
    - _Verification:_ VM boot times are reduced; vsock payload decodes only with matching keys.
- [x] **P4.T4: Live Browser Container Execution**
    - _Task Details:_
        - Build a VNC server configuration inside the sidecar browser tool to stream Playwright browser instances.
        - Expose VNC websocket streams to client widgets via `noVNC`.
    - _Verification:_ Triggering a browser tool starts the viewport and streams the live visual window to the client.

---

## 6. Section 3: Manual Infrastructure Setup & Integrations

_Configuration details that cannot be automated during server execution._

- [ ] **GitHub App Configuration**
    - Create and configure a dedicated GitHub App in the GitHub Developer Settings interface.
    - Generate private keys and securely record them on the Node application host (`GITHUB_APP_PRIVATE_KEY`).
    - Set up the callback URL pointing to `apps/server` (redirect targets `/api/v1/githubapp/callback`).
    - Establish webhook URLs pointing to the `apps/server` `/api/v1/githubapp/webhook` endpoint.
    - Configure webhook events to register and listen for: `installation.created`, `installation.deleted`.
    - Configure OAuth permission scopes allowing the app to read and write PRs (`pull_requests:write`, `contents:read`), trigger reviews, and create integration comments.

---

## 7. Section 4: Future Enhancements & Devin-Inspired Suggestions

Based on features available in Devin (Cognition Labs), the following enhancements could be incorporated into December's roadmap to provide a more competitive developer workspace experience:

### 1. Interactive PTY & Terminal Takeover

- **Concept:** Allow users to directly type and execute commands within the agent's running terminal sessions.
- **Implementation Suggestion:** Integrate a terminal hijacking protocol in `apps/runtime` and the vsock relay. When a user interacts with the `xterm.js` terminal, temporarily pause the agent's input queue, relay the user's keystrokes directly to the sidecar PTY, and stream the output back.

### 2. Manual Browser Takeover

- **Concept:** Enable developers to click, type, and navigate within the agent's running browser window (running Playwright/VNC) to solve captcha challenges or debug UI flows.
- **Implementation Suggestion:** Configure the `noVNC` client in `LiveBrowser.tsx` to support full mouse/keyboard input routing, sending input events back to the VNC server running inside the VM sidecar.

### 3. Developer Playbooks & Custom SOPs

- **Concept:** Let developers write custom checklists, rules of engagement, or standard operating procedures (SOPs) called "Playbooks" that instruct the agent on how to approach tasks (e.g., how to deploy to a specific server or run tests).
- **Implementation Suggestion:** Create a Playbook schema in Prisma. Before the agent starts a session, scan the selected Playbook and inject its rules as system prompts, similar to how `.december/skills` are scanned.

### 4. Agent Loop & Stagnation Detection

- **Concept:** Automatically detect when the agent is stuck in a repetitive loop (e.g. running the same failing command, generating identical thought patterns, or looping on the same tool call).
- **Implementation Suggestion:** Build a loop detector module in `packages/agent` that hashes recent thought structures and tool parameters. If identical patterns occur N times consecutively, pause execution, alert the user, and prompt for guidance.

### 5. Automated Deployment Previews

- **Concept:** Instantly serve the agent's running web application on a public URL (e.g. `preview-<session-id>.december.dev`) so the user can test the live website.
- **Implementation Suggestion:** Build a reverse-proxy routing service on the host that listens for guest port allocations (like `3000` or `8080`) and exposes them securely via subdomains with authentication guards.

### 6. Dollar-Based Financial Budget Limits

- **Concept:** Let users define a maximum monetary budget (e.g. $5.00) for a session to prevent unexpected LLM usage bills.
- **Implementation Suggestion:** Track token pricing rates per model inside the server. During the long-lived listener loop (`P1.T7`), calculate cost accumulation in real-time, sending a VM termination signal if the session exceeds the budget.

### Cloud Browser Implementation (Playwright + VNC)

Currently, the `BrowserTool` relies on a lightweight HTTP `fetch` scraper injected via `local-operations.ts` to prevent forcing massive dependencies (like Playwright and Xvfb) onto CLI users' local machines.

We need to implement the "heavyweight" cloud version of the browser operation for `apps/server` (or the Docker Sandbox environment):

- [ ] Install `playwright`, `xvfb`, `x11vnc`, and `websockify` into the cloud Docker image.
- [ ] Create `cloud-operations.ts` in `apps/server`.
- [ ] Implement `context.operations.browser.navigate(url)` in the cloud adapter. It should:
    1. Boot up a headless Chromium instance bound to the `Xvfb` virtual display.
    2. Start `x11vnc` to capture the display.
    3. Start `websockify` to bridge the VNC stream to a websocket port (e.g., `ws://localhost:6080`).
    4. Return the websocket URL to the agent frontend alongside the parsed text.
- [ ] **Interactive Actions Upgrade**: Refactor `BrowserTool` schema in `@december/tools` to support actions beyond just `navigate` (e.g., `click(elementId)`, `type(elementId, text)`) utilizing Playwright's Accessibility Tree to allow the agent to fully interact with complex web apps.
