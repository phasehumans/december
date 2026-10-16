export interface ReleaseAnnouncementData {
    version: string
    title?: string
    bullets: string[]
    url?: string
}

export interface ResolveAnnouncementOptions {
    config: {
        showChangelogBanner?: boolean
    }
    isInline?: boolean
    isNewVersion?: boolean
    releaseHighlights?: ReleaseAnnouncementData | null
}

export function resolveAnnouncement(
    options: ResolveAnnouncementOptions
): ReleaseAnnouncementData | null {
    const { config, isInline = false, isNewVersion = false, releaseHighlights } = options

    if (config.showChangelogBanner === false) {
        return null
    }

    if (
        !releaseHighlights ||
        !Array.isArray(releaseHighlights.bullets) ||
        releaseHighlights.bullets.length === 0
    ) {
        return null
    }

    if (isInline && !isNewVersion) {
        return null
    }

    return {
        ...releaseHighlights,
        bullets: releaseHighlights.bullets.slice(0, 3),
    }
}
