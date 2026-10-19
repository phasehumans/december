import { execFile } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'

import { describe, it, expect, beforeEach, afterEach } from 'bun:test'

import {
    isGitRepo,
    getGitRoot,
    createWorktree,
    getWorktreeChanges,
    cleanupWorktree,
    EnterWorktreeTool,
    ExitWorktreeTool,
} from '../../src/worktree'

const execFileAsync = promisify(execFile)

describe('Worktree Management & Tools (Unit)', () => {
    let testRepoDir: string

    beforeEach(async () => {
        testRepoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'december-worktree-tools-test-'))
        await execFileAsync('git', ['init'], { cwd: testRepoDir })
        await execFileAsync('git', ['config', 'user.email', 'test@example.com'], {
            cwd: testRepoDir,
        })
        await execFileAsync('git', ['config', 'user.name', 'Test User'], { cwd: testRepoDir })

        // Create initial commit
        fs.writeFileSync(path.join(testRepoDir, 'README.md'), '# Test Repo\n')
        fs.writeFileSync(path.join(testRepoDir, '.env'), 'SECRET_KEY=12345\n')
        await execFileAsync('git', ['add', 'README.md'], { cwd: testRepoDir })
        await execFileAsync('git', ['commit', '-m', 'initial commit'], { cwd: testRepoDir })
    })

    afterEach(async () => {
        try {
            await fs.promises.rm(testRepoDir, { recursive: true, force: true })
        } catch {
            // Intentionally swallowed: test cleanup
        }
    })

    it('identifies git repository and root correctly', async () => {
        const isRepo = await isGitRepo(testRepoDir)
        expect(isRepo).toBe(true)

        const root = await getGitRoot(testRepoDir)
        expect(root).toBe(fs.realpathSync(testRepoDir))

        const nonRepo = fs.mkdtempSync(path.join(os.tmpdir(), 'non-repo-'))
        expect(await isGitRepo(nonRepo)).toBe(false)
        await fs.promises.rm(nonRepo, { recursive: true, force: true })
    })

    it('creates worktree under .december/worktrees and copies .env config', async () => {
        const info = await createWorktree(testRepoDir, 'my-feature')
        expect(info).not.toBeNull()
        expect(info!.worktreePath).toContain(path.join('.december', 'worktrees', 'my-feature'))
        expect(info!.branchName).toBe('worktree/my-feature')
        expect(fs.existsSync(info!.worktreePath)).toBe(true)

        // Verify .env was copied into worktree
        expect(fs.existsSync(path.join(info!.worktreePath, '.env'))).toBe(true)
        expect(fs.readFileSync(path.join(info!.worktreePath, '.env'), 'utf8')).toContain(
            'SECRET_KEY=12345'
        )

        // Make changes and inspect
        fs.writeFileSync(path.join(info!.worktreePath, 'new-file.txt'), 'hello from worktree')
        const changes = await getWorktreeChanges(info!.worktreePath)
        expect(changes.modifiedFiles).toContain('?? new-file.txt')

        // Clean up
        await cleanupWorktree(testRepoDir, info!.worktreePath, {
            deleteBranch: true,
            branchName: info!.branchName,
        })
        expect(fs.existsSync(info!.worktreePath)).toBe(false)
    })

    it('EnterWorktreeTool and ExitWorktreeTool with cleanup action', async () => {
        let currentCwd = testRepoDir
        const mockAgent: any = {
            workspaceDir: testRepoDir,
        }
        const mockContext: any = {
            agent: mockAgent,
            operations: {
                env: {
                    cwd: () => currentCwd,
                    setCwd: (dir: string) => {
                        currentCwd = dir
                    },
                },
            },
        }

        // 1. Enter worktree
        const enterOutput = await EnterWorktreeTool.execute(
            { name: 'test-sandbox', copyUncommitted: true },
            mockContext
        )
        expect(enterOutput).toContain('Entered isolated git worktree')
        expect(mockAgent.workspaceDir).toContain('test-sandbox')
        expect(currentCwd).toBe(mockAgent.workspaceDir)

        // 2. Make modification inside worktree
        fs.writeFileSync(path.join(mockAgent.workspaceDir, 'worktree.txt'), 'scratch data')

        // 3. Exit worktree with cleanup action
        const exitOutput = await ExitWorktreeTool.execute({ action: 'cleanup' }, mockContext)
        expect(exitOutput).toContain('Exited worktree and cleaned up without trace')
        expect(mockAgent.workspaceDir).toBe(testRepoDir)
        expect(currentCwd).toBe(testRepoDir)
    })

    it('EnterWorktreeTool and ExitWorktreeTool with merge action', async () => {
        let currentCwd = testRepoDir
        const mockAgent: any = {
            workspaceDir: testRepoDir,
        }
        const mockContext: any = {
            agent: mockAgent,
            operations: {
                env: {
                    cwd: () => currentCwd,
                    setCwd: (dir: string) => {
                        currentCwd = dir
                    },
                },
            },
        }

        // 1. Enter worktree
        await EnterWorktreeTool.execute({ name: 'feature-merge' }, mockContext)
        const worktreeDir = mockAgent.workspaceDir

        // 2. Add and modify file in worktree
        fs.writeFileSync(path.join(worktreeDir, 'feature.txt'), 'new feature code')

        // 3. Exit with merge action
        const exitOutput = await ExitWorktreeTool.execute(
            { action: 'merge', commitMessage: 'merge feature from worktree' },
            mockContext
        )
        expect(exitOutput).toContain('Exited worktree and merged changes')
        expect(mockAgent.workspaceDir).toBe(testRepoDir)

        // Verify merged file exists in parent repository
        expect(fs.existsSync(path.join(testRepoDir, 'feature.txt'))).toBe(true)
        expect(fs.readFileSync(path.join(testRepoDir, 'feature.txt'), 'utf8')).toBe(
            'new feature code'
        )
    })

    it('EnterWorktreeTool and ExitWorktreeTool with keep action preserves branch', async () => {
        let currentCwd = testRepoDir
        const mockAgent: any = {
            workspaceDir: testRepoDir,
        }
        const mockContext: any = {
            agent: mockAgent,
            operations: {
                env: {
                    cwd: () => currentCwd,
                    setCwd: (dir: string) => {
                        currentCwd = dir
                    },
                },
            },
        }

        await EnterWorktreeTool.execute({ name: 'feature-keep' }, mockContext)
        const worktreeDir = mockAgent.workspaceDir
        fs.writeFileSync(path.join(worktreeDir, 'kept.txt'), 'kept changes')

        const exitOutput = await ExitWorktreeTool.execute({ action: 'keep' }, mockContext)
        expect(exitOutput).toContain('Exited worktree and preserved branch')
        expect(mockAgent.workspaceDir).toBe(testRepoDir)

        // Verify branch still exists in git
        const { stdout: branches } = await execFileAsync('git', ['branch'], { cwd: testRepoDir })
        expect(branches).toContain('worktree/feature-keep')
    })
})
