import { RULE_FILE_NAMES, type DiscoveredRuleFile } from '@december/shared'

import type { PlatformAdapter } from '@december/agent'

/** the most of a repository rule file that goes into the prompt (the same 32 KiB as the CLI) */
export const PROJECT_RULE_MAX_CHARS = 32 * 1024

export interface LoadSandboxProjectRulesInput {
    fs: Pick<PlatformAdapter['fs'], 'readFile'>
    /** the repository folder in the sandbox */
    workspaceDir: string
}

/**
 * The rule file of the repository a cloud run works in: AGENTS.md, or CLAUDE.md when the
 * repository has no AGENTS.md, the same rule as the CLI (discoverProjectRules). It is read
 * from the sandbox, never from the worker's disk. A missing or empty file gives [].
 */
const loadSandboxProjectRules = async (
    data: LoadSandboxProjectRulesInput
): Promise<DiscoveredRuleFile[]> => {
    const { fs, workspaceDir } = data
    const root = workspaceDir.replace(/\/+$/, '') || '/'
    for (const name of RULE_FILE_NAMES) {
        const path = `${root === '/' ? '' : root}/${name}`
        let content: string
        try {
            content = (await fs.readFile(path)).trim()
        } catch {
            // Intentionally swallowed: the repository has no such file, try the next name
            continue
        }
        if (!content) continue
        if (content.length > PROJECT_RULE_MAX_CHARS) {
            content = `${content.slice(0, PROJECT_RULE_MAX_CHARS)}\n\n[${name} is longer than ${PROJECT_RULE_MAX_CHARS} characters: the rest is left out. Read the file for the full text.]`
        }
        return [{ path, content }]
    }
    return []
}

export const projectRules = { loadSandboxProjectRules }
