import path from 'node:path'

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import { handleOpenCommand } from '../src/commands'
import * as openUtils from '../src/utils/open'

describe('CLI open command', () => {
    let originalExitCode: string | number | undefined
    let openSpy: any
    let consoleLogSpy: any
    let consoleErrorSpy: any

    beforeEach(() => {
        originalExitCode = process.exitCode
        process.exitCode = undefined
        openSpy = vi.spyOn(openUtils, 'openPath').mockResolvedValue(undefined)
        consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
        consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    })

    afterEach(() => {
        process.exitCode = 0
        vi.restoreAllMocks()
    })

    it('opens current workspace directory when no path is provided', async () => {
        await handleOpenCommand()

        expect(openSpy).toHaveBeenCalledWith(path.resolve(process.cwd(), '.'))
        expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('workspace'))
    })

    it('opens existing file path successfully', async () => {
        const existingFile = 'package.json'
        await handleOpenCommand({ path: existingFile })

        expect(openSpy).toHaveBeenCalledWith(path.resolve(process.cwd(), existingFile))
        expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('package.json'))
    })

    it('sets exitCode to 1 and outputs error when file does not exist', async () => {
        const nonExistentFile = 'does-not-exist-file-12345.xyz'
        await handleOpenCommand({ path: nonExistentFile })

        expect(openSpy).not.toHaveBeenCalled()
        expect(process.exitCode).toBe(1)
        expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('File not found'))
    })

    it('handles open failure gracefully without unhandled exception', async () => {
        openSpy.mockRejectedValue(new Error('System launcher failure'))

        await expect(handleOpenCommand()).resolves.toBeUndefined()
        expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to open'))
    })
})
