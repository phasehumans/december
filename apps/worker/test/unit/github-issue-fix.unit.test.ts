import { prisma } from '@december/database'
import { describe, it, expect, mock, beforeEach, afterEach } from 'bun:test'

import { E2BSandboxService } from '../../src/e2b-sandbox.service'
import { processGithubIssueFix } from '../../src/github-issue-fix.service'

describe('GitHub Issue Fix Worker Service (Unit Tests)', () => {
    const originalFetch = globalThis.fetch
    const originalFindUniqueUser = prisma.user.findUnique

    beforeEach(() => {
        globalThis.fetch = originalFetch
        prisma.user.findUnique = originalFindUniqueUser
    })

    afterEach(() => {
        globalThis.fetch = originalFetch
        prisma.user.findUnique = originalFindUniqueUser
    })

    const baseJobData = {
        taskType: 'github_issue_fix' as const,
        installationId: 'inst-123',
        gitToken: 'ghs_mock_token_456',
        repoFullName: 'phasehumans/december',
        repoOwner: 'phasehumans',
        repoName: 'december',
        defaultBranch: 'main',
        issueNumber: 568,
        issueTitle: 'Automated github bot and action',
        issueBody: 'Please implement automated bot',
        commentId: 999,
        commentAuthor: 'chaitanya',
        prompt: 'fix this issue and open a pr',
        userId: 'user-777',
    }

    it('rejects execution and posts issue comment if user has insufficient credits (< 50)', async () => {
        let commentPostedBody = ''

        prisma.user.findUnique = mock(async () => ({
            id: 'user-777',
            creditBalance: 20, // less than 50 ($0.50)
        })) as any

        globalThis.fetch = mock(async (url: string | URL | Request, init?: any) => {
            if (url.toString().includes('/comments') && init?.method === 'POST') {
                commentPostedBody = JSON.parse(init.body).body
                return new Response(JSON.stringify({ id: 101 }), { status: 201 })
            }
            return new Response('{}', { status: 200 })
        }) as any

        const res = await processGithubIssueFix(baseJobData)

        expect(res.status).toBe('FAILED')
        expect(res.error).toBe('Insufficient credits')
        expect(commentPostedBody).toContain('Insufficient wallet credits')
    })

    it('clones repository, commits changes, creates PR, and posts confirmation comment', async () => {
        prisma.user.findUnique = mock(async () => ({
            id: 'user-777',
            creditBalance: 500,
        })) as any

        const executedCommands: string[] = []

        const mockSandbox = {
            commands: {
                run: mock(async (cmd: string) => {
                    executedCommands.push(cmd)
                    if (cmd.includes('git status --porcelain')) {
                        return { stdout: ' M apps/server/src/index.ts\n', exitCode: 0 }
                    }
                    if (cmd.includes('git push')) {
                        return { stdout: '', exitCode: 0 }
                    }
                    return { stdout: 'Command executed', exitCode: 0 }
                }),
            },
            kill: mock(async () => {}),
        }

        E2BSandboxService.setMockClient({
            create: async () => mockSandbox,
        })

        let prRequestBody: any = null
        let issueCommentBody: any = null

        globalThis.fetch = mock(async (url: string | URL | Request, init?: any) => {
            const urlStr = url.toString()
            if (urlStr.includes('/pulls') && init?.method === 'POST') {
                prRequestBody = JSON.parse(init.body)
                return new Response(
                    JSON.stringify({
                        number: 789,
                        html_url: 'https://github.com/phasehumans/december/pull/789',
                    }),
                    { status: 201 }
                )
            }
            if (urlStr.includes('/comments') && init?.method === 'POST') {
                issueCommentBody = JSON.parse(init.body)
                return new Response(JSON.stringify({ id: 888 }), { status: 201 })
            }
            return new Response('{}', { status: 200 })
        }) as any

        try {
            const res = await processGithubIssueFix(baseJobData)

            expect(res.status).toBe('COMPLETED')
            expect(res.prNumber).toBe(789)
            expect(res.prUrl).toBe('https://github.com/phasehumans/december/pull/789')

            // Verify git operations
            const userConfigCmd = executedCommands.find((c) =>
                c.includes('user.name "december[bot]"')
            )
            expect(userConfigCmd).toBeDefined()

            const branchCmd = executedCommands.find((c) =>
                c.includes('checkout -B december/issue-568')
            )
            expect(branchCmd).toBeDefined()

            const pushCmd = executedCommands.find((c) =>
                c.includes('git push -u origin december/issue-568')
            )
            expect(pushCmd).toBeDefined()

            // Verify PR details
            expect(prRequestBody.head).toBe('december/issue-568')
            expect(prRequestBody.base).toBe('main')
            expect(prRequestBody.title).toContain('fix: #568')
            expect(prRequestBody.body).toContain('Closes #568')
            expect(prRequestBody.body).toContain('Triggered by @chaitanya in #568')
            // Verify no emoji in footer
            expect(prRequestBody.body).not.toContain('⚡')

            // Verify issue confirmation comment
            expect(issueCommentBody.body).toContain('PR #789')
        } finally {
            E2BSandboxService.resetMockClient()
        }
    })

    it('posts explanation comment and returns SKIPPED if no changes are produced', async () => {
        prisma.user.findUnique = mock(async () => ({
            id: 'user-777',
            creditBalance: 500,
        })) as any

        const mockSandbox = {
            commands: {
                run: mock(async (cmd: string) => {
                    if (cmd.includes('git status --porcelain')) {
                        return { stdout: '', exitCode: 0 } // No changes
                    }
                    return { stdout: '', exitCode: 0 }
                }),
            },
            kill: mock(async () => {}),
        }

        E2BSandboxService.setMockClient({
            create: async () => mockSandbox,
        })

        let issueCommentBody: any = null

        globalThis.fetch = mock(async (url: string | URL | Request, init?: any) => {
            const urlStr = url.toString()
            if (urlStr.includes('/comments') && init?.method === 'POST') {
                issueCommentBody = JSON.parse(init.body)
                return new Response(JSON.stringify({ id: 888 }), { status: 201 })
            }
            return new Response('{}', { status: 200 })
        }) as any

        try {
            const res = await processGithubIssueFix(baseJobData)

            expect(res.status).toBe('SKIPPED')
            expect(issueCommentBody.body).toContain('no automated code changes were produced')
        } finally {
            E2BSandboxService.resetMockClient()
        }
    })
})
