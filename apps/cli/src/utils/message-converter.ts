import { getToolSummary } from './formatters'

import type { MessageItem } from '@december/tui'

export function convertAgentMessagesToDifferentialMessages(messages: any[]): MessageItem[] {
    const result: MessageItem[] = []
    if (!messages || !Array.isArray(messages)) return result

    for (const msg of messages) {
        if (!msg || msg.role === 'system') continue

        if (msg.role === 'user') {
            let userText = msg.displayText || msg.content || ''
            if (
                !msg.displayText &&
                typeof userText === 'string' &&
                userText.startsWith('[Skill Invocation: /')
            ) {
                const match = userText.match(/^\[Skill Invocation: (\/[^\]]+)\]/)
                if (match) {
                    userText = match[1]
                }
            }
            result.push({
                role: 'user',
                content: typeof userText === 'string' ? userText : JSON.stringify(userText),
            })
        } else if (msg.role === 'assistant') {
            if (msg.thinking) {
                result.push({
                    role: 'thinking',
                    content: msg.thinking,
                    isStreaming: false,
                })
            }

            if (msg.toolCalls && Array.isArray(msg.toolCalls) && msg.toolCalls.length > 0) {
                for (const tc of msg.toolCalls) {
                    const toolMsg = messages.find(
                        (m: any) => m && m.role === 'tool' && m.toolCallId === tc.id
                    )
                    const inputStr =
                        typeof tc.input === 'string' ? tc.input : JSON.stringify(tc.input || {})
                    const hasError =
                        toolMsg &&
                        (toolMsg.content?.startsWith('Error executing tool:') ||
                            toolMsg.content?.startsWith('Tool execution blocked:') ||
                            (toolMsg.content?.startsWith('Tool ') &&
                                toolMsg.content?.endsWith(' not found.')))
                    result.push({
                        role: 'tool',
                        toolCall: {
                            id: tc.id,
                            name: tc.name,
                            command: getToolSummary(tc.name, inputStr),
                            status: hasError ? 'error' : 'success',
                            output: toolMsg?.content || '',
                        },
                    })
                }
            }

            if (msg.errorMessage) {
                result.push({
                    role: 'error',
                    content: msg.errorMessage,
                })
            } else if (msg.content) {
                result.push({
                    role: 'assistant',
                    content:
                        typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content),
                })
            }
        }
    }

    return result
}
