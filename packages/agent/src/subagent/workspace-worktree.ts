import { execFile } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

export interface WorktreeInfo {
    worktreePath: string
    branchName: string
}

export interface WorktreeChanges {
    modifiedFiles: string[]
    diff: string
}

export async function isGitRepo(dir: string): Promise<boolean> {
    try {
        const { stdout } = await execFileAsync('git', ['rev-parse', '--is-inside-work-tree'], {
            cwd: dir,
        })
        return stdout.trim() === 'true'
    } catch {
        // Intentionally swallowed: directory is not a git repository or git is unavailable
        return false
    }
}

export async function createGitWorktree(
    repoDir: string,
    subagentId: string
): Promise<WorktreeInfo | null> {
    const isRepo = await isGitRepo(repoDir)
    if (!isRepo) {
        return null
    }

    const sanitizedId = subagentId.replace(/[^a-zA-Z0-9_-]/g, '_')
    const branchName = `subagent/${sanitizedId}`
    const worktreePath = path.join(os.tmpdir(), 'december-worktrees', sanitizedId)

    try {
        await fs.promises.mkdir(path.dirname(worktreePath), { recursive: true })

        // Remove stale worktree directory if it exists from previous run
        if (fs.existsSync(worktreePath)) {
            try {
                await execFileAsync('git', ['worktree', 'remove', '--force', worktreePath], {
                    cwd: repoDir,
                })
            } catch {
                // Intentionally swallowed: fallback when stale worktree remove fails
                await fs.promises.rm(worktreePath, { recursive: true, force: true })
            }
        }

        // Add git worktree on isolated branch detached from current head
        await execFileAsync('git', ['worktree', 'add', '-b', branchName, worktreePath, 'HEAD'], {
            cwd: repoDir,
        })

        return { worktreePath, branchName }
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

export async function cleanupGitWorktree(repoDir: string, worktreePath: string): Promise<void> {
    if (!fs.existsSync(worktreePath)) {
        return
    }

    try {
        await execFileAsync('git', ['worktree', 'remove', '--force', worktreePath], {
            cwd: repoDir,
        })
    } catch {
        // Intentionally swallowed: fallback to manual directory removal if git command fails
        try {
            await fs.promises.rm(worktreePath, { recursive: true, force: true })
        } catch {
            // Intentionally swallowed: filesystem deletion error during cleanup
        }
    }
}
