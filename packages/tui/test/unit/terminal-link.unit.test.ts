import { describe, expect, it } from 'vitest'

import { terminalLink, fileLink } from '../../src/utils/terminal-link'

describe('terminalLink', () => {
    it('generates standard OSC 8 escape sequences', () => {
        const link = terminalLink('click me', 'https://trydecember.com')
        expect(link).toBe('\x1b]8;;https://trydecember.com\x1b\\click me\x1b]8;;\x1b\\')
    })

    it('returns raw text if uri is empty', () => {
        expect(terminalLink('plain text', '')).toBe('plain text')
    })
})

describe('fileLink', () => {
    it('creates file:// uri with absolute path and line number', () => {
        const link = fileLink('src/theme.ts:15', '/path/to/src/theme.ts', 15)
        expect(link).toBe(
            '\x1b]8;;file:///path/to/src/theme.ts#L15\x1b\\src/theme.ts:15\x1b]8;;\x1b\\'
        )
    })

    it('creates file:// uri without line number', () => {
        const link = fileLink('src/theme.ts', '/path/to/src/theme.ts')
        expect(link).toBe('\x1b]8;;file:///path/to/src/theme.ts\x1b\\src/theme.ts\x1b]8;;\x1b\\')
    })
})
