import { describe, expect, it } from 'bun:test'

import {
    ActivityTracker,
    planStepsFromText,
    type ActivityInput,
} from '../../src/renderer/views/activity-line-view'
import { MessageLineCache } from '../../src/renderer/views/message-line-cache'
import { editDiffRows, editResultLines } from '../../src/utils/edit-diff'

import type { FormattedLine } from '../../src/renderer/views/markdown'
import type { MessageItem } from '../../src/renderer/views/message-list-view'

const T0 = 1_000_000
const text = (line?: FormattedLine) => (line ?? []).map((s) => s.text).join('')
const input = (over: Partial<ActivityInput> = {}): ActivityInput => ({
    messages: [{ role: 'user', content: 'go' }],
    isStreaming: true,
    waitingForUser: false,
    now: T0 + 1000,
    turnStartedAt: T0,
    pausedMs: 0,
    lastActivityAt: T0 + 900,
    firstTokenAt: T0 + 500,
    isColdStart: false,
    reduceMotion: true,
    ...over,
})

describe('F1: retry from the typed AgentRetry event', () => {
    it('shows the countdown with no status text to parse', () => {
        const lines = new ActivityTracker().getLines(
            input({
                retry: { attempt: 2, max: 5, reason: 'Opus 5.5 rate limit', nextAt: T0 + 4000 },
            }),
            120
        )
        expect(text(lines[0])).toBe(
            '✱ Retrying the request… · Opus 5.5 rate limit  next try in 3s · attempt 2 of 5'
        )
    })
})

describe('F2: checklist from an approved plan', () => {
    it('takes the numbered steps, the first one current', () => {
        expect(
            planStepsFromText('Plan:\n1. Move **TTL** to env\n2) Add `idle` timeout\nnot a step')
        ).toEqual([
            { text: 'Move TTL to env', status: 'in_progress' },
            { text: 'Add idle timeout', status: 'pending' },
        ])
    })

    it('shows the seeded plan until the agent sends update_plan', () => {
        const seededPlan = planStepsFromText('1. Move TTL to env\n2. Update tests')
        const seeded = new ActivityTracker().getLines(input({ seededPlan }), 100).map(text)
        expect(seeded.slice(1)).toEqual(['    ▸ Move TTL to env', '    ○ Update tests'])

        const own: MessageItem[] = [
            { role: 'user', content: 'go' },
            {
                role: 'tool',
                toolCall: {
                    id: 'p',
                    name: 'update_plan',
                    status: 'success',
                    input: { items: [{ text: 'Agent step', status: 'in_progress' }] },
                },
            },
        ]
        expect(
            new ActivityTracker()
                .getLines(input({ messages: own, seededPlan }), 100)
                .map(text)
                .slice(1)
        ).toEqual(['    ▸ Agent step'])
    })
})

describe('F7: MCP rows use the server name from the agent', () => {
    it('names the server and the original tool', () => {
        const rows = new MessageLineCache()
            .getLines(
                [
                    {
                        role: 'tool',
                        toolCall: {
                            id: '1',
                            name: 'mcp_linear_app_create_issue',
                            mcpServer: 'linear_app',
                            mcpTool: 'create_issue',
                            status: 'success',
                            input: { title: 'Session TTL ignores env' },
                            output: 'ENG-482 created',
                        },
                    },
                ],
                100
            )
            .map(text)
        expect(rows[0]).toBe('● linear_app · create issue "Session TTL ignores env"')
        expect(rows[1]).toBe('    └ ENG-482 created')
    })
})

describe('F8: line numbers from the edit tool result', () => {
    it('reads one or several lines from the result', () => {
        expect(editResultLines('Successfully edited file: a.ts (line 15)')).toEqual([15])
        expect(
            editResultLines(
                'Successfully edited file: a.ts (2 disjoint replacements applied at lines 2, 6)'
            )
        ).toEqual([2, 6])
        expect(editResultLines('Failed to edit file: nope')).toEqual([])
    })

    it('numbers the diff from the reported line when the file cannot be read', () => {
        const rows = editDiffRows('does/not/exist.ts', [{ oldText: 'a', newText: 'b\nc' }], [15])
        expect(rows.map((r) => `${r.lineNo} ${r.type} ${r.text}`)).toEqual([
            '15 delete a',
            '15 add b',
            '16 add c',
        ])
    })
})
