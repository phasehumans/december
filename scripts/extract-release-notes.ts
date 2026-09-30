import fs from 'node:fs'
import path from 'node:path'

export interface ReleaseHighlights {
    version: string
    title: string
    bullets: string[]
    url: string
}

export function cleanBullet(raw: string): string {
    let clean = raw.trim().replace(/^[-*]\s*/, '')
    // remove commit scope like _(cli)_ or _(auth,docs)_
    clean = clean.replace(/^_\([^)]+\)_\s*/, '')
    // remove PR number suffix like (#525)
    clean = clean.replace(/\s*\(#\d+\)\s*$/, '')
    clean = clean.trim()
    if (clean.length > 0) {
        clean = clean[0].toUpperCase() + clean.slice(1)
    }
    return clean
}

export function extractReleaseHighlights(
    changelogContent: string,
    targetVersion?: string,
    maxBullets = 3
): ReleaseHighlights | null {
    const lines = changelogContent.split('\n')
    let inTarget = false
    let inSection = false
    const bullets: string[] = []

    const cleanVer = targetVersion ? targetVersion.replace(/^v/, '') : ''
    const versionPattern = cleanVer
        ? new RegExp(`^## \\[(?:${cleanVer.replace(/\./g, '\\.')}|unreleased)\\]`, 'i')
        : /^## \[/

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        if (line.startsWith('## [')) {
            if (inTarget) break // Reached the next release header
            if (versionPattern.test(line)) {
                inTarget = true
            }
            continue
        }

        if (!inTarget) continue

        if (line.startsWith('### ')) {
            const secName = line.replace('### ', '').toLowerCase().trim()
            inSection = secName === 'features' || secName === 'bug fixes'
            continue
        }

        if (inSection && (line.trim().startsWith('- ') || line.trim().startsWith('* '))) {
            const cleaned = cleanBullet(line)
            if (cleaned && !bullets.includes(cleaned)) {
                bullets.push(cleaned)
                if (bullets.length >= maxBullets) break
            }
        }
    }

    if (bullets.length === 0) return null

    const resolvedVersion = cleanVer || '0.4.0'
    return {
        version: resolvedVersion,
        title: `What's New in v${resolvedVersion}`,
        bullets,
        url: 'https://trydecember.com/docs/changelog',
    }
}

export function updateReleaseHighlightsFile(
    changelogPath: string,
    outputPath: string,
    targetVersion: string
): ReleaseHighlights | null {
    if (!fs.existsSync(changelogPath)) {
        return null
    }

    const content = fs.readFileSync(changelogPath, 'utf-8')
    const highlights = extractReleaseHighlights(content, targetVersion)
    if (!highlights) {
        return null
    }

    const dir = path.dirname(outputPath)
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
    }

    fs.writeFileSync(outputPath, JSON.stringify(highlights, null, 4) + '\n', 'utf-8')
    return highlights
}

// CLI runner if invoked directly
if (import.meta.main) {
    const targetVersion = process.argv[2] || '0.4.0'
    const changelogPath = path.resolve(process.cwd(), 'CHANGELOG.md')
    const outputPath = path.resolve(process.cwd(), 'apps/cli/src/constants/release-highlights.json')
    const result = updateReleaseHighlightsFile(changelogPath, outputPath, targetVersion)
    if (result) {
        console.log(`Successfully generated release highlights for v${result.version}:`)
        console.log(JSON.stringify(result, null, 2))
    } else {
        console.error(
            `Could not extract release highlights for v${targetVersion} from CHANGELOG.md`
        )
    }
}
