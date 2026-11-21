import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

export interface DiscoveredRuleFile {
    path: string
    content: string
}

/** Rule file names, in order of preference. A folder uses the first one that exists. */
export const RULE_FILE_NAMES = ['AGENTS.md', 'CLAUDE.md'] as const

/** Name of the global rule file in the December config folder. */
export const GLOBAL_RULE_FILE_NAME = 'AGENTS.md'

function readRuleFile(filePath: string): string | null {
    try {
        if (!fs.statSync(filePath).isFile()) return null
        return fs.readFileSync(filePath, 'utf8').trim()
    } catch {
        // Intentionally swallowed: a missing or unreadable rule file is skipped
        return null
    }
}

/**
 * Returns the rule file that a folder uses: AGENTS.md, or CLAUDE.md when the
 * folder has no AGENTS.md. Returns null when the folder has neither file.
 */
export function findRuleFileInDir(dir: string): string | null {
    for (const name of RULE_FILE_NAMES) {
        const candidatePath = path.join(dir, name)
        if (readRuleFile(candidatePath) !== null) return candidatePath
    }
    return null
}

/** Path of the global rule file: $DECEMBER_CONFIG_DIR/AGENTS.md or ~/.december/AGENTS.md. */
export function getGlobalRuleFilePath(): string {
    const home = process.env.HOME || process.env.USERPROFILE || os.homedir()
    const configDir = process.env.DECEMBER_CONFIG_DIR || path.join(home, '.december')
    return path.join(configDir, GLOBAL_RULE_FILE_NAME)
}

/**
 * Finds the rule files that December reads for a workspace.
 *
 * In each folder from startDir up to rootBoundary (or the file system root),
 * December reads AGENTS.md, or CLAUDE.md when the folder has no AGENTS.md.
 * It also reads the global AGENTS.md from the December config folder.
 *
 * Order: global rules first, then the top folder down to startDir.
 */
export function discoverProjectRules(
    startDir: string,
    rootBoundary?: string
): DiscoveredRuleFile[] {
    const collectedFiles: DiscoveredRuleFile[] = []
    let current = path.resolve(startDir)
    const boundary = rootBoundary ? path.resolve(rootBoundary) : path.parse(current).root

    while (true) {
        const rulePath = findRuleFileInDir(current)
        if (rulePath) {
            const content = readRuleFile(rulePath)
            if (content) {
                collectedFiles.unshift({ path: rulePath, content }) // Root-most rules first
            }
        }

        if (current === boundary) break
        const parent = path.dirname(current)
        if (parent === current) break
        current = parent
    }

    const globalPath = getGlobalRuleFilePath()
    if (!collectedFiles.some((file) => file.path === globalPath)) {
        const content = readRuleFile(globalPath)
        if (content) {
            collectedFiles.unshift({ path: globalPath, content }) // Global rules have lowest precedence
        }
    }

    return collectedFiles
}

/** Starter content for a new AGENTS.md (created by /memory). */
export const DEFAULT_AGENTS_MD_TEMPLATE = `# AGENTS.md

## Guidelines

- Follow existing architecture and modular design conventions.
- Maintain tests and run test suites before finalizing changes.
- Ensure all commit messages and PR descriptions are in lowercase.
`
