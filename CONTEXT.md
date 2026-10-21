# December Agent Runtime

The execution substrate and always-on teammate agent runtime for December.

## Language

**Durable Step Kernel**:
The low-level execution loop that checkpoints discrete model and tool steps to the database before proceeding to the next step.
_Avoid_: workflow engine, orchestrator

**Sentinel**:
The autonomous, always-on agent subsystem that runs scheduled checks, monitors repository events, and maintains codebases in the background.
_Avoid_: cron bot, background worker

**Brain**:
The durable control plane that hosts agent reasoning, prompts, conversation history, and transaction boundaries.
_Avoid_: backend, orchestrator node

**Hands**:
The disposable sandbox execution environment (VM or container) that manages filesystem mutations, dev servers, and shell processes.
_Avoid_: worker, runner
