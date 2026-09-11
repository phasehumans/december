import { MODEL_CONTEXT_WINDOWS } from '@december/providers'

import type { LLMProvider } from '@december/providers'
import type { Message, AgentMessage } from '@december/shared'

export const DEFAULT_MAX_TOKENS = 32000 // safe limit
export const PRUNE_PROTECT_TOKENS = 40_000
export const PRUNE_MINIMUM_SAVINGS = 15_000
export const PRUNE_PROTECTED_TOOLS = new Set(['skill'])

export interface PruneOptions {
    protectTokens?: number
    minSavings?: number
    protectedTools?: Set<string>
}

export function pruneToolResults(
    messages: (AgentMessage | Message)[],
    options?: PruneOptions
): {
    pruned: boolean
    tokensSaved: number
} {
    const protectTokens = options?.protectTokens ?? PRUNE_PROTECT_TOKENS
    const minSavings = options?.minSavings ?? PRUNE_MINIMUM_SAVINGS
    const protectedTools = options?.protectedTools ?? PRUNE_PROTECTED_TOOLS

    const toolCallMap = new Map<string, string>()
    for (const msg of messages) {
        if (msg.toolCalls) {
            for (const tc of msg.toolCalls) {
                if (tc.id && tc.name) {
                    toolCallMap.set(tc.id, tc.name)
                }
            }
        }
    }

    let totalToolTokens = 0
    let tokensToPrune = 0
    const indicesToPrune: number[] = []

    // Scan backwards, protecting recent turns
    let userTurns = 0
    for (let i = messages.length - 1; i >= 0; i--) {
        const msg = messages[i]
        if (!msg) continue

        if (msg.role === 'user') {
            userTurns++
        }
        if (userTurns < 2) {
            // Preserve last 2 user turns untouched
            continue
        }

        if (msg.role === 'tool') {
            const toolName =
                (msg.toolCallId ? toolCallMap.get(msg.toolCallId) : undefined) ||
                (msg as any).name ||
                ''
            if (protectedTools.has(toolName)) {
                continue
            }

            if (msg.content === '[Old tool result content cleared]') {
                continue
            }

            const outputText =
                typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)
            const tokenEstimate = Math.ceil(outputText.length / 4)
            totalToolTokens += tokenEstimate

            if (totalToolTokens > protectTokens) {
                tokensToPrune += tokenEstimate
                indicesToPrune.push(i)
            }
        }
    }

    if (tokensToPrune < minSavings) {
        return { pruned: false, tokensSaved: 0 }
    }

    for (const idx of indicesToPrune) {
        const target = messages[idx]
        if (target) {
            target.content = '[Old tool result content cleared]'
        }
    }

    return { pruned: true, tokensSaved: tokensToPrune }
}

export interface FileManifests {
    readFiles: string[]
    modifiedFiles: string[]
}

export function extractFileManifests(
    messages: (Message | AgentMessage)[],
    previousSummary?: string
): FileManifests {
    const readSet = new Set<string>()
    const modifiedSet = new Set<string>()

    if (previousSummary) {
        const readMatch = previousSummary.match(/<read-files>([\s\S]*?)<\/read-files>/)
        if (readMatch && readMatch[1]) {
            readMatch[1]
                .split('\n')
                .map((s) => s.trim())
                .filter(Boolean)
                .forEach((f) => readSet.add(f))
        }

        const modMatch = previousSummary.match(/<modified-files>([\s\S]*?)<\/modified-files>/)
        if (modMatch && modMatch[1]) {
            modMatch[1]
                .split('\n')
                .map((s) => s.trim())
                .filter(Boolean)
                .forEach((f) => modifiedSet.add(f))
        }
    }

    for (const msg of messages) {
        if (!msg.toolCalls) continue
        for (const tc of msg.toolCalls) {
            let parsedInput: any = {}
            if (typeof tc.input === 'string') {
                try {
                    parsedInput = JSON.parse(tc.input)
                } catch {
                    // Intentionally swallowed: tool call input was not valid JSON
                }
            } else if (tc.input && typeof tc.input === 'object') {
                parsedInput = tc.input
            }

            const rawPath =
                parsedInput.path ||
                parsedInput.filePath ||
                parsedInput.TargetFile ||
                parsedInput.AbsolutePath ||
                parsedInput.file

            if (typeof rawPath === 'string' && rawPath.trim().length > 0) {
                const targetPath = rawPath.trim()
                const toolName = tc.name.toLowerCase()

                if (
                    [
                        'write_file',
                        'write',
                        'write_to_file',
                        'edit_file',
                        'edit',
                        'edit_diff',
                        'replace_file_content',
                    ].includes(toolName)
                ) {
                    modifiedSet.add(targetPath)
                } else if (['read_file', 'read', 'view_file'].includes(toolName)) {
                    readSet.add(targetPath)
                }
            }
        }
    }

    // Partition: readFiles are read-only (not in modifiedFiles)
    for (const mod of modifiedSet) {
        readSet.delete(mod)
    }

    return {
        readFiles: Array.from(readSet).sort(),
        modifiedFiles: Array.from(modifiedSet).sort(),
    }
}

export function formatFileManifestsXml(manifests: FileManifests): string {
    const parts: string[] = []
    if (manifests.readFiles.length > 0) {
        parts.push(`<read-files>\n${manifests.readFiles.join('\n')}\n</read-files>`)
    }
    if (manifests.modifiedFiles.length > 0) {
        parts.push(`<modified-files>\n${manifests.modifiedFiles.join('\n')}\n</modified-files>`)
    }
    return parts.join('\n\n')
}

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
    modelOptions?: Record<string, any>,
    signal?: AbortSignal
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

    // trigger at 75% capacity
    if (currentTokens < limit * 0.75) {
        return messages
    }

    // always protect system prompt (index 0) and the last 20 messages (approx 10 turns)
    const PROTECTED_TAIL = 20

    if (messages.length <= PROTECTED_TAIL + 1) {
        return messages // not enough messages to compact
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

    const fileManifests = extractFileManifests(messagesToSummarize, previousSummaryText)

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

## File & Code State
- **Modified/Created Files**: [Exact absolute file paths touched or created]
- **Active Symbols & Line References**: [Key classes, functions, interfaces, or line ranges under active work]

## Key Decisions & Architecture
- **[Decision]**: [Brief rationale on architectural or code choices]

## Next Steps
1. [Ordered list of exactly what December needs to do next to resume work]

## Critical Context & Tracebacks
- [Exact terminal outputs, error messages, failing test tracebacks, or unexecuted plan steps needed to continue]

Keep each section concise. You MUST preserve exact file paths, function names, line numbers, and error logs.`

    const UPDATE_SUMMARY_PROMPT = `The messages above are NEW conversation messages that must be incorporated into the existing memory summary provided below:

<previous-summary>
${previousSummaryText}
</previous-summary>

Update the structured summary with the new information. 
RULES:
- PRESERVE all existing information, constraints, and goals from the previous summary.
- ADD new progress, decisions, file state, and critical context.
- UPDATE the Progress section: move items from "In Progress" to "Done" as they are completed.
- UPDATE "File & Code State": list all modified/created files and active symbols/line numbers.
- UPDATE "Next Steps" based strictly on the current state of the code.
- If a blocker was resolved, remove it from the "Blocked" list.
- PRESERVE exact file paths, function names, line numbers, and error messages.

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

## File & Code State
- **Modified/Created Files**: [Exact absolute file paths touched or created]
- **Active Symbols & Line References**: [Key classes, functions, interfaces, or line ranges under active work]

## Key Decisions & Architecture
- **[Decision]**: [Brief rationale on architectural or code choices]

## Next Steps
1. [Ordered list of exactly what December needs to do next to resume work]

## Critical Context & Tracebacks
- [Exact terminal outputs, error messages, failing test tracebacks, or unexecuted plan steps needed to continue]

Keep each section concise. You MUST preserve exact file paths, function names, line numbers, and error logs.`

    const userPrompt = `${historyText}\n\n${hasPreviousSummary ? UPDATE_SUMMARY_PROMPT : INITIAL_SUMMARY_PROMPT}`

    const compactionMessages: Message[] = [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
    ]
    let summary = ''

    const stream = llm.stream(compactionMessages as any, undefined, undefined, modelOptions, signal)
    for await (const chunk of stream) {
        if (signal?.aborted) throw new Error('Aborted')
        if (chunk.type === 'text') {
            summary += chunk.text
        }
    }

    let finalSummary = summary.trim()
    const xmlManifests = formatFileManifestsXml(fileManifests)
    if (xmlManifests) {
        if (!finalSummary.includes('<read-files>') && fileManifests.readFiles.length > 0) {
            finalSummary += `\n\n<read-files>\n${fileManifests.readFiles.join('\n')}\n</read-files>`
        }
        if (!finalSummary.includes('<modified-files>') && fileManifests.modifiedFiles.length > 0) {
            finalSummary += `\n\n<modified-files>\n${fileManifests.modifiedFiles.join('\n')}\n</modified-files>`
        }
    }

    const summaryMessage: Message = {
        role: 'system',
        content: `[COMPACTED HISTORY SUMMARY]\n${finalSummary}`,
    }

    return [systemPrompt, summaryMessage, ...recentHistory]
}
