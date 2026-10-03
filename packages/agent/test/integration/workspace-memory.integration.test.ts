import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { ManageMemoryTool } from '@december/tools'
import { describe, expect, it, beforeEach, afterEach } from 'bun:test'

import { Agent } from '../../src/agent'
import { runAgentLoop } from '../../src/agent-loop'
import { MockLLM } from '../mock-provider'

describe('Workspace Memory & Persistence (Integration)', () => {
    let tmpDir: string

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'workspace-memory-integ-'))
    })

    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true })
    })

    it('injects .december/memory.md into systemPrompt and delivers it to LLM provider during loop', async () => {
        const decDir = path.join(tmpDir, '.december')
        fs.mkdirSync(decDir, { recursive: true })
        fs.writeFileSync(
            path.join(decDir, 'memory.md'),
            '## build_and_test\n- bun test packages/agent\n\n## quirks\n- database migrations required'
        )

        const mockLlm = new MockLLM()
        mockLlm.pushResponse([{ type: 'text', text: 'Acknowledged project context.' }])

        const agent = new Agent({
            llm: mockLlm,
            tools: [],
            operations: {} as any,
            workspaceDir: tmpDir,
            systemPrompt: 'You are December.',
        })

        const events = []
        for await (const event of runAgentLoop(agent, 'How do I run tests?')) {
            events.push(event)
        }

        expect(mockLlm.calls.length).toBe(1)
        const calledPrompt = mockLlm.calls[0]!.systemPrompt!
        expect(calledPrompt).toContain('<project_memory>')
        expect(calledPrompt).toContain('## build_and_test')
        expect(calledPrompt).toContain('bun test packages/agent')
        expect(calledPrompt).toContain('## quirks')
        expect(calledPrompt).toContain('database migrations required')
        expect(calledPrompt).toContain('</project_memory>')

        expect(agent.messages.length).toBe(3) // system, user, assistant
        expect(agent.messages[0]!.content).toContain('<project_memory>')
        expect(agent.messages[2]!.content).toBe('Acknowledged project context.')
    })

    it('delivers combined MEMORY.md and RULES.md context to LLM provider during loop', async () => {
        fs.writeFileSync(
            path.join(tmpDir, 'MEMORY.md'),
            '## conventions\n- use typed error boundaries'
        )
        fs.writeFileSync(
            path.join(tmpDir, 'RULES.md'),
            '## rules\n- strictly lowercase commit messages'
        )

        const mockLlm = new MockLLM()
        mockLlm.pushResponse([{ type: 'text', text: 'Rules understood.' }])

        const agent = new Agent({
            llm: mockLlm,
            tools: [],
            operations: {} as any,
            workspaceDir: tmpDir,
            systemPrompt: 'You are December.',
        })

        for await (const _ of runAgentLoop(agent, 'Check rules.')) {
            // Intentionally consume generator events
        }

        expect(mockLlm.calls.length).toBe(1)
        const prompt = mockLlm.calls[0]!.systemPrompt!
        expect(prompt).toContain('<project_memory>')
        expect(prompt).toContain('use typed error boundaries')
        expect(prompt).toContain('strictly lowercase commit messages')
        expect(prompt).toContain('</project_memory>')
    })

    it('records a new quirk via manage_memory tool and subsequent session passive load picks it up', async () => {
        const operations: any = {
            env: {
                cwd: () => tmpDir,
            },
            fs: {
                readFile: async (p: string) => {
                    const full = path.isAbsolute(p) ? p : path.join(tmpDir, p)
                    return fs.readFileSync(full, 'utf8')
                },
                writeFile: async (p: string, content: string) => {
                    const full = path.isAbsolute(p) ? p : path.join(tmpDir, p)
                    fs.mkdirSync(path.dirname(full), { recursive: true })
                    fs.writeFileSync(full, content, 'utf8')
                },
            },
        }

        const mockLlm = new MockLLM()
        // Turn 1: tool call to record memory
        mockLlm.pushResponse([
            {
                type: 'tool_call_delta',
                id: 'call-mem-1',
                name: 'manage_memory',
                inputDelta: JSON.stringify({
                    action: 'record',
                    category: 'quirks',
                    entry: 'test suites require isolated test db',
                }),
            },
        ])
        mockLlm.pushResponse([
            {
                type: 'text',
                text: 'Recorded the test database quirk in memory.',
            },
        ])

        const agent1 = new Agent({
            llm: mockLlm,
            tools: [ManageMemoryTool],
            operations,
            workspaceDir: tmpDir,
            systemPrompt: 'You are December.',
        })

        for await (const _ of runAgentLoop(
            agent1,
            'Please record that tests require isolated db.'
        )) {
            // Intentionally consume events
        }

        // Verify the file was written
        const memFilePath = path.join(tmpDir, '.december', 'memory.md')
        expect(fs.existsSync(memFilePath)).toBe(true)
        const savedMemory = fs.readFileSync(memFilePath, 'utf8')
        expect(savedMemory).toContain('## quirks')
        expect(savedMemory).toContain('test suites require isolated test db')

        // Turn 2: new session in same workspace root automatically ingests saved memory
        const mockLlm2 = new MockLLM()
        mockLlm2.pushResponse([{ type: 'text', text: 'Ready with saved quirks.' }])

        const agent2 = new Agent({
            llm: mockLlm2,
            tools: [ManageMemoryTool],
            operations,
            workspaceDir: tmpDir,
            systemPrompt: 'You are December.',
        })

        for await (const _ of runAgentLoop(agent2, 'Start new turn.')) {
            // Intentionally consume events
        }

        expect(mockLlm2.calls.length).toBe(1)
        const agent2Prompt = mockLlm2.calls[0]!.systemPrompt!
        expect(agent2Prompt).toContain('<project_memory>')
        expect(agent2Prompt).toContain('## quirks')
        expect(agent2Prompt).toContain('test suites require isolated test db')
        expect(agent2Prompt).toContain('</project_memory>')
    })

    it('gracefully executes agent loop when no memory or rules files exist', async () => {
        const mockLlm = new MockLLM()
        mockLlm.pushResponse([{ type: 'text', text: 'No memory, standard prompt.' }])

        const agent = new Agent({
            llm: mockLlm,
            tools: [],
            operations: {} as any,
            workspaceDir: tmpDir,
            systemPrompt: 'You are December.',
        })

        for await (const _ of runAgentLoop(agent, 'Hello!')) {
            // Intentionally consume events
        }

        expect(mockLlm.calls.length).toBe(1)
        const prompt = mockLlm.calls[0]!.systemPrompt!
        expect(prompt).not.toContain('<project_memory>')
        expect(prompt).toBe('You are December.')
    })
})
