import fs from 'node:fs'
import { fileURLToPath } from 'node:url'

import releaseHeadlines from '../data/release-headlines.json'

import { rawVersion } from './version'

// Release history parsed from the repo root CHANGELOG.md (used by the changelog page and the landing page badge)
export interface ChangelogItem {
    scope?: string
    text: string
    pr?: string
    raw: string
}

export interface ChangelogSection {
    title: string
    items: ChangelogItem[]
}

export interface ChangelogRelease {
    version: string
    date: string
    isUnreleased: boolean
    sections: ChangelogSection[]
}

export function parseChangelog(markdown: string): ChangelogRelease[] {
    const lines = markdown.split('\n')
    const releases: ChangelogRelease[] = []
    let currentRelease: ChangelogRelease | null = null
    let currentSection: ChangelogSection | null = null

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i]

        // Version header: ## [0.3.34] - 2026-09-28 or ## [unreleased]
        const versionMatch = line.match(/^##\s+\[(.*?)\](?:\s+-\s+(\d{4}-\d{2}-\d{2}))?/)
        if (versionMatch) {
            const rawVer = versionMatch[1]
            const date =
                versionMatch[2] || (rawVer.toLowerCase() === 'unreleased' ? 'Upcoming' : '')
            currentRelease = {
                version: rawVer,
                date: date,
                isUnreleased: rawVer.toLowerCase() === 'unreleased',
                sections: [],
            }
            releases.push(currentRelease)
            currentSection = null
            continue
        }

        if (!currentRelease) continue

        // Section header: ### Features, ### Bug Fixes, etc.
        if (line.startsWith('### ')) {
            const title = line.replace('### ', '').trim()
            currentSection = {
                title,
                items: [],
            }
            currentRelease.sections.push(currentSection)
            continue
        }

        // Bullet items: - _(scope)_ text (#123)
        if (currentSection && (line.trim().startsWith('- ') || line.trim().startsWith('* '))) {
            const rawItem = line.trim().replace(/^[-*]\s*/, '')
            const scopeMatch = rawItem.match(/^_([^_]+)_\s*/)
            const scope = scopeMatch
                ? scopeMatch[1].replace(/^\(/, '').replace(/\)$/, '').trim()
                : undefined
            let itemText = scopeMatch ? rawItem.slice(scopeMatch[0].length).trim() : rawItem

            const prMatch = itemText.match(/\(#(\d+)\)\s*$/)
            const pr = prMatch ? prMatch[1] : undefined
            if (prMatch && prMatch.index !== undefined) {
                itemText = itemText.slice(0, prMatch.index).trim()
            }

            if (itemText.length > 0) {
                itemText = itemText[0].toUpperCase() + itemText.slice(1)
            }

            currentSection.items.push({
                scope,
                text: itemText,
                pr,
                raw: rawItem,
            })
        }
    }

    // Filter out any empty sections
    for (const rel of releases) {
        rel.sections = rel.sections.filter((s) => s.items.length > 0)
    }

    return releases.filter((r) => r.sections.length > 0)
}

const changelogPath = fileURLToPath(new URL('../../../../CHANGELOG.md', import.meta.url))
let changelogContent = ''
try {
    changelogContent = fs.readFileSync(changelogPath, 'utf-8')
} catch {
    // Intentionally swallowed: fallback to empty changelog if file cannot be read
}

export const releases = parseChangelog(changelogContent)

// Self-healing fallback: If top entry is unreleased, but CHANGELOG lacks an entry for active package.json version
if (releases.length > 0 && releases[0].isUnreleased) {
    const hasCurrentVersion = releases.some((r) => !r.isUnreleased && r.version === rawVersion)
    if (!hasCurrentVersion) {
        releases[0].version = rawVersion
        releases[0].isUnreleased = false
        releases[0].date = new Date().toISOString().split('T')[0]
    }
}

const USER_FACING_SKIP_SCOPES = new Set(['docs', 'ci', 'test', 'tests'])

/**
 * One short line describing what is new in a release, for the landing page badge.
 * Prefers a user-facing feature that adds something ("Add ..."), then any user-facing feature.
 */
export function getReleaseHighlight(release: ChangelogRelease | undefined): string {
    if (!release) return ''
    const features = release.sections.find((s) => s.title.toLowerCase() === 'features')?.items ?? []
    const userFacing = features.filter((item) => {
        const scopes = (item.scope ?? '').split(',').map((scope) => scope.trim())
        return !scopes.every((scope) => USER_FACING_SKIP_SCOPES.has(scope))
    })
    const pick =
        userFacing.find((item) => /^add\b/i.test(item.text)) ?? userFacing[0] ?? features[0]
    return pick ? pick.text : ''
}

export const latestRelease = releases[0]
// Hand-written headline per version wins (CHANGELOG.md is regenerated by git-cliff, so headlines live in data/release-headlines.json)
const headlines: Record<string, string> = releaseHeadlines
export const latestHighlight =
    (latestRelease && headlines[latestRelease.version]) || getReleaseHighlight(latestRelease)
