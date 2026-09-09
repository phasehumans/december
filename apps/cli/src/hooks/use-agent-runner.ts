import { parseError, ErrorParseContext } from '../utils/error-parser'
import { getToolSummary } from '../utils/formatters'

import type { Message, MessageBlock } from '@december/tui'

let msgIdCounter = 0
export function getNextMsgId(): string {
    return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}-${++msgIdCounter}`
}

export function convertAgentMessagesToTuiMessages(messages: any[]): Message[] {
    const resumedMessages: Message[] = []
    for (const msg of messages) {
        if (msg.role === 'user') {
            let userText = msg.displayText || msg.content
            if (!msg.displayText && userText.startsWith('[Skill Invocation: /')) {
                const match = userText.match(/^\[Skill Invocation: (\/[^\]]+)\]/)
                if (match) {
                    userText = match[1]
                }
            }
            resumedMessages.push({ id: getNextMsgId(), role: 'user', text: userText })
        } else if (msg.role === 'assistant') {
            const blocks: MessageBlock[] = []

            if (msg.thinking) {
                blocks.push({ type: 'thinking', content: msg.thinking })
            }

            if (msg.toolCalls && msg.toolCalls.length > 0) {
                for (const tc of msg.toolCalls) {
                    const toolMsg = messages.find(
                        (m: any) => m.role === 'tool' && m.toolCallId === tc.id
                    )
                    const inputStr =
                        typeof tc.input === 'string' ? tc.input : JSON.stringify(tc.input)
                    const hasError =
                        toolMsg &&
                        (toolMsg.content.startsWith('Error executing tool:') ||
                            toolMsg.content.startsWith('Tool execution blocked:') ||
                            (toolMsg.content.startsWith('Tool ') &&
                                toolMsg.content.endsWith(' not found.')))
                    blocks.push({
                        type: 'command',
                        toolCallId: tc.id,
                        toolName: tc.name,
                        toolInput: inputStr,
                        command: getToolSummary(tc.name, inputStr),
                        status: hasError ? 'error' : 'success',
                        output: toolMsg?.content || '',
                    })
                }
            }

            if (msg.errorMessage) {
                const parsed = parseError({ message: msg.errorMessage })
                blocks.push({
                    type: 'error',
                    error: parsed.message,
                    cause: parsed.cause,
                    hint: parsed.hint,
                })
            } else if (msg.content) {
                blocks.push({ type: 'text', content: msg.content })
            }

            if (blocks.length > 0) {
                const lastResumed = resumedMessages[resumedMessages.length - 1]
                if (lastResumed && lastResumed.role === 'assistant' && lastResumed.blocks) {
                    lastResumed.blocks.push(...blocks)
                } else {
                    resumedMessages.push({
                        id: getNextMsgId(),
                        role: 'assistant',
                        blocks,
                    })
                }
            }
        }
    }
    return resumedMessages
}

const isStatusMessage = (content: string) =>
    content === 'Thinking...' ||
    content === 'Searching...' ||
    content === 'Reading...' ||
    content === 'Planning...' ||
    content === 'Coding...' ||
    content === 'Executing...' ||
    content === 'Testing...' ||
    content === 'Verifying...' ||
    content === 'Refining...' ||
    content === 'Finalizing...' ||
    content === 'Working...' ||
    content === 'Preparing...' ||
    content === 'Compacting...' ||
    content === 'Generating...' ||
    content === 'Analyzing...' ||
    content === 'Analyzing prompt...' ||
    content === 'Generating questions...' ||
    content === 'Understanding...' ||
    content.startsWith('Preparing') ||
    content.startsWith('Rate limit') ||
    content.startsWith('High demand') ||
    content.startsWith('LLM Provider rate limit') ||
    content.startsWith('LLM Provider high demand')

export async function processAgentStream({
    stream,
    setActiveMessages,
    assistantMsgId,
    context,
}: {
    stream: any
    setActiveMessages: any
    assistantMsgId: string | number
    context?: ErrorParseContext
}) {
    let pendingEvents: any[] = []
    let flushTimeout: NodeJS.Timeout | null = null

    const flush = () => {
        if (pendingEvents.length === 0) return

        const eventsToProcess = [...pendingEvents]
        pendingEvents = []

        setActiveMessages((prev: Message[]) =>
            prev.map((msg) => {
                if (msg.id !== assistantMsgId) return msg
                const blocks = [...(msg.blocks || [])]
                let finalMsg = { ...msg }

                for (const event of eventsToProcess) {
                    switch (event.type) {
                        case 'TurnStart':
                            blocks.push({ type: 'text', content: 'Thinking...' })
                            break
                        case 'AgentError': {
                            const lastBlock = blocks[blocks.length - 1]
                            if (
                                lastBlock &&
                                (lastBlock.type === 'thinking' ||
                                    (lastBlock.type === 'text' &&
                                        isStatusMessage(lastBlock.content)))
                            ) {
                                blocks.pop()
                            }
                            const parsed = parseError({ message: event.error }, context)
                            blocks.push({
                                type: 'error',
                                error: parsed.message,
                                cause: parsed.cause,
                                hint: parsed.hint,
                            })
                            break
                        }
                        case 'AgentInterrupt': {
                            const lastBlock = blocks[blocks.length - 1]
                            if (
                                lastBlock &&
                                lastBlock.type === 'text' &&
                                isStatusMessage(lastBlock.content)
                            ) {
                                lastBlock.content = ''
                            }
                            blocks.push({ type: 'interrupt' })
                            break
                        }
                        case 'AgentStatus': {
                            const isRetryStatus =
                                event.message?.startsWith('LLM Provider') ||
                                event.message?.startsWith('Rate limit') ||
                                event.message?.startsWith('High demand')
                            const color = isRetryStatus ? '#FCA5A5' : undefined

                            const statusBlock = blocks[blocks.length - 1]
                            if (
                                statusBlock &&
                                statusBlock.type === 'text' &&
                                isStatusMessage(statusBlock.content)
                            ) {
                                statusBlock.content = event.message || 'Working...'
                                if (color) statusBlock.color = color
                            } else if (event.message) {
                                blocks.push({ type: 'text', content: event.message, color })
                            }
                            break
                        }
                        case 'ContextCompacted': {
                            blocks.push({ type: 'compaction', summary: event.summary })
                            break
                        }
                        case 'StreamChunk': {
                            if (!event.content) break
                            const lastBlock = blocks[blocks.length - 1]
                            if (lastBlock && lastBlock.type === 'text') {
                                const wasStatus = isStatusMessage(lastBlock.content)
                                lastBlock.content =
                                    (wasStatus ? '' : lastBlock.content) + event.content
                                if (wasStatus) {
                                    delete lastBlock.color
                                }
                            } else {
                                blocks.push({ type: 'text', content: event.content })
                            }
                            break
                        }
                        case 'ThinkingChunk': {
                            const chunk = event.content || ''
                            if (!chunk) break
                            const lastBlock = blocks[blocks.length - 1]
                            if (lastBlock && lastBlock.type === 'thinking') {
                                lastBlock.content += chunk
                            } else {
                                if (
                                    lastBlock &&
                                    lastBlock.type === 'text' &&
                                    isStatusMessage(lastBlock.content)
                                ) {
                                    blocks.pop()
                                }
                                blocks.push({ type: 'thinking', content: chunk })
                            }
                            break
                        }
                        case 'ToolCallStart': {
                            const lastBlock = blocks[blocks.length - 1]
                            if (
                                lastBlock &&
                                lastBlock.type === 'text' &&
                                isStatusMessage(lastBlock.content)
                            ) {
                                blocks.pop()
                            }
                            blocks.push({
                                type: 'command',
                                toolCallId: event.toolCall.id,
                                toolName: event.toolCall.name,
                                toolInput: event.toolCall.input,
                                command: getToolSummary(event.toolCall.name, event.toolCall.input),
                                status: 'running',
                                output: '',
                            })
                            break
                        }
                        case 'ToolExecutionUpdate': {
                            const runningCmd = blocks.find(
                                (b: any) =>
                                    b.type === 'command' && b.toolCallId === event.toolCallId
                            ) as any
                            if (runningCmd && runningCmd.status === 'running') {
                                runningCmd.output += event.chunk
                            }
                            break
                        }
                        case 'ToolCallResult': {
                            const lastCmd = blocks.find(
                                (b: any) =>
                                    b.type === 'command' && b.toolCallId === event.result.toolCallId
                            ) as any
                            if (lastCmd) {
                                lastCmd.status = event.result.error ? 'error' : 'success'
                                lastCmd.output = event.result.error || event.result.result
                            }
                            break
                        }
                        case 'AgentUsage': {
                            finalMsg = {
                                ...finalMsg,
                                usage: {
                                    promptTokens: (event as any).promptTokens,
                                    completionTokens: (event as any).completionTokens,
                                },
                            } as any
                            break
                        }
                    }
                }
                return { ...finalMsg, blocks }
            })
        )
    }

    const FRAME_BUDGET_MS = 33 // ~30 FPS frame budget for terminal rendering

    for await (const event of stream) {
        pendingEvents.push(event)

        const isImmediateEvent =
            event.type === 'TurnStart' ||
            event.type === 'AgentError' ||
            event.type === 'AgentInterrupt' ||
            event.type === 'ToolCallStart' ||
            event.type === 'ToolCallResult'

        if (isImmediateEvent) {
            if (flushTimeout) {
                clearTimeout(flushTimeout)
                flushTimeout = null
            }
            flush()
        } else if (!flushTimeout) {
            flushTimeout = setTimeout(() => {
                flush()
                flushTimeout = null
            }, FRAME_BUDGET_MS)
        }
    }

    if (flushTimeout) {
        clearTimeout(flushTimeout)
    }
    flush()

    setActiveMessages((prev: Message[]) =>
        prev.map((msg) => {
            if (msg.id !== assistantMsgId) return msg
            const blocks = (msg.blocks || []).filter(
                (b) => !(b.type === 'text' && isStatusMessage(b.content))
            )
            return { ...msg, blocks }
        })
    )
}
