import { describe, it, expect, beforeEach } from 'bun:test'

import { Agent } from '../../src/agent'
import { SubagentManager } from '../../src/subagent/subagent-manager'
import {
    createInvokeSubagentTool,
    createManageSubagentTool,
    createSpawnSubagentTool,
} from '../../src/subagent/subagent-tool'

import type { LLMProvider } from '@december/providers'
import type { Tool } from '@december/shared'

describe('Subagent Tools (Unit)', () => {
    let manager: SubagentManager
    const readFileTool: Tool = {
        name: 'read_file',
        description: 'Read file',
        inputSchema: {},
        execute: async () => 'sample file contents',
    }

    beforeEach(() => {
        manager = new SubagentManager()
    })

    it('invoke_subagent executes synchronously and returns rollup summary by default', async () => {
        const mockLlm: LLMProvider = {
            id: 'mock',
            stream: async function* () {
                yield {
                    type: 'text',
                    text: 'Completed security analysis: No vulnerabilities found.',
                }
            },
        }

        const parentAgent = new Agent({
            tools: [readFileTool],
            llm: mockLlm,
            operations: {} as any,
        })

        const invokeTool = createInvokeSubagentTool(manager)
        const context = {
            operations: {} as any,
            env: new Map(),
            onStream: () => {},
            agent: parentAgent,
        }

        const result = await invokeTool.execute(
            {
                role: 'security-reviewer',
                task: 'Audit authentication endpoints',
            },
            context
        )

        expect(result).toContain('Subagent: security-reviewer')
        expect(result).toContain('No vulnerabilities found')
    })

    it('spawn_subagent alias works identically', async () => {
        const spawnTool = createSpawnSubagentTool(manager)
        expect(spawnTool.name).toBe('spawn_subagent')
    })

    it('invoke_subagent with background: true returns immediately with subagent id and status', async () => {
        const mockLlm: LLMProvider = {
            id: 'mock',
            stream: async function* () {
                yield { type: 'text', text: 'Background work' }
            },
        }

        const parentAgent = new Agent({
            tools: [readFileTool],
            llm: mockLlm,
            operations: {} as any,
        })

        const invokeTool = createInvokeSubagentTool(manager)
        const context = {
            operations: {} as any,
            env: new Map(),
            onStream: () => {},
            agent: parentAgent,
        }

        const result = await invokeTool.execute(
            {
                role: 'indexer',
                task: 'Index codebase',
                background: true,
            },
            context
        )

        expect(result).toContain('Subagent spawned in background')
        expect(result).toContain('indexer')
        expect(result).toContain('manage_subagent')
    })

    it('manage_subagent tool supports status, list, message, and kill actions', async () => {
        let resolveStream: () => void = () => {}
        const blocker = new Promise<void>((r) => {
            resolveStream = r
        })

        const mockLlm: LLMProvider = {
            id: 'mock',
            stream: async function* () {
                await blocker
                yield { type: 'text', text: 'Finished after delay' }
            },
        }

        const parentAgent = new Agent({
            tools: [readFileTool],
            llm: mockLlm,
            operations: {} as any,
        })

        const handle = manager.spawnBackground({
            role: 'tester',
            task: 'Long test execution',
            parentAgent,
        })

        const manageTool = createManageSubagentTool(manager)
        const context = {
            operations: {} as any,
            env: new Map(),
            onStream: () => {},
            agent: parentAgent,
        }

        // 1. List
        const listResult = await manageTool.execute({ action: 'list' }, context)
        expect(listResult).toContain(handle.id)
        expect(listResult).toContain('tester')

        // 2. Status
        const statusResult = await manageTool.execute(
            { action: 'status', subagentId: handle.id },
            context
        )
        expect(statusResult.toLowerCase()).toContain('running')

        // 3. Message
        const msgResult = await manageTool.execute(
            {
                action: 'message',
                subagentId: handle.id,
                message: 'Include coverage in summary',
            },
            context
        )
        expect(msgResult).toContain('Message queued for subagent')

        // 4. Kill
        const killResult = await manageTool.execute(
            { action: 'kill', subagentId: handle.id },
            context
        )
        expect(killResult).toContain('killed')

        resolveStream()
    })
})
