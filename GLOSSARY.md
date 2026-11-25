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

**Stop**:
The end of a run that the user asks for. The run ends at once. The sandbox and the work stay, and the next prompt starts a new run in the same session.
_Avoid_: cancel, abort, terminate, kill

**Terminate**:
The Hands Contract operation that kills one process in the sandbox. A Stop uses it to end the commands of the run. For the user-triggered end of a run, say Stop.
_Avoid_: detach, disconnect

**Payload Offloading**:
The storage pattern where tool execution outputs exceeding 32KB are written to object storage, recording only a reference identifier in the durable step log.
_Avoid_: body truncation, inline blob storage

## Prompt box

**Speed**:
The choice between Fast and Deep for a run. On December credits the server maps the speed to a model. On the user's own key the model stays the same, and the speed sets its reasoning level.
_Avoid_: effort level, tier, model size

**Fast**:
The speed that gives quick answers at a lower cost. It asks the model for less reasoning.
_Avoid_: lite, cheap mode

**Deep**:
The speed that reasons more for hard work, and the default for a new session.
_Avoid_: thinking mode, pro mode

**Attachment**:
A file the user sends with a prompt in December Cloud. A prompt takes 5 files of 5 MB each, images and text files. The worker writes them into the sandbox.
_Avoid_: upload, asset

**Queued Message**:
A message the user writes while a run is active, kept until the run ends and sent then. The user can remove it before it goes.
_Avoid_: pending prompt, draft

**Steering**:
A message sent now to a running session. The agent reads it in the middle of the run and changes course.
_Avoid_: interrupt, nudge

**Status Strip**:
The one line under the Home prompt box that shows the one thing that needs action, such as GitHub not connected or no credits. It shows nothing when nothing needs action.
_Avoid_: banner, alert bar, notice

## Settings

**Setup Commands**:
The shell commands of one repository that run in the sandbox after the repository is cloned, such as `bun install`.
_Avoid_: init script, bootstrap

**Repository Secret**:
A secret that belongs to one repository. A session in that repository gets it, and it wins over an account secret with the same name.
_Avoid_: project secret, scoped env

**Spend Limit**:
An amount of December credits for one session or for one day. When a run reaches it, December pauses and asks the user to continue or stop. Runs on the user's own key do not count.
_Avoid_: budget, cap, quota

**Referral**:
An invite link of a user. The inviter and the invited account each get a credit after the invited account's first payment of $10 or more.
_Avoid_: affiliate, promo code

**Team**:
The group of accounts a user invites, with the roles Owner, Admin and Member. Members share nothing yet: sessions and billing stay with each account.
_Avoid_: organization, workspace
