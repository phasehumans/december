import { Agent } from './agent'
import { compactContextIfNeeded } from './utils/compaction'
import { AgentEvent, ToolCall, Role } from './types'
import { v4 as uuidv4 } from 'uuid'

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
    userInput: string
): AsyncGenerator<AgentEvent, void, unknown> {
    agent.addMessage({ role: 'user', content: userInput })
    const eventQueue = new AsyncQueue<AgentEvent>()

    // Run the agent loop logic asynchronously and push events to the queue
    ;(async () => {
        let isDone = false
        let turnCount = 0

        try {
            while (!isDone && turnCount < 100) {
                turnCount++

                // Feature 1: Mid-Turn Steering Messages (Interrupts)
                if (agent.hooks?.getSteeringMessages) {
                    const steeringMessages = await agent.hooks.getSteeringMessages()
                    for (const msg of steeringMessages) {
                        agent.addMessage(msg)
                    }
                }

                eventQueue.push({ type: 'TurnStart' })

                let assistantMessage = ''
                let toolCalls: ToolCall[] = []
                let retries = 5
                let success = false

                while (!success && retries > 0) {
                    try {
                        agent.messages = await compactContextIfNeeded(agent.messages, agent.llm)
                        const toolsArray = Array.from(agent.tools.values()).map((t) => ({
                            name: t.name,
                            description: t.description,
                            inputSchema: t.inputSchema,
                        }))

                        const generator = agent.llm.stream(
                            agent.messages,
                            toolsArray,
                            agent.systemPrompt,
                            agent.modelOptions
                        )

                        const activeToolCalls = new Map<
                            string,
                            { id: string; name: string; input: string }
                        >()

                        for await (const chunk of generator) {
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
                        if (error.status === 429 || error.message?.includes('429')) {
                            retries--
                            eventQueue.push({
                                type: 'StreamChunk',
                                content: `\n[Rate Limited (429). Retrying in 5s...]\n`,
                            })
                            await delay(5000)
                        } else {
                            agent.addMessage({
                                role: 'assistant',
                                content: `Failed due to API error: ${error.message}`,
                            })
                            throw error
                        }
                    }
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

                    const executeTool = async (toolCall: ToolCall) => {
                        const tool = agent.tools.get(toolCall.name)
                        let resultStr = ''
                        let errorStr = undefined

                        if (agent.hooks?.beforeToolCall) {
                            await agent.hooks.beforeToolCall(toolCall)
                        }

                        if (!tool) {
                            errorStr = `Tool ${toolCall.name} not found.`
                        } else {
                            try {
                                let parsedArgs = toolCall.input ? JSON.parse(toolCall.input) : {}

                                // Feature 3: Argument Validation Phase (prepareArguments)
                                if (tool.prepareArguments) {
                                    parsedArgs = tool.prepareArguments(parsedArgs)
                                }

                                resultStr = await tool.execute(parsedArgs, {
                                    operations: agent.operations,
                                    env: agent.env,
                                    onStream: (chunk) => {
                                        // Feature 2: Streaming Partial Tool Results
                                        eventQueue.push({
                                            type: 'ToolExecutionUpdate',
                                            toolCallId: toolCall.id,
                                            chunk,
                                        })
                                    },
                                    spawnSubagent: async (prompt: string) => {
                                        if (agent.sessionId.startsWith('subagent-')) {
                                            throw new Error(
                                                'Depth limit reached: Subagents cannot spawn their own subagents.'
                                            )
                                        }

                                        const subagentId = `subagent-${uuidv4().slice(0, 8)}`
                                        const readOnlyTools = Array.from(
                                            agent.tools.values()
                                        ).filter((t) =>
                                            [
                                                'read_file',
                                                'list_dir',
                                                'find_files',
                                                'grep_search',
                                            ].includes(t.name)
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
                                            // ignore inner events for now
                                        }

                                        const lastMsg = subagent.messages
                                            .filter((m) => m.role === 'assistant')
                                            .pop()
                                        return lastMsg
                                            ? lastMsg.content
                                            : 'Subagent failed to produce a response.'
                                    },
                                })
                            } catch (e: any) {
                                errorStr = `Error executing tool: ${e.message}\nPlease correct your JSON or arguments and try again.`
                            }
                        }

                        const toolResult = {
                            toolCallId: toolCall.id,
                            result: resultStr,
                            error: errorStr,
                        }
                        if (agent.hooks?.afterToolCall) {
                            await agent.hooks.afterToolCall(toolCall, toolResult)
                        }

                        return {
                            toolCall,
                            toolResult,
                            resultStr,
                            errorStr,
                        }
                    }

                    let results = []
                    let readOnlyBatch = []

                    for (const toolCall of toolCalls) {
                        eventQueue.push({ type: 'ToolCallStart', toolCall })

                        const tool = agent.tools.get(toolCall.name)
                        // Feature 4: Advanced Parallelism Config
                        const isMutating =
                            tool?.executionMode === 'sequential' ||
                            ['bash', 'write_file', 'edit_file', 'edit_diff'].includes(toolCall.name)

                        if (isMutating) {
                            if (readOnlyBatch.length > 0) {
                                const batchResults = await Promise.all(
                                    readOnlyBatch.map(executeTool)
                                )
                                results.push(...batchResults)
                                readOnlyBatch = []
                            }
                            results.push(await executeTool(toolCall))
                        } else {
                            readOnlyBatch.push(toolCall)
                        }
                    }

                    if (readOnlyBatch.length > 0) {
                        const batchResults = await Promise.all(readOnlyBatch.map(executeTool))
                        results.push(...batchResults)
                    }

                    for (const toolCall of toolCalls) {
                        const r = results.find((x) => x.toolCall.id === toolCall.id)!
                        eventQueue.push({ type: 'ToolCallResult', result: r.toolResult })
                        agent.addMessage({
                            role: 'tool',
                            content: r.resultStr || r.errorStr || '',
                            toolCallId: r.toolCall.id,
                        })
                    }
                }

                await agent.saveContext()
                eventQueue.push({ type: 'TurnEnd' })

                if (agent.hooks?.shouldStopAfterTurn) {
                    const shouldStop = await agent.hooks.shouldStopAfterTurn()
                    if (shouldStop) {
                        isDone = true
                    }
                }
            }
        } catch (e) {
            console.error('Agent Loop Error:', e)
        } finally {
            eventQueue.end()
        }
    })()

    yield* eventQueue
}
