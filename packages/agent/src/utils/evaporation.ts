import type { AgentMessage, Message } from '@december/shared'

export interface EvaporationOptions {
    preserveRecentTurns?: number
    preserveRecentSteps?: number
    maxOutputSize?: number
    headLines?: number
    tailLines?: number
}

export function isErrorToolOutput(content: string): boolean {
    const lower = content.toLowerCase()
    return (
        content.includes('[Tool Error]') ||
        lower.includes('error:') ||
        lower.includes('command failed') ||
        lower.includes('exit code 1') ||
        lower.includes('exit code 2') ||
        lower.includes('failed:') ||
        lower.includes('traceback (most recent call last)') ||
        lower.includes('exception:') ||
        lower.includes('fatal:') ||
        lower.includes('panic:') ||
        lower.includes('syntaxerror')
    )
}

export function truncateLargeToolOutput(
    rawContent: string,
    maxBytes: number = 6 * 1024,
    headLines: number = 20,
    tailLines: number = 20
): string {
    const byteLength = Buffer.byteLength(rawContent, 'utf8')
    if (byteLength <= maxBytes) {
        return rawContent
    }

    if (isErrorToolOutput(rawContent)) {
        return rawContent
    }

    const lines = rawContent.split('\n')
    if (lines.length <= headLines + tailLines) {
        return rawContent
    }

    const head = lines.slice(0, headLines).join('\n')
    const tail = lines.slice(lines.length - tailLines).join('\n')
    const omittedLines = lines.length - headLines - tailLines
    const omittedBytes =
        byteLength - Buffer.byteLength(head, 'utf8') - Buffer.byteLength(tail, 'utf8')
    const omittedKb = (omittedBytes / 1024).toFixed(1)

    const banner = `\n\n[... ${omittedLines} lines truncated (${omittedKb} KB) ...]\n\n`
    return head + banner + tail
}

/**
 * Deterministically evaporates bulky tool results older than recent turns/steps into 1-line tombstones,
 * preserving 100% of user prompts and assistant thoughts/reasoning while saving context window space.
 */
export function evaporateStaleToolOutputs(
    messages: (AgentMessage | Message)[],
    preserveRecentTurnsOrOptions: number | EvaporationOptions = 3,
    preserveRecentStepsArg?: number
): Message[] {
    if (!messages || messages.length === 0) return []

    let preserveRecentTurns = 3
    let preserveRecentSteps = 2
    let maxOutputSize = 6 * 1024
    let headLines = 20
    let tailLines = 20

    if (typeof preserveRecentTurnsOrOptions === 'number') {
        preserveRecentTurns = preserveRecentTurnsOrOptions
        if (preserveRecentStepsArg !== undefined) {
            preserveRecentSteps = preserveRecentStepsArg
        }
    } else if (typeof preserveRecentTurnsOrOptions === 'object') {
        preserveRecentTurns = preserveRecentTurnsOrOptions.preserveRecentTurns ?? 3
        preserveRecentSteps = preserveRecentTurnsOrOptions.preserveRecentSteps ?? 2
        maxOutputSize = preserveRecentTurnsOrOptions.maxOutputSize ?? 6 * 1024
        headLines = preserveRecentTurnsOrOptions.headLines ?? 20
        tailLines = preserveRecentTurnsOrOptions.tailLines ?? 20
    }

    // Determine staleness per message by scanning backwards.
    // A tool message is considered recent if it is within BOTH the recent turns threshold
    // and the recent agent steps threshold.
    let userTurnsSeen = 0
    let agentStepsSeen = 0
    const isStale = new Array<boolean>(messages.length).fill(false)

    for (let i = messages.length - 1; i >= 0; i--) {
        const msg = messages[i]
        if (!msg) continue

        if (msg.role === 'user' && !(msg as AgentMessage).isUI) {
            userTurnsSeen++
        }
        if (msg.role === 'assistant' && (msg.toolCalls?.length || 0) > 0) {
            agentStepsSeen++
        }

        // If either threshold has been met or exceeded, older messages are stale
        if (userTurnsSeen >= preserveRecentTurns || agentStepsSeen >= preserveRecentSteps) {
            isStale[i] = true
        }
    }

    return messages.map((msg, idx) => {
        const baseMsg: Message = {
            role: msg.role,
            content: msg.content,
            thinking: msg.thinking,
            toolCalls: msg.toolCalls,
            toolCallId: msg.toolCallId,
        }

        if (msg.role !== 'tool') {
            return baseMsg
        }

        const rawContent =
            typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)

        // Keep small tool outputs untouched
        if (rawContent.length < 200) {
            return baseMsg
        }

        // If it contains an error or failure, preserve full diagnostic text
        if (isErrorToolOutput(rawContent)) {
            return baseMsg
        }

        // Already evaporated or cleared
        if (
            rawContent.startsWith('[Tool Output Evaporated:') ||
            rawContent.startsWith('[tool output microcompacted:') ||
            rawContent.startsWith('[Old tool result content cleared]')
        ) {
            return baseMsg
        }

        // If stale (older than preserveRecentSteps or preserveRecentTurns), evaporate to tombstone
        if (isStale[idx]) {
            const lines = rawContent.split('\n')
            const lineCount = lines.length
            const byteSize = (Buffer.byteLength(rawContent, 'utf8') / 1024).toFixed(1)
            const tombstone = `[Tool Output Evaporated: ${lineCount} lines (${byteSize} KB). exit code 0. Content previously processed by assistant.]`
            return {
                ...baseMsg,
                content: tombstone,
            }
        }

        // If recent, check if it exceeds size threshold and truncate head/tail
        const truncated = truncateLargeToolOutput(rawContent, maxOutputSize, headLines, tailLines)
        if (truncated !== rawContent) {
            return {
                ...baseMsg,
                content: truncated,
            }
        }

        return baseMsg
    })
}
