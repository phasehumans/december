import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import { openUrl } from '../src/utils/open'

describe('openUrl', () => {
    let originalEnv: NodeJS.ProcessEnv
    let mockExec: any

    beforeEach(() => {
        vi.clearAllMocks()
        originalEnv = { ...process.env }
        mockExec = vi.fn((_cmd, cb) => {
            if (cb) cb(null)
        })
    })

    afterEach(() => {
        process.env = originalEnv
        vi.restoreAllMocks()
    })

    it('uses "open" command on macOS', async () => {
        await openUrl('https://example.com', mockExec, () => 'darwin')
        expect(mockExec).toHaveBeenCalledWith('open "https://example.com"', expect.any(Function))
    })

    it('uses "start" command on Windows', async () => {
        await openUrl('https://example.com', mockExec, () => 'win32')
        expect(mockExec).toHaveBeenCalledWith(
            'start "" "https://example.com"',
            expect.any(Function)
        )
    })

    it('uses powershell on WSL', async () => {
        process.env.WSL_DISTRO_NAME = 'Ubuntu'
        await openUrl(
            'https://example.com',
            mockExec,
            () => 'linux',
            () => 'microsoft'
        )
        expect(mockExec).toHaveBeenCalledWith(
            'powershell.exe -NoProfile -Command "Start-Process \'https://example.com\'"',
            expect.any(Function)
        )
    })

    it('uses xdg-open on standard Linux', async () => {
        delete process.env.WSL_DISTRO_NAME
        await openUrl(
            'https://example.com',
            mockExec,
            () => 'linux',
            () => '5.15.0-generic'
        )
        expect(mockExec).toHaveBeenCalledWith(
            'xdg-open "https://example.com"',
            expect.any(Function)
        )
    })

    it('rejects if exec fails', async () => {
        const failExec = vi.fn((_cmd, cb) => {
            if (cb) cb(new Error('Exec failed'))
        })

        await expect(openUrl('https://example.com', failExec, () => 'darwin')).rejects.toThrow(
            'Exec failed'
        )
    })
})
