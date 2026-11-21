import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { setSnapshotManager } from '@december/tools'
import { afterEach, beforeEach, describe, expect, it } from 'bun:test'

import { Agent } from '../../src/agent'
import { runAgentLoop } from '../../src/agent-loop'

import type { LLMProvider } from '@december/providers'
import type { Tool } from '@december/shared'

describe('Turn snapshot (Unit)', () => {
    let tempDir: string
    let finishSnapshot: () => void
    let snapshotDone: boolean
    const order: string[] = []

    beforeEach(async () => {
        tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'december-turn-snapshot-'))
        order.length = 0
        snapshotDone = false
        const gate = new Promise<void>((resolve) => {
            finishSnapshot = resolve
        })
        // A snapshot that only completes when the test says so
        setSnapshotManager({
            workspaceDir: path.resolve(tempDir),
            createSnapshot: async () => {
                order.push('snapshot:start')
                await gate
                snapshotDone = true
                order.push('snapshot:done')
                return {} as any
            },
        } as any)
    })

    afterEach(async () => {
        setSnapshotManager(null)
        await fs.rm(tempDir, { recursive: true, force: true })
    })

    const tool = (name: string): Tool => ({
        name,
        description: name,
        inputSchema: {},
        execute: async () => {
            order.push(`${name}:snapshotDone=${snapshotDone}`)
            return 'ok'
        },
    })

    it('starts the model request before the snapshot ends, and file-changing tools wait for it', async () => {
        let call = 0
        const llm: LLMProvider = {
            id: 'mock',
            stream: async function* () {
                call++
                if (call === 1) {
                    order.push('request')
                    // The request is running while the snapshot is still open
                    setTimeout(() => finishSnapshot(), 20)
                    yield {
                        type: 'tool_call',
                        toolCall: { id: 'c1', name: 'read_file', input: '{}' },
                    }
                    yield {
                        type: 'tool_call',
                        toolCall: { id: 'c2', name: 'write_file', input: '{}' },
                    }
                } else {
                    yield { type: 'text', text: 'done' }
                }
            },
        }

        const agent = new Agent({
            llm,
            tools: [tool('read_file'), tool('write_file')],
            operations: {} as any,
            workspaceDir: tempDir,
        })

        for await (const _event of runAgentLoop(agent, 'change a file')) {
            // drain events
        }

        expect(order.indexOf('request')).toBeLessThan(order.indexOf('snapshot:done'))
        expect(order).toContain('write_file:snapshotDone=true')
        expect(order.indexOf('snapshot:done')).toBeLessThan(
            order.indexOf('write_file:snapshotDone=true')
        )
    })
})
