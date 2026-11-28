import { describe, it, expect } from 'bun:test'

import {
    MEMORY_PROMPT_LIMIT,
    RULES_TOTAL_MAX_BYTES,
    buildMemorySection,
    buildRulesSection,
    utf8Bytes,
} from '../../src/agent-context'

describe('buildRulesSection', () => {
    it('writes each rule that is on as a section of an AGENTS.md file', () => {
        const text = buildRulesSection([
            { name: 'code-style', body: '- arrow functions\n', enabled: true },
            { name: 'off', body: 'never sent', enabled: false },
            { name: 'empty', body: '   ', enabled: true },
            { name: 'commits', body: 'lowercase', enabled: true },
        ])
        expect(text).toBe(
            [
                '# Account rules',
                'The user saved these rules on their December account. Follow them in every task.',
                '',
                '## code-style',
                '- arrow functions',
                '',
                '## commits',
                'lowercase',
            ].join('\n')
        )
        expect(text).not.toContain('never sent')
    })

    it('is empty with no rule on', () => {
        expect(buildRulesSection([])).toBe('')
        expect(buildRulesSection([{ name: 'a', body: 'x', enabled: false }])).toBe('')
    })

    it('stops at the total limit', () => {
        const big = 'x'.repeat(16 * 1024)
        const text = buildRulesSection([
            { name: 'a', body: big, enabled: true },
            { name: 'b', body: big, enabled: true },
            { name: 'c', body: big, enabled: true },
        ])
        expect(text).toContain('## a')
        expect(text).not.toContain('## b')
        expect(utf8Bytes(text)).toBeLessThan(RULES_TOTAL_MAX_BYTES + 200)
    })
})

describe('buildMemorySection', () => {
    it('lists memories with their handles on one line each', () => {
        const text = buildMemorySection([
            { handle: 'm1', content: 'prefers bun' },
            { handle: 'm2', content: 'two\nlines' },
        ])
        expect(text.startsWith('# Memory\n')).toBe(true)
        expect(text).toContain('- [m1] prefers bun')
        expect(text).toContain('- [m2] two lines')
    })

    it('is empty with no memories', () => {
        expect(buildMemorySection([])).toBe('')
    })

    it('stops at the limit and says how many did not fit', () => {
        const memories = Array.from({ length: 100 }, (_, i) => ({
            handle: `m${i + 1}`,
            content: 'x'.repeat(400),
        }))
        const text = buildMemorySection(memories)
        expect(text.length).toBeLessThan(MEMORY_PROMPT_LIMIT + 100)
        expect(text).toContain('- [m1] ')
        expect(text).not.toContain('- [m100] ')
        expect(text).toMatch(/\(\d+ older memories did not fit here\.\)$/)
    })
})
