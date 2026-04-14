# Runtime Architecture

## What the runtime is

`runtime/` is the preview execution service for generated web projects.

It does not generate files itself. Its job is to:

- receive preview start and manifest-published requests from the main server
- fetch preview manifests and source files from object storage
- materialize those files into a local workspace
- run the project inside an isolated Docker container
- expose a preview URL and runtime status
- report status changes back to the main server

In this repo, the runtime listens on `http://localhost:5050` by default.

## What it takes as input

The runtime depends on four kinds of input:

1. HTTP requests from the main server
    - `POST /previews/start`
    - `POST /previews/{id}/manifest-published`
    - `GET /previews/{id}/status`
    - `GET /previews/{id}/display`
    - `DELETE /previews/{id}`

2. Preview manifest references
    - A `ManifestRef` tells the runtime which manifest JSON to fetch from object storage.
    - The manifest JSON describes the project version, whether it is runnable, and which files belong in the preview workspace.

3. Object storage content
    - The runtime reads manifest JSON and file contents from S3-compatible storage.
    - In local development this is usually MinIO.

4. Environment configuration
    - runtime HTTP bind address and public base URL
    - object storage endpoint, bucket, credentials
    - backend callback base URL and shared secret
    - Docker image and workspace settings

## What it outputs

The runtime produces:

- preview status snapshots
    - state: `WaitingForRunnableVersion`, `Bootstrapping`, `Installing`, `Starting`, `Healthy`, `Rebuilding`, `Failed`, `Stopped`
    - backend status: `ready`, `rebuilding`, `failed`
    - current version, healthy version, preview URL, last error, updated time

- a preview display URL
    - example: `http://localhost:5050/previews/<previewId>/display`
    - when ready, this redirects to the actual local dev server running inside Docker

- backend callbacks to the main server
    - `POST /api/v1/runtime/previews/{previewId}/callback`

- a local workspace on disk
    - default root: `./data/workspaces/<previewId>`

- a Docker container per preview session
    - based on `PREVIEW_DOCKER_IMAGE`, default `oven/bun:1`

## High-level flow

1. The main server asks the runtime to start a preview.
2. The runtime creates or reuses a preview actor for that `previewId`.
3. The actor fetches a manifest from object storage.
4. If the manifest is not runnable yet, the actor stays in `WaitingForRunnableVersion`.
5. If it is runnable, the actor:
    - prepares the local workspace
    - ensures the Docker sandbox exists
    - syncs changed files from object storage into the workspace
    - runs `bun install`
    - runs `bun run dev --host 0.0.0.0 --port 4173`
    - health-checks the preview until it becomes ready
6. Once healthy, the runtime marks the preview as `Healthy` and reports that back to the server.
7. When newer manifests arrive, the actor decides whether to reinstall, restart, sync only, or do nothing.

## Main components

### 1. HTTP layer

File: `runtime/src/http/mod.rs`

Responsibilities:

- exposes runtime endpoints
- validates internal auth using `x-phasehumans-runtime-secret`
- delegates preview operations to the actor registry
- serves the preview display endpoint

Behavior of `/display`:

- if the runtime already knows the target container URL, it redirects there
- otherwise it returns the "Preview is starting" HTML page

### 2. Actor registry

File: `runtime/src/actors/registry.rs`

Responsibilities:

- keeps one `PreviewActorHandle` per `previewId`
- creates actors lazily on first use
- routes start, manifest-published, status, and delete operations to the correct actor

This is the in-memory coordinator for all active previews.

### 3. Preview actor

File: `runtime/src/actors/preview.rs`

This is the core state machine.

Responsibilities:

- receive manifest updates through an async command channel
- fetch manifests from object storage
- compute diffs between the old and new manifest
- choose a reconcile mode:
    - `Bootstrap`
    - `Reinstall`
    - `Restart`
    - `SyncOnly`
    - `Noop`
- transition preview lifecycle state
- report state changes back to the main server
- periodically health-check already-running previews

The actor only accepts newer manifests. Older or stale manifest notifications are ignored.

### 4. Object storage service

File: `runtime/src/services/storage.rs`

Responsibilities:

- connect to S3-compatible storage
- fetch manifest JSON
- fetch file contents as text

Important detail:

- the runtime reads from object storage
- it does not publish manifests or upload generated files

Publishing is done by the main server and generation pipeline.

### 5. Workspace service

File: `runtime/src/services/workspace.rs`

Responsibilities:

- create a preview workspace directory
- sync changed files from the manifest into that directory
- remove obsolete files
- optionally clean up the workspace when a preview stops

The workspace is the host-side project directory that gets bind-mounted into Docker.

### 6. Docker sandbox

Files:

- `runtime/src/sandboxes/mod.rs`
- `runtime/src/sandboxes/docker.rs`

Responsibilities:

- allocate a local host port
- ensure the preview image exists
- create and start the preview container
- mount the workspace into `/workspace`
- run shell commands inside the container
- run `bun install`
- launch the dev server
- expose the target URL used by `/display`
- stop and remove the container on preview deletion

Current container behavior:

- image: `oven/bun:1` by default
- workdir in container: `/workspace`
- dev server port in container: `4173`

The runtime now tries to pull the configured preview image automatically if Docker reports it missing.

## How manifest reconciliation works

File: `runtime/src/domain/manifest.rs`

The manifest contains:

- `manifestVersion`
- `projectId`
- `projectVersionId`
- `publishedAt`
- `runnable`
- `files[]`

Each file entry contains:

- `path`
- `objectKey`
- `size`
- optional content type
- optional `sha256`

A manifest is considered effectively runnable only if:

- `runnable` is true
- `package.json` exists
- `index.html` exists
- at least one file under `src/` exists

Reconcile mode is chosen from file changes:

- dependency files changed: `Reinstall`
- config files changed: `Restart`
- only normal source files changed: `SyncOnly`
- no changes: `Noop`
- first manifest: `Bootstrap`

## How runtime collaborates with the main server

Server-side integration lives mainly in:

- `server/src/modules/runtime/runtime.service.ts`
- `server/src/modules/runtime/runtime.controller.ts`
- `server/src/modules/generation/generation.runtime.ts`
- `server/src/lib/preview-manifest.ts`

Current collaboration model:

1. The server chooses a project version and finds or creates a preview manifest reference.
2. The server calls runtime `POST /previews/start`.
3. During generation, the server can publish incremental or final preview manifests to object storage.
4. After each publish, the server notifies runtime with `POST /previews/{id}/manifest-published`.
5. The runtime reconciles that manifest and updates the running preview.
6. The runtime posts status callbacks back to the server.
7. The server exposes preview status to the frontend, and also keeps an in-memory fallback copy of callback results.

Current identity rule:

- on the server side, `previewId` is currently the same as `projectId`

## How runtime collaborates with object storage

The main server writes preview data to object storage:

- source files or generated files
- manifest JSON
- latest manifest reference JSON

The runtime reads that data:

- fetch manifest reference from the server request body
- fetch manifest JSON from object storage
- fetch each changed file body from object storage
- write those files into the local preview workspace

In short:

- server/generation pipeline = writer
- runtime = reader/executor

## Error model

File: `runtime/src/domain/error.rs`

Runtime errors are structured into:

- `temporary_partial_generation`
- `stable_compile_runtime`
- `dependency_install`
- `infra_runtime`

These errors are included in status snapshots and forwarded to the main server.

Examples:

- object storage fetch failure
- Docker connection or container startup failure
- dependency installation failure
- Vite compile/runtime error detected by health check

## Runtime dependencies you must have locally

For previews to work, the machine running `cargo run` for `runtime/` needs:

- Docker daemon running and reachable from that same environment
- access to the S3-compatible object store
- access to the backend server callback URL
- the preview image available or pullable, usually `oven/bun:1`

## How to check the preview image

If you run runtime from WSL/Linux, check the image there:

```bash
docker image inspect oven/bun:1 >/dev/null 2>&1 && echo present || echo missing
```

To pull it manually:

```bash
docker pull oven/bun:1
```

If you run Docker commands on Windows while runtime runs inside WSL, make sure both are talking to the same Docker engine. In your setup, the WSL check is the correct one.
