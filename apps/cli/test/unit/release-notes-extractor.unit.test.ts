import { describe, expect, it } from 'bun:test'

import { cleanBullet, extractReleaseHighlights } from '../../../../scripts/extract-release-notes'

describe('Release Notes Extractor (Unit)', () => {
    it('cleans commit bullet strings properly', () => {
        expect(cleanBullet('- _(auth,docs)_ enhance device activation flow (#523)')).toBe(
            'Enhance device activation flow'
        )

        expect(cleanBullet('* _(tui)_ transition to default fullscreen mode')).toBe(
            'Transition to default fullscreen mode'
        )

        expect(cleanBullet('  - support 140+ providers ')).toBe('Support 140+ providers')
    })

    it('extracts top 3 highlights from markdown for target version', () => {
        const markdown = `
# Changelog

## [0.4.0] - 2026-09-30

### Features

- _(auth,docs)_ Enhance device activation flow
- _(tui)_ Transition to default fullscreen mode
- _(infra)_ Configure aws rds postgresql connection
- _(tools)_ Add extra tool capability

### Bug Fixes

- _(tui)_ Retain status bar on slash menu

## [0.3.34] - 2026-09-28

### Bug Fixes

- _(githubapp)_ Make userid nullable
`
        const highlights = extractReleaseHighlights(markdown, '0.4.0', 3)
        expect(highlights).not.toBeNull()
        expect(highlights?.version).toBe('0.4.0')
        expect(highlights?.title).toBe("What's New in v0.4.0")
        expect(highlights?.bullets.length).toBe(3)
        expect(highlights?.bullets[0]).toBe('Enhance device activation flow')
        expect(highlights?.bullets[1]).toBe('Transition to default fullscreen mode')
        expect(highlights?.bullets[2]).toBe('Configure aws rds postgresql connection')
        expect(highlights?.url).toBe('https://trydecember.com/docs/changelog')
    })

    it('falls back to bug fixes if fewer features exist', () => {
        const markdown = `
## [0.4.1] - 2026-10-01

### Features

- _(tui)_ Add new animation

### Bug Fixes

- _(core)_ Fix memory leak in streaming
- _(cli)_ Prevent crash on invalid token
`
        const highlights = extractReleaseHighlights(markdown, '0.4.1', 3)
        expect(highlights).not.toBeNull()
        expect(highlights?.bullets.length).toBe(3)
        expect(highlights?.bullets[0]).toBe('Add new animation')
        expect(highlights?.bullets[1]).toBe('Fix memory leak in streaming')
        expect(highlights?.bullets[2]).toBe('Prevent crash on invalid token')
    })
})
