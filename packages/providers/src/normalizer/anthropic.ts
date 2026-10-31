import { safeParseJson } from '@december/shared'

import { toCanonicalMessages } from './canonical.ts'

import type { Message } from '../types.ts'
import type { AnthropicNormalizeOptions, CanonicalMessage } from './types.ts'
import type Anthropic from '@anthropic-ai/sdk'

export function normalizeForAnthropic(
    messages: (Message | CanonicalMessage | any)[],
    options?: AnthropicNormalizeOptions
): Anthropic.MessageParam[] {
    const canonical = toCanonicalMessages(messages)
    const antMessages: Anthropic.MessageParam[] = []
    const resolvedSystemPrompt = options?.systemPrompt

    let i = 0
    while (i < canonical.length) {
        const msg = canonical[i]!

        if (msg.role === 'system') {
            // Omit root system prompt if already supplied or at start
            if (msg.content === resolvedSystemPrompt || (i === 0 && !resolvedSystemPrompt)) {
                i++
                continue
            }
            // Mid-conversation system prompt (e.g. compaction summary) -> map to user message
            const prev = antMessages[antMessages.length - 1]
            if (prev && prev.role === 'user' && Array.isArray(prev.content)) {
                prev.content.push({ type: 'text', text: msg.content || '' })
            } else {
                antMessages.push({
                    role: 'user',
                    content: [{ type: 'text', text: msg.content || '' }],
                })
            }
            i++
            continue
        }

        if (msg.role === 'assistant') {
            const contentBlocks: Anthropic.ContentBlockParam[] = []

            // Thinking block handling:
            // When thinking is disabled for the target model (e.g. Claude 3.5 Sonnet),
            // strip thinking blocks to prevent 400 Bad Request errors.
            // When thinking is enabled/supported, pass thinking block with optional signature.
            if (options?.thinkingEnabled !== false && msg.thinking?.text) {
                const thoughtBlock: any = {
                    type: 'thinking',
                    thinking: msg.thinking.text,
                }
                if (msg.thinking.signature) {
                    thoughtBlock.signature = msg.thinking.signature
                }
                contentBlocks.push(thoughtBlock)
            } else if (options?.preserveThinkingAsText && msg.thinking?.text) {
                contentBlocks.push({
                    type: 'text',
                    text: `<thought>\n${msg.thinking.text}\n</thought>`,
                })
            }

            if (msg.content && msg.content.length > 0) {
                contentBlocks.push({ type: 'text', text: msg.content })
            }

            if (msg.toolCalls && msg.toolCalls.length > 0) {
                for (const tc of msg.toolCalls) {
                    const inputObj =
                        typeof tc.input === 'object' && tc.input !== null
                            ? tc.input
                            : safeParseJson(tc.input) || {}

                    contentBlocks.push({
                        type: 'tool_use',
                        id: tc.id,
                        name: tc.name,
                        input: inputObj,
                    })
                }
            }

            if (contentBlocks.length === 0) {
                contentBlocks.push({ type: 'text', text: '(empty response)' })
            }

            antMessages.push({
                role: 'assistant',
                content: contentBlocks,
            })
            i++
            continue
        }

        if (msg.role === 'tool') {
            // Collect all contiguous tool results
            const toolResultBlocks: Anthropic.ToolResultBlockParam[] = []
            while (i < canonical.length && canonical[i]!.role === 'tool') {
                const tr = canonical[i]!
                toolResultBlocks.push({
                    type: 'tool_result',
                    tool_use_id: tr.toolCallId || 'unknown_tool_use_id',
                    content: tr.content || '',
                })
                i++
            }

            antMessages.push({
                role: 'user',
                content: toolResultBlocks,
            })
            continue
        }

        // Standard user message
        const userText = msg.content || ''
        const prev = antMessages[antMessages.length - 1]
        if (prev && prev.role === 'user' && Array.isArray(prev.content)) {
            prev.content.push({ type: 'text', text: userText })
        } else {
            antMessages.push({
                role: 'user',
                content: [{ type: 'text', text: userText }],
            })
        }
        i++
    }

    return antMessages
}
