import { describe, expect, it } from 'bun:test'

import {
    ActivityTracker,
    activitySentence,
    detectPhase,
    hintFor,
    parseRetryStatus,
    thoughtTopic,
    type ActivityInput,
} from '../../src/renderer/views/activity-line-view'
import { THEME } from '../../src/theme'
import { latestThoughtSentence } from '../../src/utils/thought'

import type { FormattedLine } from '../../src/renderer/views/markdown'
import type { MessageItem } from '../../src/renderer/views/message-list-view'

const T0 = 1_000_000
const text = (line?: FormattedLine) => (line ?? []).map((s) => s.text).join('')

function input(over: Partial<ActivityInput> = {}): ActivityInput {
    return {
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
    }
}

const running = (name: string, toolInput: Record<string, unknown>): MessageItem => ({
    role: 'tool',
    toolCall: { id: name, name, input: toolInput, status: 'running' },
})

describe('activity line (L0)', () => {
    it('draws nothing when no turn runs', () => {
        expect(new ActivityTracker().getLines(input({ isStreaming: false }), 100)).toEqual([])
    })

    it('uses plain sentences for each phase (W1-D)', () => {
        expect(activitySentence('thinking', 'session TTL source')).toBe(
            'Thinking about session TTL source'
        )
        expect(activitySentence('writing')).toBe('Writing the reply')
        expect(activitySentence('exploring', 'src/auth')).toBe('Looking through src/auth')
        expect(activitySentence('editing', 'env.ts')).toBe('Editing env.ts')
        expect(activitySentence('running', 'bun test')).toBe('Running bun test')
        expect(activitySentence('delegating', '2 agents')).toBe('Working with 2 agents')
        expect(activitySentence('compacting')).toBe('Compacting the conversation')
        expect(activitySentence('thinking', undefined, true)).toBe('Still waiting on the provider')
        // L21: no topic gives a plain "Thinking"; a verb-led topic is the sentence itself
        expect(activitySentence('thinking')).toBe('Thinking')
        expect(activitySentence('thinking', 'checking the session config')).toBe(
            'Checking the session config'
        )
    })

    it('takes the thought topic from the newest bold header only (L21)', () => {
        expect(thoughtTopic('**Locating the TTL source**\nsome text')).toBe(
            'locating the TTL source'
        )
        expect(thoughtTopic('**Check the session config**')).toBe('checking the session config')
        expect(thoughtTopic('**TTL handling**')).toBe('TTL handling')
        // A raw sentence does not make a topic
        expect(thoughtTopic('Let me check where the session TTL is set.')).toBe('')
    })

    it('reads the phase from the live messages', () => {
        const thinking = detectPhase(
            input({
                messages: [
                    { role: 'user', content: 'x' },
                    { role: 'thinking', content: '**Session TTL source**', isStreaming: true },
                ],
            })
        )
        expect(thinking).toEqual({
            phase: 'thinking',
            detail: 'session TTL source',
            thought: '**Session TTL source**',
        })

        const writing = detectPhase(
            input({
                messages: [
                    { role: 'user', content: 'x' },
                    { role: 'assistant', content: 'The TTL', isStreaming: true },
                ],
            })
        )
        expect(writing?.phase).toBe('writing')

        expect(
            detectPhase(
                input({
                    messages: [
                        { role: 'user', content: 'x' },
                        running('bash', { command: 'bun test' }),
                    ],
                })
            )
        ).toEqual({ phase: 'running', detail: 'bun test' })
        expect(
            detectPhase(
                input({
                    messages: [
                        { role: 'user', content: 'x' },
                        running('edit_file', { path: 'src/env.ts' }),
                    ],
                })
            )
        ).toEqual({ phase: 'editing', detail: 'src/env.ts' })
        expect(
            detectPhase(
                input({
                    messages: [
                        { role: 'user', content: 'x' },
                        running('invoke_subagent', { role: 'explorer' }),
                        running('spawn_subagent', { role: 'reviewer' }),
                    ],
                })
            )
        ).toEqual({ phase: 'delegating', detail: '2 agents' })
        expect(detectPhase(input({ waitingForUser: true }))?.phase).toBe('waiting')
        expect(detectPhase(input({ statusMessage: 'Compacting conversation...' }))?.phase).toBe(
            'compacting'
        )
    })

    it('shows the sentence and the elapsed time after 3s, with no token count or Esc hint', () => {
        const tracker = new ActivityTracker()
        const lines = tracker.getLines(
            input({
                messages: [
                    { role: 'user', content: 'x' },
                    running('bash', { command: 'bun test' }),
                ],
                now: T0 + 14_000,
                lastActivityAt: T0 + 13_000,
            }),
            100
        )
        expect(text(lines[0])).toBe('✱ Running bun test…  14s')
        expect(text(lines[0])).not.toContain('tokens')
        expect(lines[0]![0]!.style?.fg).toBe(THEME.colors.brand)

        const early = new ActivityTracker().getLines(input({ now: T0 + 1500 }), 100)
        expect(text(early[0])).toBe('✱ Thinking…')

        // After 5s in the phase a hint shows, never "esc to interrupt" (L21)
        const later = tracker.getLines(
            input({
                messages: [
                    { role: 'user', content: 'x' },
                    running('bash', { command: 'bun test' }),
                ],
                now: T0 + 20_000,
                lastActivityAt: T0 + 19_000,
            }),
            100
        )
        expect(text(later[0])).toMatch(/^✱ Running bun test… {2}20s · (ctrl\+b|\/tasks)/)
    })

    it('rotates hints and tips after the first 5s of a phase (L0.6, L18-A)', () => {
        expect(hintFor('running', 1000, 0)).toBe('')
        const seen = new Set<string>()
        for (let t = 0; t < 20_000; t += 4000)
            seen.add(hintFor('running', 10_000, t, '/fork branches this chat'))
        expect(seen).toEqual(
            new Set([
                'ctrl+b to background',
                '/tasks lists background work',
                '/fork branches this chat',
            ])
        )
        expect([...seen].some((h) => h.startsWith('tip'))).toBe(false)
        expect(hintFor('retrying', 10_000, 0)).toBe('')
    })

    it('breathes the ✱ glyph and keeps it to one cell (L1-A)', () => {
        const tracker = new ActivityTracker()
        const glyphs = new Set<string>()
        for (let t = 0; t < 1040; t += 130) {
            const line = tracker.getLines(input({ reduceMotion: false, now: T0 + t }), 100)[0]!
            glyphs.add(line[0]!.text)
        }
        expect([...glyphs].every((g) => g.length === 2)).toBe(true)
        expect(glyphs.size).toBeGreaterThan(3)
        const narrow = new ActivityTracker().getLines(
            input({ reduceMotion: false, wideAmbiguous: true, now: T0 }),
            100
        )[0]!
        expect(['. ', '* ', '✱ ', '✲ ']).toContain(narrow[0]!.text)
    })

    it('says when the provider has not answered yet, then when it stalls (L4, L12)', () => {
        const waitingOnProvider = new ActivityTracker().getLines(
            input({ now: T0 + 9000, firstTokenAt: 0, lastActivityAt: 0 }),
            100
        )
        expect(text(waitingOnProvider[0])).toContain('9s · waiting on provider')

        const stalled = new ActivityTracker().getLines(
            input({ now: T0 + 64_000, lastActivityAt: T0 + 40_000 }),
            100
        )
        expect(text(stalled[0])).toContain('Still waiting on the provider…')
        expect(text(stalled[0])).toContain('no response for 24s')
        expect(stalled[0]![0]!.style?.fg).toBe(THEME.colors.warning)
    })

    it('warms up on the first turn of a session (W5.5)', () => {
        const lines = new ActivityTracker().getLines(
            input({ firstTokenAt: 0, isColdStart: true }),
            100
        )
        expect(text(lines[0])).toContain('Warming up…')
    })

    it('shows retries with a countdown (L11)', () => {
        const status = 'Opus 5.5 rate limit hit. Retrying in 4s... (attempt 2/5)'
        expect(parseRetryStatus(status, T0)).toEqual({
            reason: 'Opus 5.5 rate limit',
            attempt: 2,
            max: 5,
            nextAt: T0 + 4000,
        })
        const lines = new ActivityTracker().getLines(
            input({ statusMessage: status, statusSetAt: T0, now: T0 + 1000 }),
            120
        )
        expect(text(lines[0])).toBe(
            '✱ Retrying the request… · Opus 5.5 rate limit  next try in 3s · attempt 2 of 5'
        )
        expect(lines[0]![0]!.style?.fg).toBe(THEME.colors.warning)
    })

    it('names the context size while compacting (L13)', () => {
        const lines = new ActivityTracker().getLines(
            input({ statusMessage: 'Compacting conversation...', contextTokens: 182_400 }),
            100
        )
        expect(text(lines[0])).toContain('Compacting 182k tokens…')
    })

    it('pauses the timer while waiting for the user (L10)', () => {
        const lines = new ActivityTracker().getLines(
            input({ waitingForUser: true, now: T0 + 100_000, pauseStartedAt: T0 + 72_000 }),
            100
        )
        expect(text(lines[0])).toBe('✱ Waiting for you  paused at 1m 12s')
        expect(lines[0]![0]!.style?.fg).toBe(THEME.colors.warning)
    })

    it('changes the thinking topic when a new header arrives, held at least 2.5s (L21)', () => {
        const tracker = new ActivityTracker()
        const msgs = (topic: string): MessageItem[] => [
            { role: 'user', content: 'x' },
            { role: 'thinking', content: `**${topic}**`, isStreaming: true },
        ]
        expect(
            text(tracker.getLines(input({ messages: msgs('Session TTL'), now: T0 }), 100)[0])
        ).toContain('Thinking about session TTL…')
        expect(
            text(tracker.getLines(input({ messages: msgs('Env loader'), now: T0 + 1000 }), 100)[0])
        ).toContain('Thinking about session TTL…')
        expect(
            text(tracker.getLines(input({ messages: msgs('Env loader'), now: T0 + 3000 }), 100)[0])
        ).toContain('Thinking about env loader…')
    })

    it('adds "still on it" after 2 minutes in one phase (W5.4)', () => {
        const tracker = new ActivityTracker()
        tracker.getLines(input({ now: T0 }), 100)
        const later = tracker.getLines(
            input({ now: T0 + 125_000, lastActivityAt: T0 + 124_000 }),
            100
        )
        expect(text(later[0])).toContain('2m 05s · still on it')
    })

    it('lists the plan and queued messages under the line (L19, L14)', () => {
        const lines = new ActivityTracker().getLines(
            input({
                messages: [
                    { role: 'user', content: 'x' },
                    {
                        role: 'tool',
                        toolCall: {
                            id: 'p',
                            name: 'update_plan',
                            status: 'success',
                            input: {
                                items: [
                                    { text: 'Find where the TTL is set', status: 'done' },
                                    { text: 'Move TTL to env', status: 'in_progress' },
                                    { text: 'Update tests', status: 'pending' },
                                ],
                            },
                        },
                    },
                ],
                queued: ['also update the docs'],
            }),
            100
        )
        expect(lines.slice(1).map(text)).toEqual([
            '    ✓ Find where the TTL is set',
            '    ▸ Move TTL to env',
            '    ○ Update tests',
            '    ❭ also update the docs',
            '      queued · sends when this turn ends · ↑ to edit',
        ])
    })

    it('folds done plan items when the list is long', () => {
        const items = Array.from({ length: 8 }, (_, i) => ({
            text: `step ${i}`,
            status: i < 4 ? 'done' : i === 4 ? 'in_progress' : 'pending',
        }))
        const lines = new ActivityTracker().getLines(
            input({
                messages: [
                    { role: 'user', content: 'x' },
                    {
                        role: 'tool',
                        toolCall: {
                            id: 'p',
                            name: 'update_plan',
                            status: 'success',
                            input: { items },
                        },
                    },
                ],
            }),
            100
        )
        expect(text(lines[1])).toBe('    ✓ 4 done')
        expect(lines.length).toBe(6)
    })

    it('drops the rotating hint, then shortens the sentence on narrow terminals (S24)', () => {
        const lines = new ActivityTracker().getLines(
            input({
                messages: [
                    { role: 'user', content: 'x' },
                    running('bash', { command: 'bun test --coverage packages/tui/test/unit' }),
                ],
                now: T0 + 14_000,
                lastActivityAt: T0 + 13_000,
            }),
            50
        )
        const row = text(lines[0])
        expect(row.length).toBeLessThanOrEqual(50)
        expect(row).not.toContain('esc')
        expect(row).toContain('…')
    })

    it('shows the live thought on line 2 and no hint on line 1 (L21)', () => {
        const tracker = new ActivityTracker()
        const msgs = (content: string): MessageItem[] => [
            { role: 'user', content: 'x' },
            { role: 'thinking', content, isStreaming: true },
        ]
        const first =
            '**Session TTL source**\nThe TTL is set in createSession. Two callers pass 3600 directly.'
        let lines = tracker.getLines(input({ messages: msgs(first), now: T0 + 10_000 }), 100)
        expect(text(lines[0])).toBe('✱ Thinking about session TTL source…  10s')
        expect(text(lines[1])).toBe('    Two callers pass 3600 directly')
        expect(lines[1]![0]!.style?.fg).toBe(THEME.colors.dim)

        // Held 2.5s, then the newer sentence
        const next = `${first} Nothing reads the env value.`
        lines = tracker.getLines(input({ messages: msgs(next), now: T0 + 11_000 }), 100)
        expect(text(lines[1])).toBe('    Two callers pass 3600 directly')
        lines = tracker.getLines(input({ messages: msgs(next), now: T0 + 13_000 }), 100)
        expect(text(lines[1])).toBe('    Nothing reads the env value')

        // Cut with … at the edge of a narrow terminal
        const narrow = new ActivityTracker().getLines(
            input({ messages: msgs(`${'word '.repeat(30)}end.`), now: T0 + 10_000 }),
            40
        )
        expect(text(narrow[1]).length).toBeLessThanOrEqual(40)
        expect(text(narrow[1]).endsWith('…')).toBe(true)

        // No line 2 once the model moves on to a tool
        lines = tracker.getLines(
            input({
                messages: [
                    { role: 'user', content: 'x' },
                    running('bash', { command: 'bun test' }),
                ],
                now: T0 + 14_000,
            }),
            100
        )
        expect(lines).toHaveLength(1)
    })

    it('picks the latest complete sentence of a thought (L21)', () => {
        expect(latestThoughtSentence('First idea here. Second idea is longer. Third is stre')).toBe(
            'Second idea is longer'
        )
        expect(latestThoughtSentence('Still streaming the first sentence')).toBe(
            'Still streaming the first sentence'
        )
        expect(latestThoughtSentence('- check the session file\n- then the env loader')).toBe(
            'check the session file'
        )
        expect(latestThoughtSentence('**Header only**')).toBe('')
    })
})
