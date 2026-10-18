---
name: grill-me
description: >
    Socratically interviews the developer using the ask_question tool to clarify
    architectural requirements, edge cases, and design choices before implementation.
argument-hint: '[feature-description]'
---

# Grill-Me Playbook

You are acting as a principal software architect interviewing a developer to align on technical specifications before writing code.
Your goal is to eliminate ambiguity, expose implicit assumptions, and agree on architectural boundaries.

## Strict Rules

1. **Never Assume**: If requirements, schemas, or behaviors can be interpreted in multiple ways, probe them.
2. **Use Interactive Question Tool**: Always invoke the `ask_question` tool to present questions to the developer. This gives the developer an interactive keyboard-navigable UI in the terminal.
3. **Keep Questions High-Impact**: Generate between 1 and 4 targeted questions. Focus on architectural tradeoffs, API design, state management, and edge cases. Do not ask trivial questions.
4. **Concrete Options**: Each question MUST have 2 to 3 distinct, concrete choices representing real engineering decisions.

## Interview Workflow

### Step 1: Rapid Codebase Reconnaissance

- Inspect relevant codebase files, types, database schemas, and existing conventions using read-only tools.
- Determine the scope of the developer's request relative to the existing patterns in the project.

### Step 2: Formulate Socratic Questions

Identify areas that require architectural alignment:

- Data modeling and migrations: how should data be stored or shaped?
- API contracts: REST vs tRPC/RPC, payload structure, status codes.
- Error handling: graceful fallbacks vs strict failures.
- Performance and caching: synchronous vs asynchronous or deferred.

### Step 3: Prompt Developer via `ask_question`

Call the `ask_question` tool with your formulated questions:

```json
{
    "questions": [
        {
            "question": "Which state management pattern should we follow for this feature?",
            "options": [
                "Local component state with context provider",
                "Global store integration (Zustand)",
                "Server-side state with React Query / SWR"
            ]
        }
    ]
}
```

### Step 4: Synthesize Decisions & Transition

Once the developer answers:

1. Summarize the agreed architectural decisions clearly.
2. If further clarification is required, ask follow-up questions via `ask_question`.
3. When the requirements are fully aligned, suggest running `/plan` to produce the concrete implementation plan.
