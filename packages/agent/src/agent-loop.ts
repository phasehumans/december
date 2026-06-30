import { Agent } from './agent'
import { AgentEvent, ToolCall } from './types'

export async function* runAgentLoop(
    agent: Agent,
    userInput: string
): AsyncGenerator<AgentEvent, void, unknown> {
    agent.addMessage({ role: 'user', content: userInput })
    let isDone = false

    while (!isDone) {
        yield { type: 'TurnStart' }

        let assistantMessage = ''

        // Connect to the real LLM API Stream
        const generator = agent.llm.stream(agent.messages, agent.tools)
        let result: IteratorResult<string, ToolCall[]>

        while (true) {
            result = await generator.next()
            if (result.done) break
            assistantMessage += result.value
            yield { type: 'StreamChunk', content: result.value }
        }

        // The generator returns the parsed tool calls when the stream finishes
        const toolCalls = result.value

        if (toolCalls.length === 0) {
            agent.addMessage({ role: 'assistant', content: assistantMessage })
            isDone = true
        } else {
            agent.addMessage({
                role: 'assistant',
                content: assistantMessage,
                toolCalls: toolCalls,
            })

            for (const toolCall of toolCalls) {
                yield { type: 'ToolCallStart', toolCall }

                const tool = agent.tools.get(toolCall.name)
                let resultStr = ''
                let errorStr = undefined

                if (!tool) {
                    errorStr = `Tool ${toolCall.name} not found.`
                } else {
                    try {
                        resultStr = await tool.execute(
                            toolCall.input ? JSON.parse(toolCall.input) : {}
                        )
                    } catch (e: any) {
                        errorStr = e.message
                    }
                }

                const toolResult = {
                    toolCallId: toolCall.id,
                    result: resultStr,
                    error: errorStr,
                }

                yield { type: 'ToolCallResult', result: toolResult }

                agent.addMessage({
                    role: 'tool',
                    content: resultStr || errorStr || '',
                    toolCallId: toolCall.id,
                })
            }
        }
        yield { type: 'TurnEnd' }
    }
}
