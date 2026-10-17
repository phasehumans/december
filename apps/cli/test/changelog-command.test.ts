import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import { handleChangelogCommand } from '../src/commands'
import * as openUtils from '../src/utils/open'

describe('CLI changelog command', () => {
    const originalEnv = { ...process.env }

    beforeEach(() => {
        delete process.env.WEB_URL
    })

    afterEach(() => {
        process.env = { ...originalEnv }
        vi.restoreAllMocks()
    })

    describe('handleChangelogCommand', () => {
        it('calls openUrl with default https://trydecember.com/docs/changelog/', async () => {
            const openSpy = vi.spyOn(openUtils, 'openUrl').mockResolvedValue(undefined)

            await handleChangelogCommand()

            expect(openSpy).toHaveBeenCalledWith('https://trydecember.com/docs/changelog/')
        })

        it('respects WEB_URL environment variable', async () => {
            process.env.WEB_URL = 'http://localhost:2000'
            const openSpy = vi.spyOn(openUtils, 'openUrl').mockResolvedValue(undefined)

            await handleChangelogCommand()

            expect(openSpy).toHaveBeenCalledWith('http://localhost:2000/docs/changelog/')
        })

        it('does not crash or throw if openUrl rejects (headless server fallback)', async () => {
            vi.spyOn(openUtils, 'openUrl').mockRejectedValue(new Error('No display available'))

            await expect(handleChangelogCommand()).resolves.toBeUndefined()
        })
    })
})
