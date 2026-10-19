import { execFile } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { promisify } from 'node:util'

import { Tool, ToolExecuteContext } from '@december/shared'
import { Type, Static } from '@sinclair/typebox'

const execFileAsync = promisify(execFile)

export interface WorktreeInfo {
    worktreePath: string
    branchName: string
    baseDir: string
}

export interface WorktreeChanges {
    modifiedFiles: string[]
    diff: string
}

export interface WorktreeCreateOptions {
    worktreePath?: string
    branchName?: string
    copyUncommitted?: boolean
    worktreeBaseDir?: string
}

export interface WorktreeCleanupOptions {
    deleteBranch?: boolean
    branchName?: string
}

export interface WorktreeMergeOptions {
    commitMessage?: string
}

export async function isGitRepo(dir: string): Promise<boolean> {
    try {
        const { stdout } = await execFileAsync('git', ['rev-parse', '--is-inside-work-tree'], {
            cwd: dir,
        })
        return stdout.trim() === 'true'
    } catch {
        // Intentionally swallowed: directory is not inside a git repository or git is unavailable
        return false
    }
}

export async function getGitRoot(dir: string): Promise<string | null> {
    try {
        const { stdout } = await execFileAsync('git', ['rev-parse', '--show-toplevel'], {
            cwd: dir,
        })
        return stdout.trim()
    } catch {
        // Intentionally swallowed: directory is not in a git repo
        return null
    }
}

export async function createWorktree(
    repoDir: string,
    slug?: string,
    options?: WorktreeCreateOptions
): Promise<WorktreeInfo | null> {
    const isRepo = await isGitRepo(repoDir)
    if (!isRepo) {
        return null
    }

    const root = (await getGitRoot(repoDir)) || repoDir
    const actualSlug =
        slug || `task-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
    const sanitizedSlug = actualSlug.replace(/[^a-zA-Z0-9_-]/g, '_')
    const branchName = options?.branchName || `worktree/${sanitizedSlug}`
    const worktreeBaseDir = options?.worktreeBaseDir || path.join(root, '.december', 'worktrees')
    const worktreePath = options?.worktreePath || path.join(worktreeBaseDir, sanitizedSlug)

    try {
        await fs.promises.mkdir(path.dirname(worktreePath), { recursive: true })

        // Ensure .december/ and .env* are in .git/info/exclude to avoid dirtying parent status or staging secrets
        try {
            const excludePath = path.join(root, '.git', 'info', 'exclude')
            if (fs.existsSync(excludePath)) {
                const content = await fs.promises.readFile(excludePath, 'utf8')
                const toAdd: string[] = []
                if (!content.includes('.december/')) {
                    toAdd.push('.december/')
                }
                if (!content.includes('.env*') && !content.includes('.env')) {
                    toAdd.push('.env*')
                }
                if (toAdd.length > 0) {
                    await fs.promises.appendFile(excludePath, '\n' + toAdd.join('\n') + '\n')
                }
            }
        } catch {
            // Intentionally swallowed: git info exclude is a best-effort optimization
        }

        // Remove stale worktree directory if present from prior runs
        if (fs.existsSync(worktreePath)) {
            try {
                await execFileAsync('git', ['worktree', 'remove', '--force', worktreePath], {
                    cwd: root,
                })
            } catch {
                // Intentionally swallowed: fallback when git worktree remove fails
                await fs.promises.rm(worktreePath, { recursive: true, force: true })
            }
        }

        // Delete stale branch if it exists
        try {
            await execFileAsync('git', ['branch', '-D', branchName], { cwd: root })
        } catch {
            // Intentionally swallowed: branch may not already exist
        }

        // Add git worktree on isolated branch
        await execFileAsync('git', ['worktree', 'add', '-b', branchName, worktreePath, 'HEAD'], {
            cwd: root,
        })

        // Copy or apply uncommitted changes & configs if requested
        if (options?.copyUncommitted !== false) {
            // 1. Apply diff of uncommitted changes from base repository
            try {
                const { stdout: diffOut } = await execFileAsync('git', ['diff', 'HEAD'], {
                    cwd: root,
                })
                if (diffOut && diffOut.trim()) {
                    await new Promise<void>((resolve) => {
                        const proc = execFile(
                            'git',
                            ['apply', '--whitespace=nowarn'],
                            { cwd: worktreePath },
                            () => {
                                resolve()
                            }
                        )
                        proc.stdin?.write(diffOut)
                        proc.stdin?.end()
                    })
                }
            } catch {
                // Intentionally swallowed: uncommitted git diff application is best-effort
            }

            // 2. Copy .env* files into isolated worktree
            try {
                const entries = await fs.promises.readdir(root)
                for (const entry of entries) {
                    if (entry.startsWith('.env') && !entry.endsWith('.example')) {
                        const srcPath = path.join(root, entry)
                        const stat = await fs.promises.stat(srcPath)
                        if (stat.isFile()) {
                            const destPath = path.join(worktreePath, entry)
                            if (!fs.existsSync(destPath)) {
                                await fs.promises.copyFile(srcPath, destPath)
                            }
                        }
                    }
                }
            } catch {
                // Intentionally swallowed: environment file replication is best-effort
            }

            // 3. Copy project .december config if exists
            try {
                const srcConfig = path.join(root, '.december', 'config.json')
                if (fs.existsSync(srcConfig)) {
                    const destConfigDir = path.join(worktreePath, '.december')
                    await fs.promises.mkdir(destConfigDir, { recursive: true })
                    await fs.promises.copyFile(srcConfig, path.join(destConfigDir, 'config.json'))
                }
            } catch {
                // Intentionally swallowed: config copying is best-effort
            }
        }

        return { worktreePath, branchName, baseDir: root }
    } catch {
        // Intentionally swallowed: worktree creation error, fallback to null
        return null
    }
}

export async function getWorktreeChanges(worktreePath: string): Promise<WorktreeChanges> {
    if (!fs.existsSync(worktreePath)) {
        return { modifiedFiles: [], diff: '' }
    }

    try {
        const { stdout: statusOut } = await execFileAsync('git', ['status', '--short'], {
            cwd: worktreePath,
        })
        const modifiedFiles = statusOut
            .split('\n')
            .map((line) => line.trim())
            .filter(Boolean)

        const { stdout: diffOut } = await execFileAsync('git', ['diff', 'HEAD'], {
            cwd: worktreePath,
        })

        return {
            modifiedFiles,
            diff: diffOut,
        }
    } catch {
        // Intentionally swallowed: fallback if inspecting worktree git status fails
        return { modifiedFiles: [], diff: '' }
    }
}

export async function cleanupWorktree(
    repoDir: string,
    worktreePath: string,
    options?: WorktreeCleanupOptions
): Promise<void> {
    if (fs.existsSync(worktreePath)) {
        try {
            await execFileAsync('git', ['worktree', 'remove', '--force', worktreePath], {
                cwd: repoDir,
            })
        } catch {
            // Intentionally swallowed: fallback to manual directory removal
            try {
                await fs.promises.rm(worktreePath, { recursive: true, force: true })
            } catch {
                // Intentionally swallowed: filesystem deletion error during cleanup
            }
        }
    }

    if (options?.deleteBranch && options.branchName) {
        try {
            await execFileAsync('git', ['branch', '-D', options.branchName], {
                cwd: repoDir,
            })
        } catch {
            // Intentionally swallowed: branch deletion fallback
        }
    }

    try {
        await execFileAsync('git', ['worktree', 'prune'], { cwd: repoDir })
    } catch {
        // Intentionally swallowed: worktree metadata pruning fallback
    }
}

export async function mergeWorktree(
    repoDir: string,
    branchName: string,
    options?: WorktreeMergeOptions
): Promise<{ success: boolean; message: string }> {
    const commitMsg = options?.commitMessage || `merge worktree branch ${branchName}`
    try {
        const { stdout } = await execFileAsync(
            'git',
            ['merge', '--no-ff', '-m', commitMsg, branchName],
            { cwd: repoDir }
        )
        return {
            success: true,
            message: stdout.trim() || 'Merged successfully.',
        }
    } catch (err: any) {
        return {
            success: false,
            message: `Merge failed: ${err.message}`,
        }
    }
}

export async function listWorktrees(repoDir: string): Promise<string[]> {
    try {
        const { stdout } = await execFileAsync('git', ['worktree', 'list', '--porcelain'], {
            cwd: repoDir,
        })
        return stdout
            .split('\n')
            .filter((line) => line.startsWith('worktree '))
            .map((line) => line.replace('worktree ', '').trim())
    } catch {
        // Intentionally swallowed: list fallback
        return []
    }
}

// -----------------------------------------------------------------------------
// EnterWorktreeTool & ExitWorktreeTool
// -----------------------------------------------------------------------------

const enterWorktreeSchema = Type.Object({
    name: Type.Optional(
        Type.String({
            description:
                'Optional slug or descriptor for the worktree branch (e.g. "refactor-auth" or "exp-feature").',
        })
    ),
    copyUncommitted: Type.Optional(
        Type.Boolean({
            description:
                'Whether to replicate uncommitted changes and local config files into the worktree (default: true).',
        })
    ),
})

export type EnterWorktreeInput = Static<typeof enterWorktreeSchema>

export const EnterWorktreeTool: Tool<EnterWorktreeInput> = {
    name: 'enter_worktree',
    description:
        'Enter an isolated git worktree for safe speculative refactoring, complex modifications, or running exploratory tests without dirtying the main working tree.',
    inputSchema: enterWorktreeSchema,
    execute: async ({ name, copyUncommitted = true }, context: ToolExecuteContext) => {
        const repoDir = context.agent?.workspaceDir || context.operations.env.cwd()
        const isRepo = await isGitRepo(repoDir)
        if (!isRepo) {
            return 'Error: Current workspace directory is not a git repository.'
        }

        const info = await createWorktree(repoDir, name, { copyUncommitted })
        if (!info) {
            return 'Error: Failed to create git worktree.'
        }

        const previousDir = context.agent?.workspaceDir || repoDir
        if (context.agent) {
            if (!context.agent._worktreeStack) {
                context.agent._worktreeStack = []
            }
            context.agent._worktreeStack.push({
                previousDir,
                worktreePath: info.worktreePath,
                branchName: info.branchName,
            })
            context.agent.workspaceDir = info.worktreePath
        }

        if (context.operations.env.setCwd) {
            context.operations.env.setCwd(info.worktreePath)
        }

        return [
            'Entered isolated git worktree:',
            `- Worktree Path: ${info.worktreePath}`,
            `- Worktree Branch: ${info.branchName}`,
            `- Base Workspace: ${previousDir}`,
            '',
            'All subsequent file edits and terminal commands will execute safely inside this isolated worktree.',
            'When finished, call exit_worktree with one of:',
            '- action: "cleanup" to delete the worktree and branch without trace',
            '- action: "keep" to preserve the branch for review or PR and remove the worktree folder',
            '- action: "merge" to merge the branch back into the base branch and clean up',
        ].join('\n')
    },
}

const exitWorktreeSchema = Type.Object({
    action: Type.Union([Type.Literal('cleanup'), Type.Literal('keep'), Type.Literal('merge')], {
        description:
            'Lifecycle action upon exiting the worktree: "cleanup" deletes the worktree and branch without trace, "keep" preserves the branch for review/PR, "merge" merges changes back into base branch.',
    }),
    commitMessage: Type.Optional(
        Type.String({
            description:
                'Optional commit message to commit uncommitted changes in the worktree before exiting or for the merge commit.',
        })
    ),
})

export type ExitWorktreeInput = Static<typeof exitWorktreeSchema>

export const ExitWorktreeTool: Tool<ExitWorktreeInput> = {
    name: 'exit_worktree',
    description:
        'Exit the active isolated git worktree and apply the desired lifecycle action (cleanup to delete without trace, keep to preserve branch for PR/review, or merge to merge changes into parent branch).',
    inputSchema: exitWorktreeSchema,
    execute: async ({ action, commitMessage }, context: ToolExecuteContext) => {
        let worktreeEntry = context.agent?._worktreeStack?.pop()
        const currentCwd = context.agent?.workspaceDir || context.operations.env.cwd()

        if (!worktreeEntry) {
            if (currentCwd.includes(path.join('.december', 'worktrees'))) {
                const gitRoot =
                    (await getGitRoot(currentCwd)) || path.dirname(path.dirname(currentCwd))
                const branchName = path.basename(currentCwd)
                worktreeEntry = {
                    previousDir: gitRoot,
                    worktreePath: currentCwd,
                    branchName: `worktree/${branchName}`,
                }
            } else {
                return 'Error: Not currently in an isolated git worktree.'
            }
        }

        const { previousDir, worktreePath, branchName } = worktreeEntry

        // Inspect worktree changes before exit
        const changes = await getWorktreeChanges(worktreePath)

        // If action is keep or merge and there are uncommitted changes, commit them
        if ((action === 'keep' || action === 'merge') && changes.modifiedFiles.length > 0) {
            try {
                const msg = commitMessage || `worktree changes from ${branchName}`
                await execFileAsync('git', ['add', '-A'], { cwd: worktreePath })
                try {
                    await execFileAsync('git', ['reset', 'HEAD', '--', '.env*', '.december*'], {
                        cwd: worktreePath,
                    })
                } catch {
                    // Intentionally swallowed: unstage fallback
                }
                await execFileAsync('git', ['commit', '-m', msg], { cwd: worktreePath })
            } catch {
                // Intentionally swallowed: commit fallback if nothing to commit or commit fails
            }
        }

        // Restore agent workspace directory
        if (context.agent) {
            context.agent.workspaceDir = previousDir
        }
        if (context.operations.env.setCwd) {
            context.operations.env.setCwd(previousDir)
        }

        if (action === 'cleanup') {
            await cleanupWorktree(previousDir, worktreePath, {
                deleteBranch: true,
                branchName,
            })
            return [
                'Exited worktree and cleaned up without trace:',
                `- Deleted Branch: ${branchName}`,
                `- Removed Directory: ${worktreePath}`,
                `- Restored Workspace: ${previousDir}`,
                `- Discarded ${changes.modifiedFiles.length} modified file(s).`,
            ].join('\n')
        }

        if (action === 'keep') {
            await cleanupWorktree(previousDir, worktreePath, {
                deleteBranch: false,
            })
            return [
                'Exited worktree and preserved branch:',
                `- Preserved Branch: ${branchName}`,
                `- Removed Worktree Directory: ${worktreePath}`,
                `- Restored Workspace: ${previousDir}`,
                `- Modified Files: ${changes.modifiedFiles.length > 0 ? changes.modifiedFiles.join(', ') : 'none'}`,
                `The branch '${branchName}' is ready for review or creating a PR.`,
            ].join('\n')
        }

        if (action === 'merge') {
            const mergeResult = await mergeWorktree(previousDir, branchName, {
                commitMessage,
            })
            await cleanupWorktree(previousDir, worktreePath, {
                deleteBranch: true,
                branchName,
            })
            return [
                'Exited worktree and merged changes:',
                `- Merged Branch: ${branchName}`,
                `- Restored Workspace: ${previousDir}`,
                `- Merge Result: ${mergeResult.message}`,
                `- Modified Files: ${changes.modifiedFiles.length > 0 ? changes.modifiedFiles.join(', ') : 'none'}`,
            ].join('\n')
        }

        return 'Unknown exit action.'
    },
}
