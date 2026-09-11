import { describe, test, expect } from 'bun:test'

import {
    compactContextIfNeeded,
    pruneToolResults,
    extractFileManifests,
    formatFileManifestsXml,
} from '../../src/utils/compaction'
import { MockLLM } from '../mock-provider'

import type { Message } from '@december/shared'

describe('compactContextIfNeeded (Unit)', () => {
    test('does not compact if below threshold', async () => {
        const messages: Message[] = [
            { role: 'system', content: 'You are an agent' },
            { role: 'user', content: 'hello' },
        ]
        const llm = new MockLLM()
        const result = await compactContextIfNeeded(messages, llm, 1000)
        expect(result.length).toBe(2)
        expect(result).toEqual(messages)
    })

    test('compacts if above threshold and length > 21', async () => {
        const messages: Message[] = [{ role: 'system', content: 'You are an agent' }]
        for (let i = 0; i < 25; i++) {
            messages.push({ role: 'user', content: 'a'.repeat(100) })
        }

        const llm = new MockLLM()
        llm.pushResponse('Structured Summary Goal: Fix bugs')

        const result = await compactContextIfNeeded(messages, llm, 10)

        expect(result.length).toBe(22)
        expect(result[0]!.role).toBe('system')
        expect(result[1]!.role).toBe('system')
        expect(result[1]!.content).toContain('[COMPACTED HISTORY SUMMARY]')
        expect(result[1]!.content).toContain('Structured Summary Goal: Fix bugs')
        expect(result[2]!.role).toBe('user')
    })

    test('updates previous compacted summary if previous summary exists in middle history', async () => {
        const messages: Message[] = [
            { role: 'system', content: 'You are an agent' },
            { role: 'system', content: '[COMPACTED HISTORY SUMMARY]\nPrevious summary content' },
        ]
        for (let i = 0; i < 25; i++) {
            messages.push({
                role: 'user',
                content: 'tool message',
                toolCalls: [{ id: `tc-${i}`, name: 'bash', input: '{"cmd":"ls"}' }],
            })
        }

        const llm = new MockLLM()
        llm.pushResponse('Updated Summary Content')

        const result = await compactContextIfNeeded(messages, llm, 10)

        expect(result.length).toBe(22)
        expect(result[1]!.content).toContain('Updated Summary Content')
        expect(llm.calls.length).toBe(1)
        expect(llm.calls[0]!.messages[1]!.content).toContain('NEW conversation messages')
        expect(llm.calls[0]!.messages[1]!.content).toContain('File & Code State')
        expect(llm.calls[0]!.messages[1]!.content).toContain('Critical Context & Tracebacks')
    })

    test('uses MODEL_CONTEXT_WINDOWS when model option is provided', async () => {
        const messages: Message[] = [{ role: 'system', content: 'You are an agent' }]
        for (let i = 0; i < 25; i++) {
            messages.push({ role: 'user', content: 'a'.repeat(100) })
        }

        const llm = new MockLLM()
        // Provide model option for anthropic claude-3-5-sonnet-20241022 (200,000 tokens limit)
        // 25 * 100 char = ~625 tokens, which is well below 200,000 * 0.8 = 160,000
        const resultNoCompact = await compactContextIfNeeded(messages, llm, undefined, {
            model: 'claude-3-5-sonnet-20241022',
        })
        expect(resultNoCompact.length).toBe(26) // Not compacted because limit is large
    })

    test('does not compact if length <= 21 even if tokens exceed', async () => {
        const messages: Message[] = [{ role: 'system', content: 'You are an agent' }]
        for (let i = 0; i < 20; i++) {
            messages.push({ role: 'user', content: 'a'.repeat(100) })
        }

        const llm = new MockLLM()
        const result = await compactContextIfNeeded(messages, llm, 10)

        expect(result.length).toBe(21)
    })

    test('throws abort error if signal is aborted during compaction', async () => {
        const messages: Message[] = [{ role: 'system', content: 'You are an agent' }]
        for (let i = 0; i < 25; i++) {
            messages.push({ role: 'user', content: 'a'.repeat(100) })
        }

        const llm = new MockLLM()
        const controller = new AbortController()
        controller.abort()

        await expect(
            compactContextIfNeeded(messages, llm, 10, undefined, controller.signal)
        ).rejects.toThrow('Aborted')
    })
})

describe('pruneToolResults (Tier 1)', () => {
    test('does not prune if tokens saved is less than minimum savings', () => {
        const messages: Message[] = [
            { role: 'user', content: 'user 1' },
            {
                role: 'assistant',
                content: '',
                toolCalls: [{ id: 'call_1', name: 'read_file', input: '{"path":"a.ts"}' }],
            },
            { role: 'tool', toolCallId: 'call_1', content: 'short output' },
            { role: 'user', content: 'user 2' },
            { role: 'assistant', content: 'answer 2' },
            { role: 'user', content: 'user 3' },
            { role: 'assistant', content: 'answer 3' },
        ]

        const result = pruneToolResults(messages)
        expect(result.pruned).toBe(false)
        expect(result.tokensSaved).toBe(0)
        expect(messages[2]!.content).toBe('short output')
    })

    test('protects the last 2 user turns untouched', () => {
        const messages: Message[] = [
            // Turn 1 (old)
            { role: 'user', content: 'user 1' },
            {
                role: 'assistant',
                content: '',
                toolCalls: [{ id: 'call_old', name: 'bash', input: '{"cmd":"run"}' }],
            },
            { role: 'tool', toolCallId: 'call_old', content: 'x'.repeat(400) },
            // Turn 2
            { role: 'user', content: 'user 2' },
            {
                role: 'assistant',
                content: '',
                toolCalls: [{ id: 'call_recent', name: 'bash', input: '{"cmd":"run"}' }],
            },
            { role: 'tool', toolCallId: 'call_recent', content: 'y'.repeat(400) },
            // Turn 3 (most recent)
            { role: 'user', content: 'user 3' },
            { role: 'assistant', content: 'answer 3' },
        ]

        // Use low thresholds for testing
        const result = pruneToolResults(messages, {
            protectTokens: 50,
            minSavings: 50,
        })

        expect(result.pruned).toBe(true)
        // call_old should be pruned because it is in Turn 1 (older than 2 turns back)
        expect(messages[2]!.content).toBe('[Old tool result content cleared]')
        // call_recent should NOT be pruned because it is in Turn 2 (within last 2 user turns)
        expect(messages[5]!.content).toBe('y'.repeat(400))
    })

    test('exempts protected tools like skill', () => {
        const messages: Message[] = [
            { role: 'user', content: 'user 1' },
            {
                role: 'assistant',
                content: '',
                toolCalls: [{ id: 'call_skill', name: 'skill', input: '{"name":"code"}' }],
            },
            { role: 'tool', toolCallId: 'call_skill', content: 'skill output '.repeat(50) },
            { role: 'user', content: 'user 2' },
            { role: 'assistant', content: 'answer 2' },
            { role: 'user', content: 'user 3' },
            { role: 'assistant', content: 'answer 3' },
        ]

        const result = pruneToolResults(messages, {
            protectTokens: 10,
            minSavings: 10,
            protectedTools: new Set(['skill']),
        })

        expect(result.pruned).toBe(false)
        expect(messages[2]!.content).toContain('skill output')
    })
})

describe('extractFileManifests (Tier 2)', () => {
    test('extracts read and modified files and partitions them correctly', () => {
        const messages: Message[] = [
            {
                role: 'assistant',
                content: '',
                toolCalls: [
                    { id: '1', name: 'read_file', input: JSON.stringify({ path: 'src/index.ts' }) },
                    {
                        id: '2',
                        name: 'view_file',
                        input: JSON.stringify({ AbsolutePath: 'src/utils.ts' }),
                    },
                    { id: '3', name: 'edit_file', input: JSON.stringify({ path: 'src/index.ts' }) },
                    {
                        id: '4',
                        name: 'write_file',
                        input: JSON.stringify({ filePath: 'src/config.ts' }),
                    },
                ],
            },
        ]

        const manifests = extractFileManifests(messages)

        // src/index.ts was both read and edited, so it must be partitioned into modifiedFiles only
        expect(manifests.modifiedFiles).toContain('src/index.ts')
        expect(manifests.modifiedFiles).toContain('src/config.ts')
        expect(manifests.readFiles).toContain('src/utils.ts')
        expect(manifests.readFiles).not.toContain('src/index.ts')

        const xml = formatFileManifestsXml(manifests)
        expect(xml).toContain('<read-files>\nsrc/utils.ts\n</read-files>')
        expect(xml).toContain('<modified-files>\nsrc/config.ts\nsrc/index.ts\n</modified-files>')
    })

    test('inherits previous manifests across subsequent compactions', () => {
        const previousSummary = `Some summary...
<read-files>
src/old-read.ts
src/to-be-modified.ts
</read-files>

<modified-files>
src/old-modified.ts
</modified-files>`

        const newMessages: Message[] = [
            {
                role: 'assistant',
                content: '',
                toolCalls: [
                    {
                        id: '1',
                        name: 'edit_file',
                        input: JSON.stringify({ path: 'src/to-be-modified.ts' }),
                    },
                    {
                        id: '2',
                        name: 'read_file',
                        input: JSON.stringify({ path: 'src/new-read.ts' }),
                    },
                ],
            },
        ]

        const manifests = extractFileManifests(newMessages, previousSummary)

        expect(manifests.modifiedFiles).toContain('src/old-modified.ts')
        expect(manifests.modifiedFiles).toContain('src/to-be-modified.ts')
        expect(manifests.readFiles).toContain('src/old-read.ts')
        expect(manifests.readFiles).toContain('src/new-read.ts')
        expect(manifests.readFiles).not.toContain('src/to-be-modified.ts')
    })
})
