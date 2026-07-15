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
    maxTokens: number = DEFAULT_MAX_TOKENS,
    modelOptions?: Record<string, any>
): Promise<Message[]> {
    const currentTokens = estimateTokens(messages)

    // Trigger at 80% capacity
    if (currentTokens < maxTokens * 0.8) {
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

    const historyText = middleHistory
        .map((m) => {
            let txt = `[${m.role.toUpperCase()}]: ${m.content}`
            if (m.toolCalls) {
                txt += `\n[TOOL CALLS]: ${JSON.stringify(m.toolCalls)}`
            }
            return txt
        })
        .join('\n\n')

    // Attempt to summarize using the current LLM
    // In a full implementation, we might hardcode a cheaper model like gpt-4o-mini here
    const summaryPrompt = `Summarize the following conversation history. Focus on:
1. The user's original goal.
2. The progress made so far.
3. Any important context, decisions, or roadblocks encountered.
Keep it concise but detailed enough for an AI to resume work.

HISTORY:
${historyText}`

    const compactionMessages: Message[] = [{ role: 'user', content: summaryPrompt }]
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
