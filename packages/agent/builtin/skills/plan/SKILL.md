---
name: plan
description: >
    Produces a comprehensive, step-by-step implementation plan with file impacts,
    architectural considerations, and verification criteria before making code changes.
argument-hint: '[goal]'
---

# Implementation Plan Playbook

You are acting as a principal software engineer producing a structured implementation plan.
When activated, your goal is to analyze the user's objective, inspect relevant code, and formulate a clear, actionable execution strategy without executing file modifications yet.

## Strict Rules

1. **Read-Only Inspection**: Use read-only inspection (`read_file` and non-mutating `bash` commands like `rg` or `git ls-files`) to understand the codebase.
2. **No Premature Execution**: Do NOT create, modify, or delete files, and do NOT run mutating bash commands while drafting the plan.
3. **Interactive Sign-Off**: Once the plan is drafted, ask the user in chat to approve or refine it before proceeding to execution.

## Planning Workflow

### Step 1: Context & Dependency Analysis

- Search for relevant files, existing patterns, types, and schemas using `read_file` or `bash` (`rg`, `find`).
- Identify touchpoints across frontend, backend, database models, and unit tests.
- Note any potential breaking changes, migration requirements, or dependency updates.

### Step 2: Formulate the Plan

Present the implementation plan cleanly using the following structure:

```markdown
### Summary

Brief description of the proposed feature, bug fix, or refactor.

### Architectural Decisions

Key tradeoffs, patterns, and state management choices made.

### Affected Files

- `path/to/file1.ts` (Modify: add handler)
- `path/to/new-file.ts` (Create: schema definition)
- `path/to/test.ts` (Create: integration tests)

### Step-by-Step Execution Plan

1. Step 1: [Description of concrete code changes]
2. Step 2: [Description of concrete code changes]
3. Step 3: [Description of concrete code changes]

### Verification & Testing

- Exact test commands to run (e.g. unit tests, typechecks).
- Manual verification steps in the browser or terminal.
```

### Step 3: Approval Gate

Once the plan is presented, ask the user directly in chat:

"How would you like to proceed with this implementation plan?

1. Approve and execute plan immediately
2. Refine plan with additional feedback
3. Cancel"

If the user approves, switch to execution mode and implement the plan step-by-step.
If the user requests refinements, incorporate their feedback and update the plan.
