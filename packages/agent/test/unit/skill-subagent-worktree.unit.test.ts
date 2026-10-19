import { execSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { describe, it, expect, beforeEach, afterEach } from 'bun:test'

import { Agent } from '../../src/agent'
import { executeSkillInSubagent } from '../../src/skills/skill-subagent'
import { executeDynamicSubagent } from '../../src/subagent/dynamic-subagent'

import type { LLMProvider } from '@december/providers'
import type { DiscoveredSkill, Tool } from '@december/shared'

describe('SkillSubagent Worktree Isolation (Unit)', () => {
    let testRepoDir: string

    beforeEach(() => {
        testRepoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'december-skill-worktree-test-'))
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
            // Intentionally swallowed: test cleanup
        }
    })

    const dummySkill: DiscoveredSkill = {
        name: 'refactor-code',
        metadata: {
            name: 'refactor-code',
            description: 'Refactor code',
        },
        directoryPath: '/workspace/skills/refactor-code',
        entryFilePath: '/workspace/skills/refactor-code/SKILL.md',
        origin: 'workspace',
        scripts: [],
        references: [],
    }

    it('runs skill subagent with worktree isolation and cleanup lifecycle', async () => {
        let executionWorkspaceDir: string | undefined

        const mockTool: Tool = {
            name: 'write_worktree_file',
            description: 'Write a file',
            inputSchema: {},
            execute: async (_input, context) => {
                executionWorkspaceDir = context.agent?.workspaceDir
                if (executionWorkspaceDir) {
                    fs.writeFileSync(
                        path.join(executionWorkspaceDir, 'isolated-skill.txt'),
                        'skill content'
                    )
                }
                return 'file written'
            },
        }

        let turn = 0
        const mockLlm: LLMProvider = {
            id: 'mock',
            stream: async function* () {
                turn++
                if (turn === 1) {
                    yield {
                        type: 'tool_call',
                        toolCall: {
                            id: 'tc-1',
                            name: 'write_worktree_file',
                            input: '{}',
                        },
                    }
                } else {
                    yield {
                        type: 'text',
                        text: 'Skill refactoring finished successfully.',
                    }
                }
            },
        }

        const parentAgent = new Agent({
            tools: [mockTool],
            llm: mockLlm,
            operations: {} as any,
            workspaceDir: testRepoDir,
        })

        const result = await executeSkillInSubagent({
            skill: { ...dummySkill, content: '# Instructions\nRun refactor.' } as any,
            parentAgent,
            isolation: 'worktree',
            worktreeLifecycle: 'cleanup',
        })

        expect(result.success).toBe(true)
        expect(result.summary).toContain('Skill refactoring finished successfully')
        expect(result.worktreeBranch).toBeDefined()
        expect(executionWorkspaceDir).toBeDefined()
        expect(executionWorkspaceDir).toContain('.december')

        // With cleanup lifecycle, isolated branch and path should be cleaned up
        const branches = execSync('git branch', { cwd: testRepoDir }).toString()
        expect(branches).not.toContain(result.worktreeBranch!)

        // Original repo directory was never dirtied
        expect(fs.existsSync(path.join(testRepoDir, 'isolated-skill.txt'))).toBe(false)
    })

    it('runs skill subagent with worktree isolation and keep lifecycle', async () => {
        let executionWorkspaceDir: string | undefined

        const mockTool: Tool = {
            name: 'write_kept_file',
            description: 'Write a file',
            inputSchema: {},
            execute: async (_input, context) => {
                executionWorkspaceDir = context.agent?.workspaceDir
                if (executionWorkspaceDir) {
                    fs.writeFileSync(
                        path.join(executionWorkspaceDir, 'kept-skill.txt'),
                        'kept content'
                    )
                }
                return 'file written'
            },
        }

        let turn = 0
        const mockLlm: LLMProvider = {
            id: 'mock',
            stream: async function* () {
                turn++
                if (turn === 1) {
                    yield {
                        type: 'tool_call',
                        toolCall: {
                            id: 'tc-1',
                            name: 'write_kept_file',
                            input: '{}',
                        },
                    }
                } else {
                    yield {
                        type: 'text',
                        text: 'Skill completed.',
                    }
                }
            },
        }

        const parentAgent = new Agent({
            tools: [mockTool],
            llm: mockLlm,
            operations: {} as any,
            workspaceDir: testRepoDir,
        })

        const result = await executeSkillInSubagent({
            skill: { ...dummySkill, content: '# Instructions\nRun refactor.' } as any,
            parentAgent,
            isolation: 'worktree',
            worktreeLifecycle: 'keep',
        })

        expect(result.success).toBe(true)
        expect(result.worktreeBranch).toBeDefined()

        // With keep lifecycle, branch is preserved in git
        const branches = execSync('git branch', { cwd: testRepoDir }).toString()
        expect(branches).toContain(result.worktreeBranch!)
    })

    it('dynamic subagent supports worktree lifecycle cleanup', async () => {
        let subagentWorktreeDir: string | undefined

        const mockTool: Tool = {
            name: 'write_dyn_file',
            description: 'Write a file',
            inputSchema: {},
            execute: async (_input, context) => {
                subagentWorktreeDir = context.agent?.workspaceDir
                if (subagentWorktreeDir) {
                    fs.writeFileSync(
                        path.join(subagentWorktreeDir, 'subagent-file.txt'),
                        'subagent content'
                    )
                }
                return 'written'
            },
        }

        let turn = 0
        const mockLlm: LLMProvider = {
            id: 'mock',
            stream: async function* () {
                turn++
                if (turn === 1) {
                    yield {
                        type: 'tool_call',
                        toolCall: {
                            id: 'tc-1',
                            name: 'write_dyn_file',
                            input: '{}',
                        },
                    }
                } else {
                    yield {
                        type: 'text',
                        text: 'Subagent finished work.',
                    }
                }
            },
        }

        const parentAgent = new Agent({
            tools: [mockTool],
            llm: mockLlm,
            operations: {} as any,
            workspaceDir: testRepoDir,
        })

        const summary = await executeDynamicSubagent({
            role: 'refactorer',
            task: 'Refactor code',
            parentAgent,
            workspace: 'worktree',
            worktreeLifecycle: 'cleanup',
        })

        expect(summary.status).toBe('completed')
        expect(summary.worktreeBranch).toBeDefined()
        expect(subagentWorktreeDir).toBeDefined()

        // With cleanup lifecycle, branch was deleted
        const branches = execSync('git branch', { cwd: testRepoDir }).toString()
        expect(branches).not.toContain(summary.worktreeBranch!)

        // Original working directory remains clean
        expect(fs.existsSync(path.join(testRepoDir, 'subagent-file.txt'))).toBe(false)
    })
})
