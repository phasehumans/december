import { Agent } from './agent'
import { compactContextIfNeeded } from './utils/compaction'
import { AgentEvent, ToolCall, Role } from './types'
import { v4 as uuidv4 } from 'uuid'

const delay = (ms: number) => new Promise((res) => setTimeout(res, ms))

export async function* runAgentLoop(
    agent: Agent,
    userInput: string
): AsyncGenerator<AgentEvent, void, unknown> {
    agent.addMessage({ role: 'user', content: userInput })
    let isDone = false
    let turnCount = 0

    while (!isDone && turnCount < 100) {
        // Safety max turns
        turnCount++
        yield { type: 'TurnStart' }

        let assistantMessage = ''
        let toolCalls: ToolCall[] = []

        // Rate limit backoff retry loop
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

                const generator = agent.llm.stream(agent.messages, toolsArray, agent.systemPrompt)

                const activeToolCalls = new Map<
                    string,
                    { id: string; name: string; input: string }
                >()

                for await (const chunk of generator) {
                    if (chunk.type === 'text') {
                        assistantMessage += chunk.text
                        yield { type: 'StreamChunk', content: chunk.text }
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
                    yield {
                        type: 'StreamChunk',
                        content: `\n[Rate Limited (429). Retrying in 5s...]\n`,
                    }
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

            // Helper to execute a single tool
            const executeTool = async (toolCall: ToolCall) => {
                const tool = agent.tools.get(toolCall.name)
                let resultStr = ''
                let errorStr = undefined

                if (!tool) {
                    errorStr = `Tool ${toolCall.name} not found.`
                } else {
                    try {
                        resultStr = await tool.execute(
                            toolCall.input ? JSON.parse(toolCall.input) : {},
                            {
                                operations: agent.operations,
                                env: agent.env,
                                onStream: (chunk) => {
                                    // TODO: stream back to UI if needed
                                },
                                spawnSubagent: async (prompt: string) => {
                                    // 1-level depth limit: If we are already a subagent, don't spawn another
                                    if (agent.sessionId.startsWith('subagent-')) {
                                        throw new Error(
                                            'Depth limit reached: Subagents cannot spawn their own subagents.'
                                        )
                                    }

                                    const subagentId = `subagent-${uuidv4().slice(0, 8)}`

                                    // Provide only read-only tools for safety
                                    const readOnlyTools = Array.from(agent.tools.values()).filter(
                                        (t) =>
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
                                        operations: agent.operations, // Clean slate memory, same operations
                                    })

                                    let response = ''
                                    const generator = runAgentLoop(subagent, prompt)

                                    for await (const event of generator) {
                                        if (event.type === 'StreamChunk') {
                                            // We don't bubble up chunks to the main UI by default, or we could.
                                        }
                                    }

                                    // The last assistant message is the final answer
                                    const lastMsg = subagent.messages
                                        .filter((m) => m.role === 'assistant')
                                        .pop()
                                    return lastMsg
                                        ? lastMsg.content
                                        : 'Subagent failed to produce a response.'
                                },
                            }
                        )
                    } catch (e: any) {
                        // Agentic Self-Correction
                        errorStr = `Error executing tool: ${e.message}\nPlease correct your JSON or arguments and try again.`
                    }
                }

                return {
                    toolCall,
                    toolResult: { toolCallId: toolCall.id, result: resultStr, error: errorStr },
                    resultStr,
                    errorStr,
                }
            }

            // Smart Execution: Parallel for reads, Sequential for mutating
            let results = []
            let readOnlyBatch = []

            for (const toolCall of toolCalls) {
                // Yield start event for the UI
                yield { type: 'ToolCallStart', toolCall }

                const isMutating = ['bash', 'write_file', 'edit_file'].includes(toolCall.name)

                if (isMutating) {
                    if (readOnlyBatch.length > 0) {
                        const batchResults = await Promise.all(readOnlyBatch.map(executeTool))
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

            // Yield results and push to context in original order
            for (const toolCall of toolCalls) {
                const r = results.find((x) => x.toolCall.id === toolCall.id)!
                yield { type: 'ToolCallResult', result: r.toolResult }
                agent.addMessage({
                    role: 'tool',
                    content: r.resultStr || r.errorStr || '',
                    toolCallId: r.toolCall.id,
                })
            }
        }
        await agent.saveContext()
        yield { type: 'TurnEnd' }
    }
}
