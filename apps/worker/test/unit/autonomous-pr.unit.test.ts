import { prisma } from '@december/database'
import { describe, it, expect, mock, beforeEach, afterEach } from 'bun:test'

import { handleAutonomousTaskBranchAndPr } from '../../src/listener'

describe('Autonomous Task Branching & PR Generation (Ticket #587)', () => {
    const originalFetch = globalThis.fetch
    const originalFindUniqueSession = prisma.session.findUnique
    const originalFindUniqueUser = prisma.user.findUnique

    beforeEach(() => {
        globalThis.fetch = originalFetch
        prisma.session.findUnique = originalFindUniqueSession
        prisma.user.findUnique = originalFindUniqueUser
    })

    afterEach(() => {
        globalThis.fetch = originalFetch
        prisma.session.findUnique = originalFindUniqueSession
        prisma.user.findUnique = originalFindUniqueUser
    })

    it('creates dedicated task branch december/<sessionId>, commits with author identity, pushes to origin, and creates GitHub PR', async () => {
        const sessionId = 'sess-pr-123'
        const userId = 'user-pr-123'
        const executedCommands: string[] = []

        prisma.session.findUnique = mock(async () => ({
            id: sessionId,
            userId,
            title: 'Add search filter to dashboard',
            githubRepoOwner: 'phasehumans',
            githubRepoName: 'december',
            branch: 'main',
        })) as any

        prisma.user.findUnique = mock(async () => ({
            id: userId,
            githubToken: 'ghp_mock_token_abc',
        })) as any

        const mockSandbox = {
            commands: {
                run: mock(async (cmd: string) => {
                    executedCommands.push(cmd)
                    if (cmd.includes('git status --porcelain')) {
                        return { stdout: ' M src/search.ts\n?? src/filter.ts', exitCode: 0 }
                    }
                    if (cmd.includes('git rev-parse HEAD')) {
                        return { stdout: 'commit-sha-789\n', exitCode: 0 }
                    }
                    return { stdout: '', exitCode: 0 }
                }),
            },
        }

        let prCreatedBody: any = null
        globalThis.fetch = mock(async (url: string | URL | Request, init?: RequestInit) => {
            const urlStr = url.toString()
            if (urlStr.includes('/pulls')) {
                if (init?.method === 'POST') {
                    prCreatedBody = JSON.parse(init.body as string)
                    return new Response(
                        JSON.stringify({
                            number: 42,
                            title: prCreatedBody.title,
                            html_url: 'https://github.com/phasehumans/december/pull/42',
                            state: 'open',
                            head: { ref: `december/${sessionId}` },
                            base: { ref: 'main' },
                            additions: 35,
                            deletions: 4,
                            changed_files: 2,
                            created_at: new Date().toISOString(),
                            updatedAt: new Date().toISOString(),
                        }),
                        { status: 201 }
                    )
                }
            }
            if (urlStr.includes('/check-runs')) {
                return new Response(
                    JSON.stringify({ total_count: 1, check_runs: [{ conclusion: 'success' }] }),
                    { status: 200 }
                )
            }
            return new Response('{}', { status: 200 })
        }) as any

        const result = await handleAutonomousTaskBranchAndPr({
            sessionId,
            sandbox: mockSandbox,
        })

        expect(result).not.toBeNull()
        expect(result?.prNumber).toBe(42)
        expect(result?.headRef).toBe(`december/${sessionId}`)
        expect(result?.baseRef).toBe('main')
        expect(result?.url).toBe('https://github.com/phasehumans/december/pull/42')

        // Verify task branch checkout: strictly creates dedicated task branch december/<sessionId>
        const checkoutCmd = executedCommands.find((c) => c.includes('git checkout -B'))
        expect(checkoutCmd).toBeDefined()
        expect(checkoutCmd).toContain(`december/${sessionId}`)

        // Verify clean git identity configuration
        const userConfigCmd = executedCommands.find((c) => c.includes('git config user.name'))
        expect(userConfigCmd).toBeDefined()
        expect(userConfigCmd).toContain('December Agent')

        // Verify push pushes the task branch and NEVER forces to main
        const pushCmd = executedCommands.find((c) => c.includes('git push'))
        expect(pushCmd).toBeDefined()
        expect(pushCmd).toContain(`december/${sessionId}`)
        expect(pushCmd).not.toContain('git push origin main')
        expect(pushCmd).not.toContain('--force')

        // Verify PR payload
        expect(prCreatedBody).not.toBeNull()
        expect(prCreatedBody.head).toBe(`december/${sessionId}`)
        expect(prCreatedBody.base).toBe('main')
        expect(prCreatedBody.body).toContain('Verification Notes')
    })

    it('returns null and skips push/PR creation if git status is clean', async () => {
        const sessionId = 'sess-clean'
        const executedCommands: string[] = []

        const mockSandbox = {
            commands: {
                run: mock(async (cmd: string) => {
                    executedCommands.push(cmd)
                    if (cmd.includes('git status --porcelain')) {
                        return { stdout: '', exitCode: 0 }
                    }
                    return { stdout: '', exitCode: 0 }
                }),
            },
        }

        const result = await handleAutonomousTaskBranchAndPr({
            sessionId,
            sandbox: mockSandbox,
        })

        expect(result).toBeNull()
        expect(executedCommands.some((c) => c.includes('git push'))).toBe(false)
    })

    it('handles existing PR gracefully on 422 response and resolves open PR', async () => {
        const sessionId = 'sess-existing-pr'
        const userId = 'user-pr-456'

        prisma.session.findUnique = mock(async () => ({
            id: sessionId,
            userId,
            title: 'Fix responsive navigation layout',
            githubRepoOwner: 'phasehumans',
            githubRepoName: 'december',
            branch: 'main',
        })) as any

        prisma.user.findUnique = mock(async () => ({
            id: userId,
            githubToken: 'ghp_mock_token_existing',
        })) as any

        const mockSandbox = {
            commands: {
                run: mock(async (cmd: string) => {
                    if (cmd.includes('git status --porcelain')) {
                        return { stdout: ' M src/Nav.tsx', exitCode: 0 }
                    }
                    return { stdout: '', exitCode: 0 }
                }),
            },
        }

        globalThis.fetch = mock(async (url: string | URL | Request, init?: RequestInit) => {
            const urlStr = url.toString()
            if (urlStr.includes('/pulls')) {
                if (init?.method === 'POST') {
                    // GitHub returns 422 Unprocessable Entity when PR already exists
                    return new Response(
                        JSON.stringify({
                            message: 'Validation Failed',
                            errors: [{ message: 'A pull request already exists for this branch' }],
                        }),
                        { status: 422 }
                    )
                }
                // GET existing PRs list
                return new Response(
                    JSON.stringify([
                        {
                            number: 55,
                            title: 'Fix responsive navigation layout',
                            html_url: 'https://github.com/phasehumans/december/pull/55',
                            state: 'open',
                            head: { ref: `december/${sessionId}` },
                            base: { ref: 'main' },
                            additions: 12,
                            deletions: 3,
                            changed_files: 1,
                        },
                    ]),
                    { status: 200 }
                )
            }
            return new Response('{}', { status: 200 })
        }) as any

        const result = await handleAutonomousTaskBranchAndPr({
            sessionId,
            sandbox: mockSandbox,
        })

        expect(result).not.toBeNull()
        expect(result?.prNumber).toBe(55)
        expect(result?.url).toBe('https://github.com/phasehumans/december/pull/55')
    })
})
