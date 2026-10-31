import { toCanonicalMessages } from './canonical.ts'

import type { Message } from '../types.ts'
import type { CanonicalMessage, OpenAINormalizeOptions } from './types.ts'
import type OpenAI from 'openai'

export function normalizeForOpenAI(
    messages: (Message | CanonicalMessage | any)[],
    options?: OpenAINormalizeOptions
): OpenAI.Chat.ChatCompletionMessageParam[] {
    const canonical = toCanonicalMessages(messages)
    const oaiMessages: OpenAI.Chat.ChatCompletionMessageParam[] = []
    const resolvedModel = (options?.model || 'gpt-4o').toLowerCase()

    // Determine tool and reasoning support
    const supportsTools =
        options?.supportsTools !== undefined
            ? options.supportsTools
            : !resolvedModel.includes('deepseek-reasoner') && !resolvedModel.includes('deepseek-r1')

    const supportsReasoning =
        options?.supportsReasoning !== undefined
            ? options.supportsReasoning
            : resolvedModel.includes('deepseek-reasoner') ||
              resolvedModel.includes('deepseek-r1') ||
              resolvedModel.includes('o1') ||
              resolvedModel.includes('o3')

    const effectiveSystemPrompt =
        options?.systemPrompt ||
        (canonical[0]?.role === 'system' ? canonical[0].content : undefined)

    if (effectiveSystemPrompt) {
        oaiMessages.push({ role: 'system', content: effectiveSystemPrompt })
    }

    let i = 0
    while (i < canonical.length) {
        const msg = canonical[i]!

        if (msg.role === 'system') {
            if (msg.content === effectiveSystemPrompt && i === 0) {
                i++
                continue
            }
            if (msg.content?.includes('[COMPACTED HISTORY SUMMARY]')) {
                oaiMessages.push({
                    role: 'user',
                    content: msg.content,
                })
            } else {
                oaiMessages.push({
                    role: 'system',
                    content: msg.content || '',
                })
            }
            i++
            continue
        }

        if (msg.role === 'assistant') {
            if (!supportsTools && msg.toolCalls && msg.toolCalls.length > 0) {
                // Synthesize tool calls into assistant text for models without tool support (like DeepSeek Reasoner)
                let text = msg.content || ''
                for (const tc of msg.toolCalls) {
                    const argStr =
                        typeof tc.input === 'string' ? tc.input : JSON.stringify(tc.input)
                    text += `\n[Tool Call: ${tc.name}(${argStr})]`
                }
                const asstMsg: any = {
                    role: 'assistant',
                    content: text.trim(),
                }
                if (supportsReasoning && msg.thinking?.text) {
                    asstMsg.reasoning_content = msg.thinking.text
                }
                oaiMessages.push(asstMsg)
            } else {
                const asstMsg: any = {
                    role: 'assistant',
                    content: msg.content !== undefined ? msg.content : '',
                }

                if (supportsReasoning && msg.thinking?.text) {
                    asstMsg.reasoning_content = msg.thinking.text
                }

                if (msg.toolCalls && msg.toolCalls.length > 0) {
                    asstMsg.tool_calls = msg.toolCalls.map((tc) => ({
                        id: tc.id,
                        type: 'function',
                        function: {
                            name: tc.name,
                            arguments:
                                typeof tc.input === 'string'
                                    ? tc.input
                                    : JSON.stringify(tc.input || {}),
                        },
                    }))
                }

                oaiMessages.push(asstMsg)
            }
            i++
            continue
        }

        if (msg.role === 'tool') {
            if (!supportsTools) {
                // Synthesize tool results into user text for models without tool support
                let combinedResultText = ''
                while (i < canonical.length && canonical[i]!.role === 'tool') {
                    const tr = canonical[i]!
                    combinedResultText += `\n[Tool Result for ${tr.toolName || tr.toolCallId}]: ${tr.content || ''}`
                    i++
                }
                oaiMessages.push({
                    role: 'user',
                    content: combinedResultText.trim(),
                })
                continue
            }

            oaiMessages.push({
                role: 'tool',
                tool_call_id: msg.toolCallId || 'call_unknown',
                content: msg.content || '',
            })
            i++
            continue
        }

        // Standard user message
        oaiMessages.push({
            role: 'user',
            content: msg.content || '',
        })
        i++
    }

    return oaiMessages
}
