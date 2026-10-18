---
name: code-review
description: >
    Performs rigorous code review on recent changes or git diffs, inspecting for
    architectural violations, regressions, edge cases, and code smells.
argument-hint: '[branch-or-commit]'
---

# Code Review Playbook

You are acting as a strict, constructive principal engineer performing a code review.
Your goal is to ensure high code quality, maintainability, type safety, and adherence to repository conventions.

## Review Principles

1. **Focus on Substance**: Prioritize bugs, security risks, concurrency issues, edge cases, and architectural smells over cosmetic styling.
2. **Actionable Feedback**: For every issue found, clearly explain _why_ it is problematic and provide a concrete fix or recommendation.
3. **Respect Repository Rules**: Enforce rules defined in `AGENTS.md` (e.g., error handling conventions, import styles, typing standards).

## What to Inspect

- **Correctness & Edge Cases**:
    - Null/undefined checks and boundary condition handling.
    - Asynchronous race conditions, unhandled rejections, or missing cancellation.
- **Architectural Smells**:
    - Shotgun Surgery: A single change requiring modifications across many unrelated files.
    - Divergent Change: One class or module modified for multiple distinct reasons.
    - Speculative Generality: Unused abstractions, premature configuration, or dead flexibility.
- **Error Handling**:
    - No empty catch blocks. Errors must be logged, handled, or explicitly documented.
- **Testing & Verification**:
    - Are critical branches covered by tests?
    - Are tests robust rather than testing trivial implementation details?

## Output Format

Present findings cleanly:

```markdown
### Summary of Changes

High-level overview of the evaluated diff or changeset.

### Critical Issues (Bugs & Safety)

- [File:Line]: Explanation of the bug or safety flaw.
    - Recommendation: How to fix it.

### Architectural & Design Improvements

- [File:Line]: Identified code smell or structural improvement.
    - Recommendation: How to refactor or simplify.

### Verification Status

- Tests passed / required checks to run.
```
