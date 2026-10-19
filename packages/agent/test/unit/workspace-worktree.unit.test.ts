import { execSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { describe, it, expect, beforeEach, afterEach } from 'bun:test'

import {
    createGitWorktree,
    getWorktreeChanges,
    cleanupGitWorktree,
    isGitRepo,
} from '../../src/subagent/workspace-worktree'

describe('WorkspaceWorktree (Unit)', () => {
    let testRepoDir: string

    beforeEach(() => {
        testRepoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'december-worktree-test-'))
        execSync('git init', { cwd: testRepoDir })
        execSync('git config user.name "Test Runner"', { cwd: testRepoDir })
        execSync('git config user.email "test@example.com"', { cwd: testRepoDir })
        fs.writeFileSync(path.join(testRepoDir, 'initial.txt'), 'hello world\n')
        execSync('git add initial.txt', { cwd: testRepoDir })
        execSync('git commit -m "initial commit"', { cwd: testRepoDir })
    })

    afterEach(() => {
        try {
            fs.rmSync(testRepoDir, { recursive: true, force: true })
        } catch {
            // Intentionally swallowed: test cleanup error handling
        }
    })

    it('identifies git repository correctly', async () => {
        expect(await isGitRepo(testRepoDir)).toBe(true)
        const nonRepo = fs.mkdtempSync(path.join(os.tmpdir(), 'non-repo-'))
        expect(await isGitRepo(nonRepo)).toBe(false)
        fs.rmSync(nonRepo, { recursive: true, force: true })
    })

    it('creates, inspects, and cleans up git worktree', async () => {
        const subagentId = 'sub-test-' + Date.now()
        const worktreeInfo = await createGitWorktree(testRepoDir, subagentId)

        expect(worktreeInfo).not.toBeNull()
        expect(worktreeInfo?.worktreePath).toBeDefined()
        expect(worktreeInfo?.branchName).toContain(subagentId)

        const worktreePath = worktreeInfo!.worktreePath

        // Verify initial file exists in worktree
        expect(fs.existsSync(path.join(worktreePath, 'initial.txt'))).toBe(true)

        // Make an edit inside the worktree
        fs.writeFileSync(path.join(worktreePath, 'new-file.txt'), 'subagent generated')
        fs.appendFileSync(path.join(worktreePath, 'initial.txt'), 'modified line\n')

        const changes = await getWorktreeChanges(worktreePath)
        expect(changes.modifiedFiles.length).toBeGreaterThanOrEqual(1)

        // Clean up worktree
        await cleanupGitWorktree(testRepoDir, worktreePath)
        expect(fs.existsSync(worktreePath)).toBe(false)
    })
})
