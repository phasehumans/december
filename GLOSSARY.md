# December Agent Runtime

The execution substrate and durable always-on agent runtime for December.

## Language

**Project**:
A long-lived repository workspace holding persistent guidelines, memory, wake-up schedules, and mailboxes that scope agent sessions.
_Avoid_: workspace folder, repo config

**Durable Step Kernel**:
The low-level execution loop that checkpoints discrete model and tool steps to the database before proceeding to the next step.
_Avoid_: workflow engine, orchestrator

**Mailbox**:
The message queue that holds inbound user prompts, webhooks, and scheduled triggers for a session until an agent turn executes them.
_Avoid_: inbox, event bus, message broker

**Wake-Up Trigger**:
A database record that schedules an agent session to be awakened at a future timestamp by the background sweeper.
_Avoid_: cron job, scheduled task

**Dual-Path Streaming**:
The pattern separating ephemeral, real-time token broadcasting over pub/sub from atomic, durable step checkpoints committed to PostgreSQL.
_Avoid_: database streaming, batch rendering

**Chaos Suite**:
The automated test harness that simulates mid-command worker crashes, stale epoch write rejections, and mailbox wake-up lifecycles against real database and sandbox environments.
_Avoid_: smoke tests, mocked unit tests

**Brain**:
The durable control plane that hosts agent reasoning, prompts, conversation history, and transaction boundaries.
_Avoid_: backend, orchestrator node

**Hands**:
The disposable sandbox execution environment (VM or container) that manages filesystem mutations, dev servers, and shell processes.
_Avoid_: worker, runner

**Lease**:
A time-bounded reservation held by a worker in PostgreSQL that grants exclusive permission to execute steps for a session.
_Avoid_: lock, mutex, reservation token

**Epoch Fence**:
The database check that verifies the worker's epoch counter before every commit, rejecting writes from zombie or superseded workers.
_Avoid_: distributed lock, fencing token

**Hands Protocol**:
The typed, opId-addressed interface through which the Brain instructs the Hands to execute, attach, detach, or terminate processes.
_Avoid_: remote exec, agent RPC

**opId Journal**:
The sandbox-local record mapping unique operation identifiers to running process IDs, log streams, and exit codes.
_Avoid_: process table, task map

**Detach**:
A graceful disconnection from an active Hands operation during worker redeployments, leaving the process running in the sandbox for a successor worker to resume.
_Avoid_: abort, cancel, kill

**Terminate**:
An explicit cancellation triggered by a human user that stops and kills the active process running in the Hands sandbox.
_Avoid_: detach, disconnect

**Payload Offloading**:
The storage pattern where tool execution outputs exceeding 32KB are written to object storage, recording only a reference identifier in the durable step log.
_Avoid_: body truncation, inline blob storage
