import { describe, expect, it, mock } from 'bun:test'
import { runAgentLoop } from '../src/agent-loop'
import type { Agent } from '../src/agent'
import type { LLMProvider, ProviderStreamChunk } from '@december/providers'

describe('Agent Loop Generator', () => {
    it('should handle a basic text response', async () => {
        const mockLlm = {
            stream: mock(async function* () {
                yield { type: 'text', text: 'Hello' }
                yield { type: 'text', text: ' World' }
            }),
        } as unknown as LLMProvider

        const mockAgent = {
            llm: mockLlm,
            systemPrompt: 'System',
            tools: new Map(),
            messages: [{ role: 'system', content: 'System' }],
            addMessage: mock(),
            convertToLlm: (msgs: any[]) => msgs,
            activeAbortController: new AbortController(),
            hooks: {},
            steeringQueue: { length: 0, drain: () => [] },
            followUpQueue: { length: 0, drain: () => [] },
            conversation: { compactIfNeeded: async () => ({ compacted: false }) },
            saveContext: async () => {},
            operations: {},
        } as unknown as Agent

        const stream = runAgentLoop(mockAgent, 'Test user prompt')
        const events = []
        for await (const event of stream) {
            events.push(event)
        }

        expect(events).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ type: 'StreamChunk', content: 'Hello' }),
                expect.objectContaining({ type: 'StreamChunk', content: ' World' }),
            ])
        )

        // It should have pushed the user message and the final assistant message
        expect(mockAgent.addMessage).toHaveBeenCalledTimes(2)
    })

    it('should handle a tool call execution loop', async () => {
        const mockTool = {
            name: 'mock_tool',
            description: 'A mock tool',
            inputSchema: { type: 'object', properties: {} },
            execute: mock(async () => ({ result: 'Tool success' })),
        }

        const mockTools = new Map([['mock_tool', mockTool]])

        let pass = 0
        const mockLlm = {
            stream: mock(async function* () {
                if (pass === 0) {
                    pass++
                    yield { type: 'text', text: 'I will use a tool' }
                    yield {
                        type: 'tool_call_delta',
                        id: 'tc-123',
                        name: 'mock_tool',
                        inputDelta: '{}',
                    }
                } else {
                    yield { type: 'text', text: 'Done using tool.' }
                }
            }),
        } as unknown as LLMProvider

        const mockAgent = {
            llm: mockLlm,
            systemPrompt: 'System',
            tools: mockTools,
            messages: [{ role: 'system', content: 'System' }],
            addMessage: mock((msg) => {
                mockAgent.messages.push(msg)
            }),
            convertToLlm: (msgs: any[]) => msgs,
            activeAbortController: new AbortController(),
            hooks: {},
            steeringQueue: { length: 0, drain: () => [] },
            followUpQueue: { length: 0, drain: () => [] },
            conversation: { compactIfNeeded: async () => ({ compacted: false }) },
            saveContext: async () => {},
            operations: {},
        } as unknown as Agent

        const stream = runAgentLoop(mockAgent, 'Do it')
        const events = []
        for await (const event of stream) {
            events.push(event)
        }

        expect(mockTool.execute).toHaveBeenCalledTimes(1)
        expect(events).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    type: 'ToolCallStart',
                    toolCall: expect.objectContaining({ name: 'mock_tool' }),
                }),
                expect.objectContaining({
                    type: 'ToolCallResult',
                    result: expect.objectContaining({
                        result: expect.objectContaining({ result: 'Tool success' }),
                    }),
                }),
            ])
        )
    })
})
