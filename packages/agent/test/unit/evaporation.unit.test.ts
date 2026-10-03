import { describe, it, expect } from 'bun:test'

import { evaporateStaleToolOutputs } from '../../src/utils/evaporation'

import type { AgentMessage } from '@december/shared'

describe('evaporateStaleToolOutputs (Micro-Compaction)', () => {
    it('returns empty array when messages are empty', () => {
        expect(evaporateStaleToolOutputs([])).toEqual([])
    })

    it('does not evaporate tool outputs when total user turns is <= 3', () => {
        const messages: AgentMessage[] = [
            { role: 'user', content: 'turn 1' },
            { role: 'tool', content: 'line1\nline2\nline3\n'.repeat(50) },
            { role: 'assistant', content: 'answer 1' },
            { role: 'user', content: 'turn 2' },
            { role: 'tool', content: 'line1\nline2\nline3\n'.repeat(50) },
            { role: 'assistant', content: 'answer 2' },
        ]

        const result = evaporateStaleToolOutputs(messages, 3)
        expect(result[1].content).toBe(messages[1].content)
        expect(result[4].content).toBe(messages[4].content)
    })

    it('evaporates large tool outputs older than 3 user turns into tombstones', () => {
        const largeOutput = 'line1\nline2\nline3\n'.repeat(50)
        const messages: AgentMessage[] = [
            { role: 'user', content: 'turn 1' },
            { role: 'tool', content: largeOutput },
            { role: 'assistant', content: 'answer 1' },
            { role: 'user', content: 'turn 2' },
            { role: 'tool', content: largeOutput },
            { role: 'assistant', content: 'answer 2' },
            { role: 'user', content: 'turn 3' },
            { role: 'tool', content: largeOutput },
            { role: 'assistant', content: 'answer 3' },
            { role: 'user', content: 'turn 4' },
            { role: 'tool', content: largeOutput },
            { role: 'assistant', content: 'answer 4' },
        ]

        const result = evaporateStaleToolOutputs(messages, 3)

        // Turn 1's tool output (index 1) should be evaporated
        expect(result[1].content).toContain('[Tool Output Evaporated:')
        expect(result[1].content).toContain('lines')

        // Recent turns (Turn 2, 3, 4) tool outputs should remain intact
        expect(result[4].content).toBe(largeOutput)
        expect(result[7].content).toBe(largeOutput)
        expect(result[10].content).toBe(largeOutput)

        // User and assistant reasoning must be 100% preserved
        expect(result[0].content).toBe('turn 1')
        expect(result[2].content).toBe('answer 1')
        expect(result[3].content).toBe('turn 2')
        expect(result[5].content).toBe('answer 2')
    })

    it('preserves failed tool outputs and errors even if older than 3 turns', () => {
        const errorOutput =
            'Command failed with exit code 1:\n[Tool Error] syntax error in src/auth.ts:42\n' +
            'stack trace details\n'.repeat(20)
        const messages: AgentMessage[] = [
            { role: 'user', content: 'turn 1' },
            { role: 'tool', content: errorOutput },
            { role: 'assistant', content: 'answer 1' },
            { role: 'user', content: 'turn 2' },
            { role: 'assistant', content: 'answer 2' },
            { role: 'user', content: 'turn 3' },
            { role: 'assistant', content: 'answer 3' },
            { role: 'user', content: 'turn 4' },
            { role: 'assistant', content: 'answer 4' },
        ]

        const result = evaporateStaleToolOutputs(messages, 3)
        expect(result[1].content).toBe(errorOutput)
    })

    it('does not evaporate small tool outputs under 200 characters', () => {
        const smallOutput = 'File written successfully to src/index.ts'
        const messages: AgentMessage[] = [
            { role: 'user', content: 'turn 1' },
            { role: 'tool', content: smallOutput },
            { role: 'assistant', content: 'answer 1' },
            { role: 'user', content: 'turn 2' },
            { role: 'assistant', content: 'answer 2' },
            { role: 'user', content: 'turn 3' },
            { role: 'assistant', content: 'answer 3' },
            { role: 'user', content: 'turn 4' },
            { role: 'assistant', content: 'answer 4' },
        ]

        const result = evaporateStaleToolOutputs(messages, 3)
        expect(result[1].content).toBe(smallOutput)
    })

    it('preserves thinking on assistant messages during evaporation', () => {
        const messages: AgentMessage[] = [
            { role: 'user', content: 'turn 1' },
            {
                role: 'assistant',
                content: 'running tool',
                thinking: 'Checking file structure first',
                toolCalls: [{ id: 'tc-1', name: 'read_file', input: '{"path":"file.txt"}' }],
            },
            { role: 'tool', content: 'content\n'.repeat(50), toolCallId: 'tc-1' },
            { role: 'assistant', content: 'done' },
        ]

        const result = evaporateStaleToolOutputs(messages, 3)
        expect(result[1].thinking).toBe('Checking file structure first')
    })

    it('evaporates tool outputs older than 2 agent execution steps even within a single user turn', () => {
        const largeOutput = 'row data line\n'.repeat(40)
        const messages: AgentMessage[] = [
            // Single user turn
            { role: 'user', content: 'Autonomous multi-step task' },
            // Step 1 (oldest step)
            {
                role: 'assistant',
                content: 'Step 1: checking files',
                toolCalls: [{ id: 'step_1', name: 'ls', input: '{}' }],
            },
            { role: 'tool', toolCallId: 'step_1', content: largeOutput },
            // Step 2 (recent step 2)
            {
                role: 'assistant',
                content: 'Step 2: inspecting code',
                toolCalls: [{ id: 'step_2', name: 'read_file', input: '{"path":"app.ts"}' }],
            },
            { role: 'tool', toolCallId: 'step_2', content: largeOutput },
            // Step 3 (recent step 1)
            {
                role: 'assistant',
                content: 'Step 3: running tests',
                toolCalls: [{ id: 'step_3', name: 'bash', input: '{"cmd":"bun test"}' }],
            },
            { role: 'tool', toolCallId: 'step_3', content: largeOutput },
        ]

        const result = evaporateStaleToolOutputs(messages, {
            preserveRecentTurns: 3,
            preserveRecentSteps: 2,
        })

        // Step 1 tool output (index 2) must be evaporated to tombstone because it is older than 2 steps
        expect(result[2]!.content).toContain('[Tool Output Evaporated:')
        expect(result[2]!.content).toContain('exit code 0')

        // Step 2 and Step 3 tool outputs must remain intact within the 2 recent steps
        expect(result[4]!.content).toBe(largeOutput)
        expect(result[6]!.content).toBe(largeOutput)

        // User prompt and thoughts must be 100% preserved
        expect(result[0]!.content).toBe('Autonomous multi-step task')
        expect(result[1]!.content).toBe('Step 1: checking files')
    })

    it('truncates oversized tool outputs (> 6 KB) in recent steps preserving first 20 and last 20 lines', () => {
        // Generate 100 lines of ~100 chars each (~10 KB)
        const lines: string[] = []
        for (let i = 1; i <= 100; i++) {
            lines.push(`Log entry #${i}: ` + 'x'.repeat(80))
        }
        const hugeOutput = lines.join('\n')

        const messages: AgentMessage[] = [
            { role: 'user', content: 'Run test suite' },
            {
                role: 'assistant',
                content: 'Running tests now',
                toolCalls: [{ id: 'call_test', name: 'bash', input: '{"cmd":"test"}' }],
            },
            { role: 'tool', toolCallId: 'call_test', content: hugeOutput },
        ]

        const result = evaporateStaleToolOutputs(messages, {
            preserveRecentTurns: 3,
            preserveRecentSteps: 2,
            maxOutputSize: 6 * 1024,
        })

        const toolContent = result[2]!.content as string
        expect(toolContent).toContain('Log entry #1:')
        expect(toolContent).toContain('Log entry #20:')
        expect(toolContent).toContain('lines truncated')
        expect(toolContent).toContain('Log entry #81:')
        expect(toolContent).toContain('Log entry #100:')
        // Middle lines like entry #50 should be truncated
        expect(toolContent).not.toContain('Log entry #50:')
    })

    it('retains essential error diagnostic information on failed tool outputs even if oversized', () => {
        const lines: string[] = []
        lines.push('Command failed with exit code 1:')
        lines.push(
            '[Tool Error] TypeError: undefined is not a function at Object.run (/src/index.ts:42)'
        )
        for (let i = 1; i <= 100; i++) {
            lines.push(`Trace detail line #${i}: error stack trace`)
        }
        const hugeErrorOutput = lines.join('\n')

        const messages: AgentMessage[] = [
            { role: 'user', content: 'Debug test failure' },
            {
                role: 'assistant',
                content: 'Running failing test',
                toolCalls: [{ id: 'call_fail', name: 'bash', input: '{"cmd":"test"}' }],
            },
            { role: 'tool', toolCallId: 'call_fail', content: hugeErrorOutput },
        ]

        const result = evaporateStaleToolOutputs(messages, {
            preserveRecentTurns: 3,
            preserveRecentSteps: 2,
            maxOutputSize: 6 * 1024,
        })

        const toolContent = result[2]!.content as string
        expect(toolContent).toBe(hugeErrorOutput)
        expect(toolContent).toContain('[Tool Error]')
        expect(toolContent).toContain('Command failed with exit code 1:')
    })
})
