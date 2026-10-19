import os from 'node:os'
import path from 'node:path'

import {
    createWorktree,
    getWorktreeChanges as getChanges,
    cleanupWorktree,
    mergeWorktree,
    isGitRepo as checkGitRepo,
} from '@december/tools'

export interface WorktreeInfo {
    worktreePath: string
    branchName: string
}

export interface WorktreeChanges {
    modifiedFiles: string[]
    diff: string
}

export async function isGitRepo(dir: string): Promise<boolean> {
    return checkGitRepo(dir)
}

export async function createGitWorktree(
    repoDir: string,
    subagentId: string,
    options?: { worktreePath?: string; branchName?: string }
): Promise<WorktreeInfo | null> {
    const sanitizedId = subagentId.replace(/[^a-zA-Z0-9_-]/g, '_')
    const branchName = options?.branchName || `subagent/${sanitizedId}`
    const worktreePath =
        options?.worktreePath || path.join(os.tmpdir(), 'december-worktrees', sanitizedId)

    const info = await createWorktree(repoDir, sanitizedId, {
        branchName,
        worktreePath,
    })

    if (!info) {
        return null
    }

    return {
        worktreePath: info.worktreePath,
        branchName: info.branchName,
    }
}

export async function getWorktreeChanges(worktreePath: string): Promise<WorktreeChanges> {
    return getChanges(worktreePath)
}

export async function cleanupGitWorktree(
    repoDir: string,
    worktreePath: string,
    options?: { deleteBranch?: boolean; branchName?: string }
): Promise<void> {
    return cleanupWorktree(repoDir, worktreePath, options)
}

export async function mergeGitWorktree(
    repoDir: string,
    branchName: string,
    options?: { commitMessage?: string }
): Promise<{ success: boolean; message: string }> {
    return mergeWorktree(repoDir, branchName, options)
}
