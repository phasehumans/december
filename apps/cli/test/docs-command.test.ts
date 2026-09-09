import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import { resolveDocsSectionPath, handleDocsCommand } from '../src/commands'
import * as openUtils from '../src/utils/open'

describe('CLI docs command', () => {
    const originalEnv = { ...process.env }

    beforeEach(() => {
        delete process.env.DECEMBER_DOCS_URL
        delete process.env.WEB_URL
    })

    afterEach(() => {
        process.env = { ...originalEnv }
        vi.restoreAllMocks()
    })

    describe('resolveDocsSectionPath', () => {
        it('resolves empty or intro sections to empty string for root docs path', () => {
            expect(resolveDocsSectionPath()).toBe('')
            expect(resolveDocsSectionPath('')).toBe('')
            expect(resolveDocsSectionPath('intro')).toBe('')
            expect(resolveDocsSectionPath('introduction')).toBe('')
            expect(resolveDocsSectionPath('overview')).toBe('')
        })

        it('resolves CLI aliases to /cli', () => {
            expect(resolveDocsSectionPath('cli')).toBe('/cli')
            expect(resolveDocsSectionPath('commands')).toBe('/cli')
            expect(resolveDocsSectionPath('terminal')).toBe('/cli')
        })

        it('resolves quickstart and guide aliases to /quickstart', () => {
            expect(resolveDocsSectionPath('quickstart')).toBe('/quickstart')
            expect(resolveDocsSectionPath('quick-start')).toBe('/quickstart')
            expect(resolveDocsSectionPath('start')).toBe('/quickstart')
            expect(resolveDocsSectionPath('guide')).toBe('/quickstart')
        })

        it('resolves architecture aliases to /architecture', () => {
            expect(resolveDocsSectionPath('arch')).toBe('/architecture')
            expect(resolveDocsSectionPath('architecture')).toBe('/architecture')
        })

        it('resolves legal sections to /privacy and /terms', () => {
            expect(resolveDocsSectionPath('privacy')).toBe('/privacy')
            expect(resolveDocsSectionPath('terms')).toBe('/terms')
        })

        it('passes through unknown sections prefixed with /', () => {
            expect(resolveDocsSectionPath('custom')).toBe('/custom')
            expect(resolveDocsSectionPath('/nested')).toBe('/nested')
        })
    })

    describe('handleDocsCommand', () => {
        it('calls openUrl with default https://trydecember.com/docs when no section is passed', async () => {
            const openSpy = vi.spyOn(openUtils, 'openUrl').mockResolvedValue(undefined)

            await handleDocsCommand()

            expect(openSpy).toHaveBeenCalledWith('https://trydecember.com/docs')
        })

        it('calls openUrl with deep-linked section path', async () => {
            const openSpy = vi.spyOn(openUtils, 'openUrl').mockResolvedValue(undefined)

            await handleDocsCommand({ section: 'cli' })

            expect(openSpy).toHaveBeenCalledWith('https://trydecember.com/docs/cli')
        })

        it('respects DECEMBER_DOCS_URL environment variable', async () => {
            process.env.DECEMBER_DOCS_URL = 'http://localhost:5173'
            const openSpy = vi.spyOn(openUtils, 'openUrl').mockResolvedValue(undefined)

            await handleDocsCommand({ section: 'quickstart' })

            expect(openSpy).toHaveBeenCalledWith('http://localhost:5173/docs/quickstart')
        })

        it('does not crash or throw if openUrl rejects (headless server fallback)', async () => {
            vi.spyOn(openUtils, 'openUrl').mockRejectedValue(new Error('No display available'))

            await expect(handleDocsCommand()).resolves.toBeUndefined()
        })
    })
})
