import { describe, expect, it } from 'bun:test'

import { resolveAnnouncement } from '../../src/utils/banner'

describe('Announcement Banner Resolution (Unit)', () => {
    const mockHighlights = {
        version: '0.4.9',
        title: "What's New in v0.4.9",
        bullets: [
            'Remove expand mode and make thoughts transient',
            'Implement ephemeral discovery and silent reads',
            'Stream transient thinking topics',
            'Extra bullet 4',
            'Extra bullet 5',
        ],
        url: 'https://trydecember.com/docs/changelog',
    }

    it('shows announcement every time in interactive fullscreen mode even on repeat runs', () => {
        const result = resolveAnnouncement({
            config: {},
            isInline: false,
            isNewVersion: false,
            releaseHighlights: mockHighlights,
        })

        expect(result).not.toBeNull()
        expect(result?.title).toBe("What's New in v0.4.9")
        expect(result?.bullets.length).toBe(2)
        expect(result?.bullets[0]).toBe('Remove expand mode and make thoughts transient')
        expect(result?.bullets[1]).toBe('Implement ephemeral discovery and silent reads')
    })

    it('suppresses announcement when showChangelogBanner is explicitly set to false', () => {
        const result = resolveAnnouncement({
            config: { showChangelogBanner: false },
            isInline: false,
            isNewVersion: true,
            releaseHighlights: mockHighlights,
        })

        expect(result).toBeNull()
    })

    it('suppresses announcement in inline mode on repeat runs to avoid polluting shell history', () => {
        const result = resolveAnnouncement({
            config: {},
            isInline: true,
            isNewVersion: false,
            releaseHighlights: mockHighlights,
        })

        expect(result).toBeNull()
    })

    it('shows announcement in inline mode on the first run of a new version', () => {
        const result = resolveAnnouncement({
            config: {},
            isInline: true,
            isNewVersion: true,
            releaseHighlights: mockHighlights,
        })

        expect(result).not.toBeNull()
        expect(result?.bullets.length).toBe(2)
    })

    it('returns null if release highlights are missing or have empty bullets', () => {
        expect(
            resolveAnnouncement({
                config: {},
                isInline: false,
                isNewVersion: true,
                releaseHighlights: null,
            })
        ).toBeNull()

        expect(
            resolveAnnouncement({
                config: {},
                isInline: false,
                isNewVersion: true,
                releaseHighlights: {
                    version: '0.4.9',
                    bullets: [],
                },
            })
        ).toBeNull()
    })
})
