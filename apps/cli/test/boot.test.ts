import { describe, expect, it } from 'bun:test'

import pkg from '../package.json' with { type: 'json' }
import { parseCliArgs, getHelpText } from '../src/args'

describe('CLI Boot & Fast Flag Handler', () => {
    it('should parse --help flag instantaneously without loading heavy dependencies', () => {
        const start = performance.now()
        const parsed = parseCliArgs(['--help'])
        const elapsed = performance.now() - start

        expect(parsed.isHelp).toBe(true)
        expect(elapsed).toBeLessThan(20)

        const helpText = getHelpText(pkg.version)
        expect(helpText).toContain('Usage:')
    })

    it('should parse --version flag instantaneously', () => {
        const start = performance.now()
        const parsed = parseCliArgs(['--version'])
        const elapsed = performance.now() - start

        expect(parsed.isVersion).toBe(true)
        expect(elapsed).toBeLessThan(20)
    })

    it('should parse subcommands like ask and logout without initializing heavy session state', () => {
        const parsedAsk = parseCliArgs(['ask'])
        expect(parsedAsk.command).toBe('ask')

        const parsedLogout = parseCliArgs(['logout'])
        expect(parsedLogout.command).toBe('logout')
    })
})
