import fs from 'node:fs'
import path from 'node:path'

import { discoverProjectRules, findRuleFileInDir, SkillDiscoveryEngine } from '@december/shared'

export interface LearnTarget {
    /** Folder that holds the main rule file: the git root, or the workspace without a repo */
    rootDir: string
    /** Main rule file: the root AGENTS.md (or CLAUDE.md when the root has only that file) */
    ruleFile: string
    ruleFileExists: boolean
    /** Other workspace rule files between rootDir and the workspace (more specific folders) */
    nestedRuleFiles: string[]
    /** Folder for new project skills */
    skillsDir: string
    /** Names of skills that already exist, so /learn does not reuse a name */
    existingSkillNames: string[]
}

/**
 * Returns the git root that contains workspaceDir, or workspaceDir when it is not
 * in a git repository. A `.git` file (worktree) also counts as a git root.
 */
export function findRuleRoot(workspaceDir: string): string {
    const start = path.resolve(workspaceDir)
    let current = start
    while (true) {
        if (fs.existsSync(path.join(current, '.git'))) return current
        const parent = path.dirname(current)
        if (parent === current) return start
        current = parent
    }
}

/** Finds where /learn writes rules and skills for a workspace. */
export function resolveLearnTarget(workspaceDir: string): LearnTarget {
    const rootDir = findRuleRoot(workspaceDir)
    const existingRuleFile = findRuleFileInDir(rootDir)
    const ruleFile = existingRuleFile || path.join(rootDir, 'AGENTS.md')

    const nestedRuleFiles = discoverProjectRules(workspaceDir, rootDir)
        .map((file) => file.path)
        .filter((filePath) => {
            if (filePath === ruleFile) return false
            const relative = path.relative(rootDir, filePath)
            return !relative.startsWith('..') && !path.isAbsolute(relative)
        })

    let existingSkillNames: string[] = []
    try {
        existingSkillNames = new SkillDiscoveryEngine({ workspaceDir, includeDisabled: true })
            .discoverAllSkills()
            .map((skill) => skill.name)
    } catch {
        // Intentionally swallowed: the agent can still list the skills folder itself
    }

    return {
        rootDir,
        ruleFile,
        ruleFileExists: Boolean(existingRuleFile),
        nestedRuleFiles,
        skillsDir: path.join(rootDir, '.december', 'skills'),
        existingSkillNames,
    }
}
