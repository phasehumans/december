import { describe, it, expect } from 'bun:test'

import { saveMcpServerSchema } from '../../src/modules/connection/connection.schema'
import {
    ruleNameFor,
    toFoundRule,
    toPreviewRule,
} from '../../src/modules/connection/connection.utils'

describe('ruleNameFor', () => {
    it('names the rule after the repository and the file', () => {
        expect(ruleNameFor('acme/web', 'AGENTS.md')).toBe('web-agents')
        expect(ruleNameFor('acme/web', 'CLAUDE.md')).toBe('web-claude')
        expect(ruleNameFor('group/sub/My_App.js', 'AGENTS.md')).toBe('my-app-js-agents')
    })

    it('keeps the name inside the rule name rules', () => {
        const long = ruleNameFor(`acme/${'x'.repeat(100)}`, 'AGENTS.md')
        expect(long.length).toBeLessThanOrEqual(64)
        expect(/^[a-z0-9][a-z0-9-]*$/.test(long)).toBe(true)
        expect(ruleNameFor('acme/___', 'AGENTS.md')).toBe('agents')
    })
})

describe('toFoundRule', () => {
    it('imports a file with text, trimmed', () => {
        expect(toFoundRule('acme/web', 'AGENTS.md', { size: 9, content: '  use bun\n' })).toEqual({
            path: 'AGENTS.md',
            name: 'web-agents',
            body: 'use bun',
            importable: true,
        })
    })

    it('refuses a file that is too large, empty or unreadable', () => {
        expect(toFoundRule('acme/web', 'AGENTS.md', { size: 99_999, content: null }).reason).toBe(
            'The file is larger than 16 KiB.'
        )
        expect(
            toFoundRule('acme/web', 'AGENTS.md', { size: 3, content: 'é'.repeat(8193) }).reason
        ).toBe('The file is larger than 16 KiB.')
        expect(toFoundRule('acme/web', 'AGENTS.md', { size: 1, content: ' ' }).reason).toBe(
            'The file is empty.'
        )
        expect(toFoundRule('acme/web', 'AGENTS.md', null).reason).toBe(
            'The file could not be read.'
        )
    })

    it('keeps the text out of the preview row', () => {
        const row = toPreviewRule(
            toFoundRule('acme/web', 'AGENTS.md', { size: 7, content: 'use bun' }),
            true
        )
        expect(row).toEqual({
            path: 'AGENTS.md',
            name: 'web-agents',
            exists: true,
            importable: true,
        })
    })
})

describe('saveMcpServerSchema headers', () => {
    const base = { name: 'x', url: 'https://mcp.example.com', auth: 'header' }
    it('refuses hop-by-hop and proxy headers', () => {
        for (const key of ['Host', 'Connection', 'Upgrade', 'Proxy-Authorization', 'TE']) {
            expect(
                saveMcpServerSchema.safeParse({ ...base, headers: [{ key, value: 'v' }] }).success
            ).toBe(false)
        }
    })

    it('takes a normal sign-in header', () => {
        expect(
            saveMcpServerSchema.safeParse({
                ...base,
                headers: [{ key: 'Authorization', value: 'Bearer abc' }],
            }).success
        ).toBe(true)
    })

    it('refuses control characters in a value', () => {
        expect(
            saveMcpServerSchema.safeParse({
                ...base,
                headers: [{ key: 'Authorization', value: 'a\nb' }],
            }).success
        ).toBe(false)
    })
})
