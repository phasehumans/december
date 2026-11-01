import { trimToolSchema } from './utils/schema-trimmer'

import type { Agent } from './agent'

export interface SideQuestionOptions {
    signal?: AbortSignal
    onChunk?: (text: string) => void
}

/**
 * Executes an ephemeral, single-turn query sharing the exact system prompt
 * and prompt cache prefix of the parent agent conversation.
 * Crucially, does NOT append messages to agent.messages or conversationManager,
 * ensuring zero pollution of working memory or persistent history.
 */
export async function runSideQuestion(
    agent: Agent,
    question: string,
    options?: SideQuestionOptions
): Promise<string> {
    if (!agent) {
        throw new Error('Agent instance is required for side question')
    }

    const trimmedQuestion = question.trim()
    if (!trimmedQuestion) {
        return ''
    }

    // 1. Recreate the exact cached tools array as used in main agent loop
    const activeTools = Array.from(agent.tools.values())
    const toolsArray = activeTools.map((t, idx) => ({
        name: t.name,
        description: t.description ? t.description.replace(/\s+/g, ' ').trim() : '',
        inputSchema: trimToolSchema(t.inputSchema),
        ...(idx === activeTools.length - 1 ? { cache_control: { type: 'ephemeral' } } : {}),
    }))

    // 2. Convert parent conversation history to LLM provider format
    const providerMessages = agent.convertToLlm(agent.messages) as any[]
    const messages = [...providerMessages]

    // 3. Replicate Anthropic/provider prompt cache breakpoint on the last user message
    if (messages.length > 0) {
        let lastUserIdx = -1
        for (let i = messages.length - 1; i >= 0; i--) {
            if (messages[i]?.role === 'user') {
                lastUserIdx = i
                break
            }
        }
        if (lastUserIdx !== -1 && messages[lastUserIdx]) {
            messages[lastUserIdx] = {
                ...messages[lastUserIdx],
                cache_control: { type: 'ephemeral' },
            }
        }
    }

    // 4. Append ephemeral side question turn
    messages.push({
        role: 'user',
        content: `[Side Question (ephemeral / by the way)]: ${trimmedQuestion}\n\nPlease provide a clear, well-structured explanation (roughly 5-8 lines or 2-3 focused bullet points) covering key concepts directly and helpfully based on the context so far. Do not use tools. Avoid one-line answers unless specifically requested.`,
    })

    // 5. Execute stream with thinking turned off for instantaneous response
    const providerModelOptions = {
        ...agent.modelOptions,
        thinkingLevel: 'off',
    }

    const generator = agent.llm.stream(
        messages,
        toolsArray,
        agent.systemPrompt,
        providerModelOptions,
        options?.signal
    )

    let fullAnswer = ''

    for await (const chunk of generator) {
        if (options?.signal?.aborted) {
            break
        }
        if (chunk.type === 'text') {
            fullAnswer += chunk.text
            if (options?.onChunk) {
                options.onChunk(chunk.text)
            }
        }
    }

    return fullAnswer
}
