# December - Master Implementation Plan

This document outlines the step-by-step implementation plan for refactoring and finalizing **December**, an agentic coding assistant with both a local CLI and a Cloud version.

## Architecture Overview

- **Agent Package (`packages/agent`)**: Environment-agnostic, uses an async generator `while` loop, runs in both CLI and Cloud via injected `Environment` abstractions.
- **Tools Package (`packages/tools`)**: Supports File System, Bash (with background tasks), Browser, GitHub, and MCP.
- **CLI (`apps/cli`)**: Local Ink-based terminal UI. Defaults to December Wallet (proxying LLM requests via `server`), but supports BYOK.
- **Server (`apps/server`)**: Node backend handling auth, Wallet billing (token + compute), handoff orchestrations, and gRPC communication with the runtime.
- **Runtime (`apps/runtime`)**: Rust-based Firecracker microVM manager. Exposes gRPC endpoints, uses ext4 base images with COW snapshots, and secures network via `iptables`.
- **Web (`apps/web`)**: Vite + React SPA with WebSockets for real-time agent streaming. Split-view layout (Chat / Terminal+Web Preview).
- **Handoffs**: One-way (CLI -> Cloud). Zips local workspace, uploads to MinIO via pre-signed PUT. Session history is resumed from Postgres. VMs are destroyed when idle to save costs.

---

## Phase 1: Core Packages (`agent` & `tools`)

_Goal: Get the core agent loop and environment abstractions rock-solid for CLI._

- [x] **1.1 Abstract `Environment` Interface**
    - Define interfaces in `packages/tools` for executing commands, reading/writing files, and background tasks.
- [x] **1.2 Refactor Tools**
    - Implement Local filesystem and Bash execution tools conforming to the new `Environment` interface.
    - Implement background task support (Agent gets Task ID, can stream output asynchronously).
    - Add Browser, GitHub, and MCP tools.
- [x] **1.3 Refactor Agent Loop**
    - Rewrite the `agent` core into a clean async/await `while` loop yielding events (e.g., `THINKING`, `TOOL_CALL`, `OUTPUT`) via an `AsyncGenerator` or `EventEmitter`.
    - Ensure the agent state can be perfectly serialized and paused for handoff.

## Phase 2: CLI Integration (`apps/cli`)

_Goal: Integrate the new `agent` into the Ink UI and finalize Wallet vs BYOK logic._

- [x] **2.1 Connect Agent to Ink UI**
    - Bind the new agent loop events to the existing Ink (`@december/tui`) single-screen layout.
- [x] **2.2 Authentication & Wallet Logic**
    - `december login` sets up Wallet as default. Allow overrides via `use_byok` config or `.env`.
- [x] **2.3 Server Proxying (Wallet Mode)**
    - When in Wallet mode, route LLM generation requests to the `server` to enforce token billing, instead of calling LLMs directly.
- [x] **2.4 Cloud Handoff Trigger**
    - Implement CLI command (`december handoff`).
    - Request pre-signed PUT URL from `server`, zip `.december` state and workspace, and upload directly to MinIO.

## Phase 3: Server & API (`apps/server`)

_Goal: Support CLI handoffs, proxy LLM requests, and prepare gRPC for Runtime._

- [x] **3.1 Wallet Proxies & Billing**
    - Implement secure endpoints that accept LLM requests from CLI/Web, verify wallet balances via Prisma, forward to LLMs, and deduct tokens.
- [x] **3.2 Handoff & MinIO Integration**
    - Implement endpoints to generate MinIO pre-signed URLs (PUT for CLI upload, GET for Runtime download).
    - Ensure Postgres `Session` models are updated correctly when handoffs occur.
- [x] **3.3 gRPC Setup (`packages/proto`)**
    - Create a new package `packages/proto` for `.proto` definitions.
    - Setup `@grpc/grpc-js` in the server to act as a client calling the Rust `runtime` for VM provisioning and execution.

## Phase 4: Rust Runtime (`apps/runtime`)

_Goal: Provision, manage, and execute commands inside Firecracker microVMs._

- [x] **4.1 Firecracker VMM Setup**
    - Migrate away from Docker. Create a base `ext4` rootfs with OS/toolchains.
    - Implement device mapper / overlayfs for fast Copy-On-Write snapshots per VM.
- [x] **4.2 gRPC Server implementation**
    - Use `tonic` to expose a gRPC API: `CreateVM`, `DestroyVM`, `ExecuteCommand`, `StreamOutput`.
- [x] **4.3 VM Initialization & Handoff Restore**
    - When booting a VM, download the workspace zip from MinIO using the pre-signed GET URL and extract it into the VM's rootfs.
- [x] **4.4 Network Security**
    - Apply `iptables`/`nftables` rules on the host to block VM access to private subnets (10.0.0.0/8, etc.) while allowing public internet.
- [x] **4.5 Lifecycle Management & Testing**
    - Ensure VMs are destroyed when idle/closed.
    - Write standard `cargo test` and bash E2E scripts.

## Phase 5: Cloud Web Frontend (`apps/web`)

_Goal: Build the real-time split-view UI for December Cloud._

- [ ] **5.1 WebSocket Integration**
    - Connect Vite SPA to `server` via WebSockets for low-latency streaming of agent chat, tool outputs, and terminal logs.
- [x] **5.2 Split-View Layout**
    - Add Xterm.js for the terminal tab, monaco-editor for code, and an iframe for live preview. Update the layout to use Resizable panels.
- [ ] **5.3 Handoff Resumption UI**
    - Add screens to view and resume sessions that were handed off from the CLI.
