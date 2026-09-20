import { describe, it, expect } from 'bun:test'

import { Agent } from '../../src/agent'
import { createRunSkillTool } from '../../src/skills/run-skill-tool'

import type { LLMProvider } from '@december/providers'
import type { DiscoveredSkill, Tool } from '@december/shared'

describe('RunSkillTool (Unit)', () => {
    const dummySkill: DiscoveredSkill = {
        name: 'test-coverage',
        metadata: {
            name: 'test-coverage',
            description: 'Computes test coverage',
        },
        directoryPath: '/workspace/skills/test-coverage',
        entryFilePath: '/workspace/skills/test-coverage/SKILL.md',
        origin: 'workspace',
        scripts: [],
        references: [],
    }

    const bashTool: Tool = {
        name: 'bash',
        description: 'Run bash',
        inputSchema: {},
        execute: async () => 'coverage is 98%',
    }

    it('should execute subagent and return summary through tool interface', async () => {
        const mockLlm: LLMProvider = {
            id: 'mock',
            stream: async function* () {
                yield {
                    type: 'text',
                    text: 'Coverage report finished. Coverage is 98%.',
                }
            },
        }

        const parentAgent = new Agent({
            tools: [bashTool],
            llm: mockLlm,
            operations: {} as any,
        })

        const skillResolver = () => [
            { ...dummySkill, content: '# Coverage\nCheck coverage.' } as any,
        ]
        const tool = createRunSkillTool(skillResolver)

        const context = {
            operations: {} as any,
            env: new Map(),
            onStream: () => {},
            agent: parentAgent,
        }

        const output = await tool.execute(
            { skillName: 'test-coverage', task: 'Check package coverage' },
            context
        )

        expect(output).toContain('Coverage report finished')
        expect(output).toContain('98%')
    })
})
