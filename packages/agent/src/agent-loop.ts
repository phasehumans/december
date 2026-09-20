import util from 'util'

import { supportsModelThinking } from '@december/providers'
import {
    safeParseJson,
    formatInsufficientCreditsNotice,
    formatRateLimitNotice,
    getCleanProviderDisplayName,
} from '@december/shared'
import pRetry, { AbortError } from 'p-retry'

import { Agent } from './agent'
import { createRequestLogEntry, appendTurnLog } from './utils/request-logger'
import { trimToolSchema } from './utils/schema-trimmer'

import type { AgentEvent, AgentMessage, ToolCall, ToolResult } from '@december/shared'

export function getAdaptiveThinkingLevel(
    messages: AgentMessage[],
    configuredLevel?: string
): 'auto' | 'off' | 'minimal' | 'low' | 'medium' | 'high' {
    const userMsgs = messages.filter((m) => m.role === 'user' && !m.isUI)
    if (userMsgs.length === 0) return 'off'
    const lastUserMsg = userMsgs[userMsgs.length - 1]
    if (!lastUserMsg || typeof lastUserMsg.content !== 'string') return 'off'

    const text = lastUserMsg.content.trim()
    if (!text) return 'off'

    // Tier 1: Off for Slash commands and simple greetings
    if (text.startsWith('/')) return 'off'

    const lower = text.toLowerCase()
    const simpleGreetings = [
        'hi',
        'hello',
        'hey',
        'thanks',
        'thank you',
        'yes',
        'no',
        'ok',
        'okay',
        'bye',
        'who are you',
        'what can you do',
        'ping',
        'status',
        'help',
    ]

    if (
        simpleGreetings.includes(lower) ||
        (text.length < 15 && !text.includes('```') && !text.includes('\n'))
    ) {
        return 'off'
    }

    // Tier 2: Minimal for simple lookups / read-only questions without code edits
    const isLookup = /^(read|view|show|find|search|list|check|where|what is|how to)\b/i.test(text)
    if (
        isLookup &&
        text.length < 100 &&
        !text.includes('```') &&
        !text.includes('fix') &&
        !text.includes('refactor')
    ) {
        return 'minimal'
    }

    // Tier 4: High for explicit refactoring, multi-file changes, or complex debugging
    const isHeavy = /\b(refactor|debug|architect|rewrite|migrate|fix tests?|fix error)\b/i.test(
        text
    )
    if (isHeavy || text.length > 300) {
        return 'high'
    }

    // Tier 3: Auto (or configured default) for standard code edits
    return (configuredLevel as any) || 'auto'
}

export function isSimpleConversationalTurn(messages: AgentMessage[]): boolean {
    return getAdaptiveThinkingLevel(messages) === 'off'
}

class AsyncQueue<T> {
    private queue: T[] = []
    private resolvers: ((value: IteratorResult<T>) => void)[] = []
    private isEnded = false

    push(item: T) {
        if (this.resolvers.length > 0) {
            const resolve = this.resolvers.shift()!
            resolve({ value: item, done: false })
        } else {
            this.queue.push(item)
        }
    }

    end() {
        this.isEnded = true
        while (this.resolvers.length > 0) {
            const resolve = this.resolvers.shift()!
            resolve({ value: undefined, done: true })
        }
    }

    async *[Symbol.asyncIterator]() {
        while (true) {
            if (this.queue.length > 0) {
                yield this.queue.shift()!
            } else if (this.isEnded) {
                break
            } else {
                const result = await new Promise<IteratorResult<T>>((resolve) => {
                    this.resolvers.push(resolve)
                })
                if (result.done) break
                yield result.value
            }
        }
    }
}

function formatError(e: any): string {
    if (!e) return 'Unknown error'
    if (typeof e === 'string') return e
    if (e.originalError) return formatError(e.originalError) // p-retry aborterror

    // First, check if e has a direct message or error message property before looking at cause
    const directMessage = e.error?.error?.message || e.error?.message || e.message
    if (directMessage && typeof directMessage === 'string' && directMessage.trim()) {
        try {
            const parsedMessage = safeParseJson(directMessage)
            if (parsedMessage && typeof parsedMessage === 'object') {
                if (typeof parsedMessage.error?.message === 'string')
                    return parsedMessage.error.message
                if (typeof parsedMessage.message === 'string') return parsedMessage.message
                if (typeof parsedMessage.error === 'string') return parsedMessage.error
            }
        } catch {
            // not json
        }
        return directMessage
    }

    if (e.cause && e.cause !== e) {
        const formattedCause = formatError(e.cause)
        if (
            formattedCause &&
            formattedCause !== 'Unknown error' &&
            formattedCause !== '{}' &&
            formattedCause !== '{\n}' &&
            formattedCause !== '[object Object]'
        ) {
            return formattedCause
        }
    }

    // ensure we capture the raw response data if available (axios/fetch style)
    const rawData = e.response?.data || e.error || e

    try {
        const json = JSON.stringify(rawData, null, 2)
        if (
            json &&
            json !== '{}' &&
            json !== '""' &&
            json !== '{\n  "cause": {}\n}' &&
            json !== '{"cause":{}}'
        )
            return json
    } catch {
        // Fall back to util.inspect
    }

    try {
        const inspected = util.inspect(rawData, { depth: 4 })
        if (
            inspected &&
            inspected !== '{}' &&
            inspected !== '{ cause: {} }' &&
            inspected !== '[object Object]'
        )
            return inspected
    } catch {
        // Fall back to String conversion
    }

    return String(e) || 'Unknown error'
}

export type AgentLoopInput =
    | string
    | {
          content: string
          displayText?: string
          readOnly?: boolean
      }

export interface AgentLoopOptions {
    readOnly?: boolean
}

export const READ_ONLY_TOOLS = new Set([
    'read_file',
    'ls',
    'find_files',
    'grep_search',
    'web_search',
    'browser',
    'ask_question',
])

export async function* runAgentLoop(
    agent: Agent,
    userInput?: AgentLoopInput,
    options?: AgentLoopOptions
): AsyncGenerator<AgentEvent, void, unknown> {
    const eventQueue = new AsyncQueue<AgentEvent>()
    const abortController = new AbortController()
    agent.activeAbortController = abortController

    const isReadOnly = Boolean(
        options?.readOnly ||
        (typeof userInput === 'object' && userInput !== null && userInput.readOnly)
    )

    if (userInput) {
        if (typeof userInput === 'string') {
            agent.addMessage({ role: 'user', content: userInput })
        } else {
            agent.addMessage({
                role: 'user',
                content: userInput.content,
                displayText: userInput.displayText,
            })
        }
        await agent.saveContext()
    }
    ;(async () => {
        try {
            try {
                agent.tracer?.startSession(agent.sessionId, {
                    workspaceDir: agent.workspaceDir,
                    model: agent.modelOptions?.model,
                    thinkingLevel: agent.thinkingLevel,
                })
            } catch {
                // Intentionally swallowed: Telemetry start session must not disrupt agent loop
            }

            eventQueue.push({ type: 'AgentStart' })
            await runOuterLoop(agent, eventQueue, abortController.signal as any, {
                readOnly: isReadOnly,
            })

            try {
                if (abortController.signal.aborted) {
                    agent.tracer?.endSession('ABORTED')
                } else {
                    agent.tracer?.endSession('COMPLETED')
                }
            } catch {
                // Intentionally swallowed: Telemetry end session must not disrupt agent loop
            }
            eventQueue.push({ type: 'AgentEnd' })
        } catch (e: any) {
            console.error('Agent Loop Error:', e)
            const errMsg = formatError(e)
            for (let i = agent.messages.length - 1; i >= 0; i--) {
                const m = agent.messages[i]
                if (m && m.role === 'user' && !m.isUI) {
                    m.isUI = true
                    break
                }
            }
            await agent.saveContext().catch(() => {
                // Intentionally swallowed: Context save error fallback on error
            })
            try {
                if (abortController.signal.aborted) {
                    agent.tracer?.endSession('ABORTED')
                } else {
                    agent.tracer?.endSession('FAILED', errMsg)
                }
            } catch {
                // Intentionally swallowed: Telemetry end session must not disrupt agent loop
            }
            eventQueue.push({ type: 'AgentError', error: errMsg })
            eventQueue.push({ type: 'AgentEnd' })
        } finally {
            agent.activeAbortController = undefined
            if (agent.tracer) {
                // Detached non-blocking flush in background to ensure zero stream termination latency
                agent.tracer.flush().catch(() => {
                    // Intentionally swallowed: Detached telemetry flush error fallback
                })
            }
            eventQueue.end()
        }
    })()

    yield* eventQueue
}

async function runOuterLoop(
    agent: Agent,
    eventQueue: AsyncQueue<AgentEvent>,
    signal: AbortSignal,
    options?: { readOnly?: boolean }
) {
    while (!signal.aborted) {
        // run inner loop for turns
        await runInnerLoop(agent, eventQueue, signal, options)

        if (signal.aborted) break

        // follow up queue
        if (agent.followUpQueue.length > 0) {
            const msgs = agent.followUpQueue.drain()
            for (const msg of msgs) {
                agent.addMessage(msg)
            }
            continue // loop again with new messages
        }

        break
    }
}

async function runInnerLoop(
    agent: Agent,
    eventQueue: AsyncQueue<AgentEvent>,
    signal: AbortSignal,
    options?: { readOnly?: boolean }
) {
    let isDone = false
    let turnCount = 0

    while (!isDone && turnCount < 100 && !signal.aborted) {
        turnCount++

        try {
            agent.tracer?.startTurn(turnCount)
        } catch {
            // Intentionally swallowed: Telemetry start turn must not disrupt agent loop
        }

        // handle steering messages
        if (agent.hooks?.getSteeringMessages) {
            const steeringMessages = await agent.hooks.getSteeringMessages()
            for (const msg of steeringMessages) {
                agent.steer(msg)
            }
        }
        if (agent.steeringQueue.length > 0) {
            const msgs = agent.steeringQueue.drain()
            for (const msg of msgs) {
                agent.addMessage(msg)
            }
        }

        eventQueue.push({ type: 'TurnStart' })

        // stream assistant response
        const { assistantMessage, toolCalls, error } = await streamAssistantResponse(
            agent,
            eventQueue,
            signal,
            turnCount,
            options
        )

        if (error || signal.aborted) {
            break
        }

        if (toolCalls.length === 0) {
            agent.addMessage({ role: 'assistant', content: assistantMessage })
            isDone = true
        } else {
            agent.addMessage({
                role: 'assistant',
                content: assistantMessage,
                toolCalls: toolCalls,
            })

            // execute tools
            await executeToolCalls(agent, toolCalls, eventQueue, signal, options)
        }

        await agent.saveContext()
        eventQueue.push({ type: 'TurnEnd' })

        try {
            agent.tracer?.endTurn(turnCount)
        } catch {
            // Intentionally swallowed: Telemetry end turn must not disrupt agent loop
        }

        if (agent.hooks?.prepareNextTurn) {
            const nextTurn = (await agent.hooks.prepareNextTurn()) as any
            if (nextTurn?.modelOptions)
                agent.modelOptions = { ...agent.modelOptions, ...nextTurn.modelOptions }
            if (nextTurn?.systemPrompt) agent.systemPrompt = nextTurn.systemPrompt
        }

        if (agent.hooks?.shouldStopAfterTurn) {
            const shouldStop = await agent.hooks.shouldStopAfterTurn()
            if (shouldStop) isDone = true
        }
    }
}

function getToolStatusMessage(toolName: string): string {
    if (toolName === 'read_file' || toolName === 'view_file') return 'Reading...'
    if (toolName === 'write_file' || toolName === 'write_to_file') return 'Writing...'
    if (
        toolName === 'edit_file' ||
        toolName === 'edit_diff' ||
        toolName === 'replace_file_content' ||
        toolName === 'multi_replace_file_content'
    )
        return 'Modifying...'
    if (toolName === 'run_command' || toolName === 'bash') return 'Executing...'
    if (toolName === 'search_web') return 'Searching web...'
    if (toolName === 'list_dir') return 'Listing directory...'
    if (toolName === 'find_files' || toolName === 'grep_search') return 'Searching codebase...'
    if (toolName === 'ask_question') return 'Asking question...'
    if (toolName === 'manage_task') return 'Managing tasks...'
    if (toolName === 'list_permissions' || toolName === 'ask_permission')
        return 'Checking permissions...'
    if (toolName === 'generate_image') return 'Generating image...'
    if (toolName === 'send_message') return 'Sending message...'
    if (toolName === 'schedule') return 'Scheduling timer...'
    return 'Working...'
}

async function streamAssistantResponse(
    agent: Agent,
    eventQueue: AsyncQueue<AgentEvent>,
    signal: AbortSignal,
    turnCount: number = 1,
    options?: { readOnly?: boolean }
): Promise<{ assistantMessage: string; toolCalls: ToolCall[]; error?: string }> {
    let assistantMessage = ''
    let toolCalls: ToolCall[] = []
    let thinkingText = ''
    let lastUsage:
        | { promptTokens?: number; completionTokens?: number; totalTokens?: number }
        | undefined = undefined
    let loggedTools: any[] = []
    let loggedMessages: any[] = []
    let loggedModel = agent.modelOptions?.model
    const startTime = Date.now()

    try {
        const retryPromise = pRetry(
            async () => {
                assistantMessage = ''
                toolCalls = []
                thinkingText = ''
                lastUsage = undefined
                if (signal.aborted) throw new AbortError(new Error('Aborted'))

                eventQueue.push({ type: 'AgentStatus', message: 'Preparing...' })

                const compactionResult = await agent.conversation.compactIfNeeded(
                    agent.llm,
                    undefined,
                    agent.modelOptions,
                    signal
                )

                if (compactionResult.compacted) {
                    eventQueue.push({
                        type: 'ContextCompacted',
                        summary: compactionResult.summary || '',
                    })
                }
                const isConversational = isSimpleConversationalTurn(agent.messages)

                // Dynamic Tool Masking: omit heavy tool schemas on simple conversational turns or restrict to read-only tools
                const activeTools = options?.readOnly
                    ? Array.from(agent.tools.values()).filter((t) => READ_ONLY_TOOLS.has(t.name))
                    : isConversational
                      ? Array.from(agent.tools.values()).filter((t) =>
                            ['read_file', 'ls', 'ask_question'].includes(t.name)
                        )
                      : Array.from(agent.tools.values())

                // Breakpoint 2: Tools definition array (last tool marked for caching)
                const toolsArray = activeTools.map((t, idx) => ({
                    name: t.name,
                    description: t.description ? t.description.replace(/\s+/g, ' ').trim() : '',
                    inputSchema: trimToolSchema(t.inputSchema),
                    ...(idx === activeTools.length - 1
                        ? { cache_control: { type: 'ephemeral' } }
                        : {}),
                }))

                const providerMessages = agent.convertToLlm(agent.messages) as any

                // Breakpoint 3: Last user message in conversation history marked for caching
                if (Array.isArray(providerMessages)) {
                    let lastUserIdx = -1
                    for (let i = providerMessages.length - 1; i >= 0; i--) {
                        if (providerMessages[i]?.role === 'user') {
                            lastUserIdx = i
                            break
                        }
                    }
                    if (lastUserIdx !== -1 && providerMessages[lastUserIdx]) {
                        ;(providerMessages[lastUserIdx] as any).cache_control = {
                            type: 'ephemeral',
                        }
                    }
                }

                const modelName = (agent.modelOptions as any)?.model
                const modelSupportsThinking = modelName ? supportsModelThinking(modelName) : true
                const effectiveThinkingLevel =
                    modelSupportsThinking && agent.thinkingLevel !== 'off'
                        ? getAdaptiveThinkingLevel(agent.messages, agent.thinkingLevel)
                        : 'off'

                const providerModelOptions = {
                    ...agent.modelOptions,
                    thinkingLevel: effectiveThinkingLevel,
                }

                loggedTools = activeTools
                loggedMessages = providerMessages
                loggedModel = (providerModelOptions as any).model || agent.modelOptions?.model

                eventQueue.push({ type: 'AgentStatus', message: 'Working...' })

                const generator = agent.llm.stream(
                    providerMessages,
                    toolsArray,
                    agent.systemPrompt,
                    providerModelOptions,
                    signal
                )

                const activeToolCalls = new Map<
                    string,
                    { id: string; name: string; input: string }
                >()

                for await (const chunk of generator) {
                    if (signal.aborted) throw new AbortError(new Error('Aborted'))
                    if (chunk.type === 'text') {
                        assistantMessage += chunk.text
                        eventQueue.push({ type: 'StreamChunk', content: chunk.text })
                    } else if (chunk.type === 'thinking_delta') {
                        thinkingText += chunk.text
                        eventQueue.push({ type: 'ThinkingChunk', content: chunk.text })
                    } else if (chunk.type === 'tool_call_delta') {
                        if (!activeToolCalls.has(chunk.id)) {
                            activeToolCalls.set(chunk.id, {
                                id: chunk.id,
                                name: chunk.name || '',
                                input: '',
                            })
                        }
                        const tc = activeToolCalls.get(chunk.id)!
                        if (chunk.name && !tc.name) {
                            tc.name = chunk.name
                            eventQueue.push({
                                type: 'AgentStatus',
                                message: getToolStatusMessage(chunk.name),
                            })
                        }
                        if (chunk.inputDelta) {
                            tc.input += chunk.inputDelta
                        }
                    } else if (chunk.type === 'tool_call') {
                        activeToolCalls.set(chunk.toolCall.id, chunk.toolCall)
                        if (chunk.toolCall.name) {
                            eventQueue.push({
                                type: 'AgentStatus',
                                message: getToolStatusMessage(chunk.toolCall.name),
                            })
                        }
                    } else if (chunk.type === 'usage') {
                        lastUsage = {
                            promptTokens: chunk.promptTokens,
                            completionTokens: chunk.completionTokens,
                            totalTokens: (chunk.promptTokens || 0) + (chunk.completionTokens || 0),
                        }
                        eventQueue.push({
                            type: 'AgentUsage',
                            promptTokens: chunk.promptTokens,
                            completionTokens: chunk.completionTokens,
                            cacheCreationInputTokens: chunk.cacheCreationInputTokens,
                            cacheReadInputTokens: chunk.cacheReadInputTokens,
                            model: loggedModel,
                        })
                    }
                }
                toolCalls = Array.from(activeToolCalls.values())
                return { assistantMessage, toolCalls }
            },
            {
                retries: 5,
                factor: 2,
                minTimeout: 2000,
                maxTimeout: 30000,
                signal,
                onFailedAttempt: (error: any) => {
                    const actualError = error.error || error.originalError || error
                    const status = actualError.status || actualError.statusCode || error.status
                    const msg = (
                        actualError.message ||
                        error.message ||
                        String(actualError)
                    ).toLowerCase()
                    const isHighDemand =
                        status === 503 ||
                        status === 529 ||
                        msg.includes('503') ||
                        msg.includes('529') ||
                        msg.includes('high demand') ||
                        msg.includes('overloaded') ||
                        msg.includes('capacity')

                    const isRateLimit =
                        status === 429 ||
                        msg.includes('429') ||
                        msg.includes('quota') ||
                        msg.includes('rate limit') ||
                        msg.includes('rate_limit')

                    if (isHighDemand || isRateLimit) {
                        const delaySeconds = Math.round(Math.pow(2, error.attemptNumber - 1) * 2)
                        const providerName = getCleanProviderDisplayName(
                            agent.llm?.id,
                            (agent.modelOptions as any)?.model
                        )
                        const hitType = isHighDemand ? 'high demand' : 'rate limit'
                        const maxAttempts = error.attemptNumber + error.retriesLeft
                        eventQueue.push({
                            type: 'AgentStatus',
                            message: `${providerName} ${hitType} hit. Retrying in ${delaySeconds}s... (attempt ${error.attemptNumber}/${maxAttempts})\n`,
                        })
                    } else {
                        const errStr = formatError(error)
                        throw new AbortError(errStr)
                    }
                },
            }
        )

        const abortPromise = new Promise<{ assistantMessage: string; toolCalls: ToolCall[] }>(
            (_, reject) => {
                if (signal.aborted) {
                    reject(new AbortError(new Error('Aborted')))
                } else {
                    signal.addEventListener('abort', () => {
                        reject(new AbortError(new Error('Aborted')))
                    })
                }
            }
        )

        const result = await Promise.race([retryPromise, abortPromise])
        assistantMessage = result.assistantMessage
        toolCalls = result.toolCalls

        const durationMs = Date.now() - startTime
        const logEntry = createRequestLogEntry({
            turn: turnCount,
            sessionId: agent.sessionId,
            model: loggedModel,
            systemPrompt: agent.systemPrompt,
            tools: loggedTools.length > 0 ? loggedTools : Array.from(agent.tools.values()),
            messages:
                loggedMessages.length > 0 ? loggedMessages : agent.convertToLlm(agent.messages),
            assistantMessage,
            thinking: thinkingText,
            toolCalls,
            usage: lastUsage,
            durationMs,
        })
        if (!agent.disableLogging && process.env.DECEMBER_DISABLE_LOGGING !== 'true') {
            await appendTurnLog(agent.sessionId, logEntry, agent.logsDir).catch(() => {
                // Intentionally swallowed: Request logging must not block or crash agent loop
            })
        }

        try {
            agent.tracer?.recordGeneration({
                model: loggedModel,
                messages:
                    loggedMessages.length > 0 ? loggedMessages : agent.convertToLlm(agent.messages),
                systemPrompt: agent.systemPrompt,
                assistantMessage,
                thinking: thinkingText || undefined,
                usage: lastUsage,
                durationMs,
            })
        } catch {
            // Intentionally swallowed: Telemetry generation recording must not disrupt agent loop
        }

        eventQueue.push({ type: 'AgentStatus', message: '' }) // clear status on success
        return { assistantMessage, toolCalls }
    } catch (error: any) {
        let errorMsg = formatError(error)

        const durationMs = Date.now() - startTime
        const logEntry = createRequestLogEntry({
            turn: turnCount,
            sessionId: agent.sessionId,
            model: loggedModel,
            systemPrompt: agent.systemPrompt,
            tools: loggedTools.length > 0 ? loggedTools : Array.from(agent.tools.values()),
            messages:
                loggedMessages.length > 0 ? loggedMessages : agent.convertToLlm(agent.messages),
            assistantMessage,
            thinking: thinkingText,
            toolCalls,
            usage: lastUsage,
            durationMs,
            error: errorMsg,
        })
        if (!agent.disableLogging && process.env.DECEMBER_DISABLE_LOGGING !== 'true') {
            await appendTurnLog(agent.sessionId, logEntry, agent.logsDir).catch(() => {
                // Intentionally swallowed: Request logging must not block or crash agent loop
            })
        }

        try {
            agent.tracer?.recordGeneration({
                model: loggedModel,
                messages:
                    loggedMessages.length > 0 ? loggedMessages : agent.convertToLlm(agent.messages),
                systemPrompt: agent.systemPrompt,
                assistantMessage,
                thinking: thinkingText || undefined,
                usage: lastUsage,
                durationMs,
                error: errorMsg,
            })
        } catch {
            // Intentionally swallowed: Telemetry generation recording must not disrupt agent loop
        }

        if (signal.aborted || (error.name === 'AbortError' && errorMsg === 'Aborted')) {
            eventQueue.push({ type: 'AgentInterrupt' })
            if (!assistantMessage) {
                for (let i = agent.messages.length - 1; i >= 0; i--) {
                    const m = agent.messages[i]
                    if (m && m.role === 'user' && !m.isUI) {
                        m.isUI = true
                        break
                    }
                }
            }
            agent.addMessage({
                role: 'assistant',
                content: assistantMessage + `\n\nInterrupted · What should December do instead?`,
                isUI: true,
            })
            await agent.saveContext()
            return { assistantMessage, toolCalls, error: 'Aborted' }
        }

        if (errorMsg.includes('402') || errorMsg.toLowerCase().includes('insufficient credits')) {
            const providerId = (agent.llm?.id || '').toLowerCase().trim()
            const model = agent.modelOptions?.model
            const notice = formatInsufficientCreditsNotice(providerId, model, errorMsg)
            if (!errorMsg.includes(notice)) {
                errorMsg = `${notice}\n${errorMsg}`
            }
        } else if (
            errorMsg.includes('无可用渠道') ||
            errorMsg.toLowerCase().includes('no available channel') ||
            errorMsg.toLowerCase().includes('channel not found')
        ) {
            errorMsg =
                'The selected model is not available or not enabled for your token group on this provider. Please switch models using `/model` (e.g. glm-5.2, gpt-5.5, claude-opus-4-6, glm-4-plus).\n' +
                errorMsg
        } else if (
            errorMsg.includes('401') ||
            errorMsg.toLowerCase().includes('unauthorized') ||
            errorMsg.toLowerCase().includes('session expired') ||
            errorMsg.toLowerCase().includes('invalid token')
        ) {
            errorMsg =
                'Authentication failed or session expired. Please run `/login` to sign in with your December account (Cloud Wallet) or configure Bring Your Own Key (BYOK).\n' +
                errorMsg
        } else if (
            errorMsg.includes('429') ||
            errorMsg.toLowerCase().includes('quota') ||
            errorMsg.toLowerCase().includes('rate limit')
        ) {
            const providerId = (agent.llm?.id || '').toLowerCase().trim()
            const model = agent.modelOptions?.model
            const notice = formatRateLimitNotice(providerId, model, errorMsg)
            if (!errorMsg.includes(notice)) {
                errorMsg = `${notice}\n${errorMsg}`
            }
        } else if (
            errorMsg.includes('503') ||
            errorMsg.includes('529') ||
            errorMsg.toLowerCase().includes('high demand') ||
            errorMsg.toLowerCase().includes('overloaded') ||
            errorMsg.toLowerCase().includes('capacity')
        ) {
            errorMsg =
                'This model is currently experiencing high demand or capacity limits from the provider. Spikes in demand are usually temporary. Please try again in a few moments or switch to a different model at https://trydecember.com/pricing\n' +
                errorMsg
        }

        eventQueue.push({ type: 'AgentError', error: errorMsg })

        if (!assistantMessage) {
            for (let i = agent.messages.length - 1; i >= 0; i--) {
                const m = agent.messages[i]
                if (m && m.role === 'user' && !m.isUI) {
                    m.isUI = true
                    break
                }
            }
        }

        agent.addMessage({
            role: 'assistant',
            content: errorMsg,
            isUI: true,
            errorMessage: errorMsg,
        })
        await agent.saveContext()
        return { assistantMessage, toolCalls, error: errorMsg }
    }
}

async function executeToolCalls(
    agent: Agent,
    toolCalls: ToolCall[],
    eventQueue: AsyncQueue<AgentEvent>,
    signal: AbortSignal,
    options?: { readOnly?: boolean }
) {
    const isSequentialTool = (tc: ToolCall) => {
        const tool = agent.tools.get(tc.name)
        return (
            tool?.executionMode === 'sequential' ||
            ['bash', 'write_file', 'edit_file', 'edit_diff'].includes(tc.name)
        )
    }

    const parallelReadCalls: ToolCall[] = []
    const sequentialWriteCalls: ToolCall[] = []

    for (const tc of toolCalls) {
        if (isSequentialTool(tc)) {
            sequentialWriteCalls.push(tc)
        } else {
            parallelReadCalls.push(tc)
        }
    }

    if (parallelReadCalls.length > 0) {
        await executeToolCallsParallel(agent, parallelReadCalls, eventQueue, signal, options)
    }

    if (sequentialWriteCalls.length > 0 && !signal.aborted) {
        await executeToolCallsSequential(agent, sequentialWriteCalls, eventQueue, signal, options)
    }
}

async function executeSingleTool(
    agent: Agent,
    toolCall: ToolCall,
    eventQueue: AsyncQueue<AgentEvent>,
    signal: AbortSignal,
    options?: { readOnly?: boolean }
): Promise<{ toolCall: ToolCall; toolResult: ToolResult; resultStr: string; errorStr?: string }> {
    const toolStartTime = Date.now()
    eventQueue.push({ type: 'ToolCallStart', toolCall })

    const tool = agent.tools.get(toolCall.name)
    let resultStr = ''
    let errorStr = undefined

    if (options?.readOnly && !READ_ONLY_TOOLS.has(toolCall.name)) {
        errorStr = `Tool execution blocked: '${toolCall.name}' is not permitted in read-only / ask mode.`
        const res = { toolCallId: toolCall.id, result: '', error: errorStr }
        eventQueue.push({ type: 'ToolCallResult', result: res })
        try {
            agent.tracer?.recordToolExecution({
                toolCallId: toolCall.id,
                toolName: toolCall.name,
                input: toolCall.input,
                output: '',
                error: errorStr,
                durationMs: Date.now() - toolStartTime,
            })
        } catch {
            // Intentionally swallowed: Telemetry tool execution recording must not disrupt agent loop
        }
        return { toolCall, toolResult: res, resultStr: '', errorStr }
    }

    if (agent.operations?.ui?.requestPermission) {
        const hookRes = await agent.operations.ui.requestPermission(toolCall)
        if (hookRes?.block) {
            errorStr = `Tool execution blocked: ${hookRes.reason || 'No reason provided'}`
            const res = { toolCallId: toolCall.id, result: '', error: errorStr }
            eventQueue.push({ type: 'ToolCallResult', result: res })
            try {
                agent.tracer?.recordToolExecution({
                    toolCallId: toolCall.id,
                    toolName: toolCall.name,
                    input: toolCall.input,
                    output: '',
                    error: errorStr,
                    durationMs: Date.now() - toolStartTime,
                })
            } catch {
                // Intentionally swallowed: Telemetry tool execution recording must not disrupt agent loop
            }
            return { toolCall, toolResult: res, resultStr: '', errorStr }
        }
    }

    if (!tool) {
        errorStr = `Tool ${toolCall.name} not found.`
    } else {
        try {
            let parsedArgs = toolCall.input ? safeParseJson(toolCall.input) : {}
            if (tool.prepareArguments) {
                parsedArgs = tool.prepareArguments(parsedArgs)
            }

            resultStr = await tool.execute(parsedArgs, {
                operations: agent.operations as any,
                env: agent.env,
                signal,
                agent,
                deferredRegistry: agent.deferredRegistry,
                activateTool: (name: string) => agent.activateDeferredTool(name),
                onStream: (chunk) => {
                    eventQueue.push({ type: 'ToolExecutionUpdate', toolCallId: toolCall.id, chunk })
                },
            })
        } catch (e: any) {
            errorStr = `Error executing tool: ${e.message}\n`
        }
    }

    const toolResult = { toolCallId: toolCall.id, result: resultStr, error: errorStr }

    if (agent.hooks?.afterToolCall) {
        const afterRes = await agent.hooks.afterToolCall(toolCall, toolResult)
        if (afterRes) {
            if (afterRes.result !== undefined) toolResult.result = afterRes.result
            if (afterRes.error !== undefined) toolResult.error = afterRes.error
        }
    }

    const toolDuration = Date.now() - toolStartTime
    try {
        agent.tracer?.recordToolExecution({
            toolCallId: toolCall.id,
            toolName: toolCall.name,
            input: toolCall.input,
            output: toolResult.result,
            error: toolResult.error,
            durationMs: toolDuration,
        })
    } catch {
        // Intentionally swallowed: Telemetry tool execution recording must not disrupt agent loop
    }

    eventQueue.push({ type: 'ToolCallResult', result: toolResult })
    return { toolCall, toolResult, resultStr: toolResult.result, errorStr: toolResult.error }
}

async function executeToolCallsSequential(
    agent: Agent,
    toolCalls: ToolCall[],
    eventQueue: AsyncQueue<AgentEvent>,
    signal: AbortSignal,
    options?: { readOnly?: boolean }
) {
    for (const toolCall of toolCalls) {
        if (signal.aborted) break
        const r = await executeSingleTool(agent, toolCall, eventQueue, signal, options)

        let finalContent = r.resultStr || ''
        if (r.errorStr) {
            finalContent = `Tool execution failed: ${r.errorStr}\nPlease adjust your arguments and try again.`
        }

        agent.addMessage({
            role: 'tool',
            content: finalContent,
            toolCallId: r.toolCall.id,
        })
    }
}

async function executeToolCallsParallel(
    agent: Agent,
    toolCalls: ToolCall[],
    eventQueue: AsyncQueue<AgentEvent>,
    signal: AbortSignal,
    options?: { readOnly?: boolean }
) {
    const promises = toolCalls.map((tc) =>
        executeSingleTool(agent, tc, eventQueue, signal, options)
    )
    const results = await Promise.all(promises)
    for (const r of results) {
        let finalContent = r.resultStr || ''
        if (r.errorStr) {
            finalContent = `Tool execution failed: ${r.errorStr}\nPlease adjust your arguments and try again.`
        }

        agent.addMessage({
            role: 'tool',
            content: finalContent,
            toolCallId: r.toolCall.id,
        })
    }
}
