import { MODEL_CONTEXT_WINDOWS } from '@december/providers'

import type { LLMProvider } from '@december/providers'
import type { Message } from '@december/shared'

export const DEFAULT_MAX_TOKENS = 32000 // Assume a generic safe limit

function estimateTokens(messages: Message[]): number {
    return messages.reduce((acc, msg) => {
        const text = msg.content || ''
        const toolInput = msg.toolCalls?.map((t) => t.input).join('') || ''
        return acc + Math.ceil((text.length + toolInput.length) / 4)
    }, 0)
}

export async function compactContextIfNeeded(
    messages: Message[],
    llm: LLMProvider,
    maxTokens?: number,
    modelOptions?: Record<string, any>
): Promise<Message[]> {
    let limit = maxTokens
    if (!limit) {
        const modelName = modelOptions?.model
        if (modelName && MODEL_CONTEXT_WINDOWS[modelName]) {
            limit = MODEL_CONTEXT_WINDOWS[modelName]
        } else {
            limit = DEFAULT_MAX_TOKENS
        }
    }

    const currentTokens = estimateTokens(messages)

    // Trigger at 80% capacity
    if (currentTokens < limit * 0.8) {
        return messages
    }

    // Always protect System prompt (index 0) and the last 20 messages (approx 10 turns)
    const PROTECTED_TAIL = 20

    if (messages.length <= PROTECTED_TAIL + 1) {
        return messages // Not enough messages to compact
    }

    const systemPrompt = messages[0]!
    const middleHistory = messages.slice(1, messages.length - PROTECTED_TAIL)
    const recentHistory = messages.slice(messages.length - PROTECTED_TAIL)

    const hasPreviousSummary =
        middleHistory.length > 0 &&
        middleHistory[0].role === 'system' &&
        middleHistory[0].content.includes('[COMPACTED HISTORY SUMMARY]')
    let previousSummaryText = ''
    let messagesToSummarize = middleHistory

    if (hasPreviousSummary) {
        previousSummaryText = middleHistory[0].content.replace('[COMPACTED HISTORY SUMMARY]\n', '')
        messagesToSummarize = middleHistory.slice(1)
    }

    const historyText = messagesToSummarize
        .map((m) => {
            let txt = `[${m.role.toUpperCase()}]: ${m.content}`
            if (m.toolCalls) {
                txt += `\n[TOOL CALLS]: ${JSON.stringify(m.toolCalls)}`
            }
            return txt
        })
        .join('\n\n')

    const SYSTEM_PROMPT = `You are December's internal memory manager. Your task is to read a conversation between the user and December, then produce a structured context checkpoint that December will use to continue its work seamlessly.

Do NOT continue the conversation. Do NOT respond to any questions. ONLY output the structured summary using the exact format below.`

    const INITIAL_SUMMARY_PROMPT = `The messages above represent a conversation that needs to be summarized. Create a structured memory checkpoint:

## Goal
[What is the user trying to accomplish? List multiple items if applicable.]

## Constraints & Preferences
- [Any rules, constraints, or preferences mentioned by the user]
- [Or "(none)" if none were mentioned]

## Progress
### Done
- [x] [Completed tasks, created files, or finalized changes]

### In Progress
- [ ] [The exact work that is currently underway]

### Blocked
- [Issues preventing progress, failing tests, or missing API keys]

## Key Decisions
- **[Decision]**: [Brief rationale on architectural or code choices]

## Next Steps
1. [Ordered list of exactly what December needs to do next to resume work]

## Critical Context
- [Any terminal outputs, specific error codes, or snippets needed to continue]

Keep each section concise. You MUST preserve exact file paths, function names, and error logs.`

    const UPDATE_SUMMARY_PROMPT = `The messages above are NEW conversation messages that must be incorporated into the existing memory summary provided below:

<previous-summary>
${previousSummaryText}
</previous-summary>

Update the structured summary with the new information. 
RULES:
- PRESERVE all existing information, constraints, and goals from the previous summary.
- ADD new progress, decisions, and context.
- UPDATE the Progress section: move items from "In Progress" to "Done" as they are completed.
- UPDATE "Next Steps" based strictly on the current state of the code.
- If a blocker was resolved, remove it from the "Blocked" list.
- PRESERVE exact file paths, function names, and error messages.

Use this EXACT format:

## Goal
[What is the user trying to accomplish? List multiple items if applicable.]

## Constraints & Preferences
- [Any rules, constraints, or preferences mentioned by the user]
- [Or "(none)" if none were mentioned]

## Progress
### Done
- [x] [Completed tasks, created files, or finalized changes]

### In Progress
- [ ] [The exact work that is currently underway]

### Blocked
- [Issues preventing progress, failing tests, or missing API keys]

## Key Decisions
- **[Decision]**: [Brief rationale on architectural or code choices]

## Next Steps
1. [Ordered list of exactly what December needs to do next to resume work]

## Critical Context
- [Any terminal outputs, specific error codes, or snippets needed to continue]

Keep each section concise. You MUST preserve exact file paths, function names, and error logs.`

    const userPrompt = `${historyText}\n\n${hasPreviousSummary ? UPDATE_SUMMARY_PROMPT : INITIAL_SUMMARY_PROMPT}`

    const compactionMessages: Message[] = [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
    ]
    let summary = ''

    const stream = llm.stream(compactionMessages as any, [], undefined, modelOptions)
    for await (const chunk of stream) {
        if (chunk.type === 'text') {
            summary += chunk.text
        }
    }

    const summaryMessage: Message = {
        role: 'system',
        content: `[COMPACTED HISTORY SUMMARY]\n${summary}`,
    }

    return [systemPrompt, summaryMessage, ...recentHistory]
}
