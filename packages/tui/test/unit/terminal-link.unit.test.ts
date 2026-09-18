import { describe, expect, it } from 'vitest'

import { terminalLink, fileLink, toRelativePath } from '../../src/utils/terminal-link'

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

describe('toRelativePath', () => {
    it('returns empty string if input is empty', () => {
        expect(toRelativePath('')).toBe('')
    })

    it('returns relative path as is', () => {
        expect(toRelativePath('packages/agent/src/agent.ts')).toBe('packages/agent/src/agent.ts')
    })

    it('converts absolute path within cwd to relative path', () => {
        const cwd = '/home/user/project'
        expect(toRelativePath('/home/user/project/apps/cli/src/index.ts', cwd)).toBe(
            'apps/cli/src/index.ts'
        )
    })

    it('keeps absolute path if outside cwd', () => {
        const cwd = '/home/user/project'
        expect(toRelativePath('/var/log/test.log', cwd)).toBe('/var/log/test.log')
    })
})
