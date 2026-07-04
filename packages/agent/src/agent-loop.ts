import { Agent } from './agent'
import { compactContextIfNeeded } from './utils/compaction'
import { AgentEvent, ToolCall, AgentMessage, ToolResult, ToolExecuteContext } from './types'
import { v4 as uuidv4 } from 'uuid'
import { ProviderStreamChunk } from '@december/providers'

const delay = (ms: number) => new Promise((res) => setTimeout(res, ms))

class AsyncQueue<T> {
    private queue: T[] = []
    private resolvers: ((value: IteratorResult<T>) => void)[] = []

    push(item: T) {
        if (this.resolvers.length > 0) {
            const resolve = this.resolvers.shift()!
            resolve({ value: item, done: false })
        } else {
            this.queue.push(item)
        }
    }

    end() {
        while (this.resolvers.length > 0) {
            const resolve = this.resolvers.shift()!
            resolve({ value: undefined, done: true })
        }
    }

    async *[Symbol.asyncIterator]() {
        while (true) {
            if (this.queue.length > 0) {
                yield this.queue.shift()!
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

export async function* runAgentLoop(
    agent: Agent,
    userInput?: string
): AsyncGenerator<AgentEvent, void, unknown> {
    if (userInput) {
        agent.addMessage({ role: 'user', content: userInput })
    }
    const eventQueue = new AsyncQueue<AgentEvent>()
    const abortController = new AbortController()
    agent.activeAbortController = abortController
    ;(async () => {
        try {
            eventQueue.push({ type: 'AgentStart' })
            await runOuterLoop(agent, eventQueue, abortController.signal)
            eventQueue.push({ type: 'AgentEnd' })
        } catch (e: any) {
            console.error('Agent Loop Error:', e)
            eventQueue.push({ type: 'AgentError', error: e.message || String(e) })
            eventQueue.push({ type: 'AgentEnd' })
        } finally {
            agent.activeAbortController = undefined
            eventQueue.end()
        }
    })()

    yield* eventQueue
}

async function runOuterLoop(agent: Agent, eventQueue: AsyncQueue<AgentEvent>, signal: AbortSignal) {
    while (!signal.aborted) {
        // Run inner loop for turns
        await runInnerLoop(agent, eventQueue, signal)

        if (signal.aborted) break

        // Follow up queue
        if (agent.followUpQueue.length > 0) {
            const msgs = agent.followUpQueue.splice(0, agent.followUpQueue.length)
            for (const msg of msgs) {
                agent.addMessage(msg)
            }
            continue // loop again with new messages
        }

        break
    }
}

async function runInnerLoop(agent: Agent, eventQueue: AsyncQueue<AgentEvent>, signal: AbortSignal) {
    let isDone = false
    let turnCount = 0

    while (!isDone && turnCount < 100 && !signal.aborted) {
        turnCount++

        // Handle steering messages
        if (agent.hooks?.getSteeringMessages) {
            const steeringMessages = await agent.hooks.getSteeringMessages()
            for (const msg of steeringMessages) {
                agent.steer(msg)
            }
        }
        if (agent.steeringQueue.length > 0) {
            const msgs = agent.steeringQueue.splice(0, agent.steeringQueue.length)
            for (const msg of msgs) {
                agent.addMessage(msg)
            }
        }

        eventQueue.push({ type: 'TurnStart' })

        // Stream assistant response
        const { assistantMessage, toolCalls, error } = await streamAssistantResponse(
            agent,
            eventQueue,
            signal
        )

        if (error || signal.aborted) {
            isDone = true
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

            // Execute tools
            await executeToolCalls(agent, toolCalls, eventQueue, signal)
        }

        await agent.saveContext()
        eventQueue.push({ type: 'TurnEnd' })

        if (agent.hooks?.prepareNextTurn) {
            const nextTurn = await agent.hooks.prepareNextTurn()
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

async function streamAssistantResponse(
    agent: Agent,
    eventQueue: AsyncQueue<AgentEvent>,
    signal: AbortSignal
): Promise<{ assistantMessage: string; toolCalls: ToolCall[]; error?: string }> {
    let assistantMessage = ''
    let toolCalls: ToolCall[] = []
    let retries = 10
    let maxRetries = 10
    let success = false
    let lastError = undefined

    while (!success && retries > 0 && !signal.aborted) {
        try {
            agent.messages = await compactContextIfNeeded(agent.messages, agent.llm)
            const toolsArray = Array.from(agent.tools.values()).map((t) => ({
                name: t.name,
                description: t.description,
                inputSchema: t.inputSchema,
            }))

            const providerMessages = agent.convertToLlm(agent.messages)

            const generator = agent.llm.stream(
                providerMessages,
                toolsArray,
                agent.systemPrompt,
                agent.modelOptions,
                signal
            )

            const activeToolCalls = new Map<string, { id: string; name: string; input: string }>()

            for await (const chunk of generator) {
                if (signal.aborted) break
                if (chunk.type === 'text') {
                    assistantMessage += chunk.text
                    eventQueue.push({ type: 'StreamChunk', content: chunk.text })
                } else if (chunk.type === 'thinking_delta') {
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
                    if (chunk.inputDelta) {
                        tc.input += chunk.inputDelta
                    }
                } else if (chunk.type === 'tool_call') {
                    activeToolCalls.set(chunk.toolCall.id, chunk.toolCall)
                }
            }
            toolCalls = Array.from(activeToolCalls.values())
            success = true
        } catch (error: any) {
            lastError = error
            if (
                error.status === 429 ||
                error.message?.includes('429') ||
                error.message?.toLowerCase().includes('quota') ||
                error.message?.toLowerCase().includes('rate limit')
            ) {
                retries--
                const delaySeconds = (maxRetries - retries) * 5
                eventQueue.push({
                    type: 'StreamChunk',
                    content: `\n[Rate Limited (429). Retrying in ${delaySeconds}s...]\n`,
                })
                await delay(delaySeconds * 1000)
            } else {
                agent.addMessage({
                    role: 'assistant',
                    content: `Failed due to API error: ${error.message}`,
                    isUI: true,
                    errorMessage: error.message,
                })
                return { assistantMessage, toolCalls, error: error.message }
            }
        }
    }

    if (!success && lastError) {
        return { assistantMessage, toolCalls, error: lastError.message }
    }

    return { assistantMessage, toolCalls }
}

async function executeToolCalls(
    agent: Agent,
    toolCalls: ToolCall[],
    eventQueue: AsyncQueue<AgentEvent>,
    signal: AbortSignal
) {
    const isSequentialBatch = toolCalls.some((tc) => {
        const tool = agent.tools.get(tc.name)
        return (
            tool?.executionMode === 'sequential' ||
            ['bash', 'write_file', 'edit_file', 'edit_diff'].includes(tc.name)
        )
    })

    if (isSequentialBatch) {
        await executeToolCallsSequential(agent, toolCalls, eventQueue, signal)
    } else {
        await executeToolCallsParallel(agent, toolCalls, eventQueue, signal)
    }
}

async function executeSingleTool(
    agent: Agent,
    toolCall: ToolCall,
    eventQueue: AsyncQueue<AgentEvent>,
    signal: AbortSignal
): Promise<{ toolCall: ToolCall; toolResult: ToolResult; resultStr: string; errorStr?: string }> {
    eventQueue.push({ type: 'ToolCallStart', toolCall })

    const tool = agent.tools.get(toolCall.name)
    let resultStr = ''
    let errorStr = undefined

    if (agent.hooks?.beforeToolCall) {
        const hookRes = await agent.hooks.beforeToolCall(toolCall)
        if (hookRes?.block) {
            errorStr = `Tool execution blocked: ${hookRes.reason || 'No reason provided'}`
            const res = { toolCallId: toolCall.id, result: '', error: errorStr }
            eventQueue.push({ type: 'ToolCallResult', result: res })
            return { toolCall, toolResult: res, resultStr: '', errorStr }
        }
    }

    if (!tool) {
        errorStr = `Tool ${toolCall.name} not found.`
    } else {
        try {
            let parsedArgs = toolCall.input ? JSON.parse(toolCall.input) : {}
            if (tool.prepareArguments) {
                parsedArgs = tool.prepareArguments(parsedArgs)
            }

            resultStr = await tool.execute(parsedArgs, {
                operations: agent.operations,
                env: agent.env,
                signal,
                onStream: (chunk) => {
                    eventQueue.push({ type: 'ToolExecutionUpdate', toolCallId: toolCall.id, chunk })
                },
                spawnSubagent: async (prompt: string) => {
                    if (agent.sessionId.startsWith('subagent-')) {
                        throw new Error(
                            'Depth limit reached: Subagents cannot spawn their own subagents.'
                        )
                    }

                    const subagentId = `subagent-${uuidv4().slice(0, 8)}`
                    const readOnlyTools = Array.from(agent.tools.values()).filter((t) =>
                        ['read_file', 'list_dir', 'find_files', 'grep_search'].includes(t.name)
                    )

                    const subagent = new Agent({
                        sessionId: subagentId,
                        systemPrompt:
                            'You are a read-only research subagent. Your goal is to gather information for the main agent.',
                        llm: agent.llm,
                        tools: readOnlyTools,
                        operations: agent.operations,
                    })

                    const generator = runAgentLoop(subagent, prompt)
                    for await (const event of generator) {
                        // ignore inner events
                    }

                    const lastMsg = subagent.messages.filter((m) => m.role === 'assistant').pop()
                    return lastMsg ? lastMsg.content : 'Subagent failed to produce a response.'
                },
            })
        } catch (e: any) {
            errorStr = `Error executing tool: ${e.message}\n`
        }
    }

    let toolResult = { toolCallId: toolCall.id, result: resultStr, error: errorStr }

    if (agent.hooks?.afterToolCall) {
        const afterRes = await agent.hooks.afterToolCall(toolCall, toolResult)
        if (afterRes) {
            if (afterRes.result !== undefined) toolResult.result = afterRes.result
            if (afterRes.error !== undefined) toolResult.error = afterRes.error
        }
    }

    eventQueue.push({ type: 'ToolCallResult', result: toolResult })
    return { toolCall, toolResult, resultStr: toolResult.result, errorStr: toolResult.error }
}

async function executeToolCallsSequential(
    agent: Agent,
    toolCalls: ToolCall[],
    eventQueue: AsyncQueue<AgentEvent>,
    signal: AbortSignal
) {
    for (const toolCall of toolCalls) {
        if (signal.aborted) break
        const r = await executeSingleTool(agent, toolCall, eventQueue, signal)
        agent.addMessage({
            role: 'tool',
            content: r.resultStr || r.errorStr || '',
            toolCallId: r.toolCall.id,
        })
    }
}

async function executeToolCallsParallel(
    agent: Agent,
    toolCalls: ToolCall[],
    eventQueue: AsyncQueue<AgentEvent>,
    signal: AbortSignal
) {
    const promises = toolCalls.map((tc) => executeSingleTool(agent, tc, eventQueue, signal))
    const results = await Promise.all(promises)
    for (const r of results) {
        agent.addMessage({
            role: 'tool',
            content: r.resultStr || r.errorStr || '',
            toolCallId: r.toolCall.id,
        })
    }
}
