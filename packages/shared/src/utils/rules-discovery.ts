import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

export interface DiscoveredRuleFile {
    path: string
    content: string
}

export function discoverProjectRules(
    startDir: string,
    rootBoundary?: string
): DiscoveredRuleFile[] {
    const candidateNames = [
        'AGENTS.override.md',
        'agents.override.md',
        'AGENTS.md',
        'agents.md',
        'CLAUDE.md',
        'claude.md',
        path.join('.december', 'rules.md'),
        path.join('.december', 'RULES.md'),
        path.join('.december', 'AGENTS.md'),
        path.join('.december', 'agents.md'),
    ]
    const seen = new Set<string>()
    let current = path.resolve(startDir)
    const boundary = rootBoundary ? path.resolve(rootBoundary) : path.parse(current).root
    const collectedFiles: DiscoveredRuleFile[] = []

    while (true) {
        for (const name of candidateNames) {
            const candidatePath = path.join(current, name)
            if (fs.existsSync(candidatePath)) {
                try {
                    if (fs.statSync(candidatePath).isFile()) {
                        if (!seen.has(candidatePath)) {
                            seen.add(candidatePath)
                            const content = fs.readFileSync(candidatePath, 'utf8').trim()
                            if (content) {
                                collectedFiles.unshift({ path: candidatePath, content }) // Root-most rules first
                            }
                        }
                    }
                } catch {
                    // Intentionally swallowed: candidate file read error fallback
                }
            }
        }

        if (current === boundary) break
        const parent = path.dirname(current)
        if (parent === current) break
        current = parent
    }

    // Check machine root global rules (~/.december/rules.md, ~/.december/AGENTS.md, etc.)
    const home = process.env.HOME || process.env.USERPROFILE || os.homedir()
    const globalCandidateDirs = [
        process.env.DECEMBER_CONFIG_DIR,
        path.join(home, '.december'),
        path.join(home, '.config', 'december'),
    ].filter((dir): dir is string => Boolean(dir))

    for (const globalDir of globalCandidateDirs) {
        for (const candidate of ['rules.md', 'RULES.md', 'AGENTS.md', 'agents.md']) {
            const globalPath = path.join(globalDir, candidate)
            if (fs.existsSync(globalPath) && !seen.has(globalPath)) {
                try {
                    if (fs.statSync(globalPath).isFile()) {
                        seen.add(globalPath)
                        const content = fs.readFileSync(globalPath, 'utf8').trim()
                        if (content) {
                            collectedFiles.unshift({ path: globalPath, content }) // Global rules have lowest precedence
                        }
                    }
                } catch {
                    // Intentionally swallowed: global rule read error fallback
                }
            }
        }
    }

    return collectedFiles
}
