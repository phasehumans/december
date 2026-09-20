import { describe, it, expect } from 'bun:test'

import { Agent } from '../../src/agent'
import { executeSkillInSubagent } from '../../src/skills/skill-subagent'

import type { LLMProvider } from '@december/providers'
import type { DiscoveredSkill, Tool } from '@december/shared'

describe('SkillSubagentRunner (Unit)', () => {
    const dummySkill: DiscoveredSkill = {
        name: 'test-runner',
        metadata: {
            name: 'test-runner',
            description: 'Runs tests and checks coverage',
            allowedTools: ['read_file', 'bash'],
        },
        directoryPath: '/workspace/skills/test-runner',
        entryFilePath: '/workspace/skills/test-runner/SKILL.md',
        origin: 'workspace',
        scripts: [],
        references: [],
    }

    const readFileTool: Tool = {
        name: 'read_file',
        description: 'Read file',
        inputSchema: {},
        execute: async () => 'file content',
    }

    const bashTool: Tool = {
        name: 'bash',
        description: 'Run bash',
        inputSchema: {},
        execute: async () => 'test output passed',
    }

    const browserTool: Tool = {
        name: 'browser',
        description: 'Browser',
        inputSchema: {},
        execute: async () => 'browser',
    }

    it('should spawn subagent with scoped tools and execute to completion', async () => {
        let turn = 0
        const mockLlm: LLMProvider = {
            id: 'mock',
            stream: async function* () {
                turn++
                if (turn === 1) {
                    yield {
                        type: 'tool_call',
                        toolCall: {
                            id: 'c1',
                            name: 'bash',
                            input: JSON.stringify({ command: 'bun test' }),
                        },
                    }
                } else {
                    yield {
                        type: 'text',
                        text: 'All 15 tests passed with 100% coverage.',
                    }
                }
            },
        }

        const parentAgent = new Agent({
            tools: [readFileTool, bashTool, browserTool],
            llm: mockLlm,
            operations: {} as any,
        })

        // Give dummySkill a body generator or content
        const skillWithBody = {
            ...dummySkill,
            content: '# Test Runner\nRun tests using bash and check results.',
        }

        const result = await executeSkillInSubagent({
            skill: skillWithBody as any,
            args: ['unit'],
            task: 'Run unit test suite',
            parentAgent,
        })

        expect(result.success).toBe(true)
        expect(result.summary).toContain('All 15 tests passed')
        expect(result.subagentSessionId).toContain('subagent-test-runner')

        // Crucial: Verify parent agent conversation history was NOT polluted by subagent turns
        expect(parentAgent.messages.length).toBe(1) // Only parent's system prompt!
    })
})
