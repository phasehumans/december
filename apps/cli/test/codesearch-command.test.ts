import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import { parseCliArgs } from '../src/args'
import { handleCodeSearchCommand } from '../src/commands'
import { localOperations } from '../src/local-operations'

describe('CLI codesearch command', () => {
    let originalExitCode: string | number | undefined
    let consoleLogSpy: any
    let consoleErrorSpy: any
    let grepSpy: any

    beforeEach(() => {
        originalExitCode = process.exitCode
        process.exitCode = undefined
        consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
        consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
        grepSpy = vi.spyOn(localOperations.search, 'grep').mockResolvedValue('')
    })

    afterEach(() => {
        process.exitCode = 0
        vi.restoreAllMocks()
    })

    it('parses codesearch command correctly from args', () => {
        const args = parseCliArgs(['codesearch', 'myQuery'])
        expect(args.command).toBe('codesearch')
        expect(args.positionals).toEqual(['codesearch', 'myQuery'])
    })

    it('sets exitCode to 1 and logs error when no query is provided', async () => {
        await handleCodeSearchCommand()

        expect(process.exitCode).toBe(1)
        expect(consoleErrorSpy).toHaveBeenCalledWith(
            expect.stringContaining('Please provide a search query')
        )
    })

    it('logs no matches found message when grep output is empty', async () => {
        grepSpy.mockResolvedValue('')
        await handleCodeSearchCommand({ query: 'nonexistent' })

        expect(grepSpy).toHaveBeenCalledWith('.', 'nonexistent')
        expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('No matches found'))
    })

    it('parses and prints search results when grep output has matches', async () => {
        grepSpy.mockResolvedValue(
            'src/index.ts:10:const a = 1\nsrc/utils.ts:25:export function test() {}'
        )
        await handleCodeSearchCommand({ query: 'test' })

        expect(grepSpy).toHaveBeenCalledWith('.', 'test')
        expect(consoleLogSpy).toHaveBeenCalledWith(
            expect.stringContaining('Code Search Results (2)')
        )
        expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('src/index.ts:10'))
        expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('src/utils.ts:25'))
    })

    it('handles grep error gracefully without crashing', async () => {
        grepSpy.mockRejectedValue(new Error('grep failed'))
        await expect(handleCodeSearchCommand({ query: 'fail' })).resolves.toBeUndefined()
        expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Code search failed'))
    })
})
