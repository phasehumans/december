import { prisma } from '@december/database'
import { encryptText } from '@december/shared/crypto'
import { describe, it, expect, mock, beforeEach, afterEach } from 'bun:test'

import { handleAutonomousTaskBranchAndPr } from '../../src/listener'

describe('Autonomous Task Branching & PR Generation (Ticket #587)', () => {
    const originalFetch = globalThis.fetch
    const originalFindUniqueSession = prisma.session.findUnique
    const originalFindUniqueUser = prisma.user.findUnique
    const originalUpdateSession = prisma.session.update
    const originalFindGitConnection = prisma.gitConnection.findUnique
    const originalFindPrSettings = prisma.pullRequestSettings.findUnique
    let sessionUpdates: any[] = []
    // the saved pull request settings row of the user (#637). null: every default
    let prSettings: Record<string, unknown> | null = null

    beforeEach(() => {
        globalThis.fetch = originalFetch
        prisma.session.findUnique = originalFindUniqueSession
        prisma.user.findUnique = originalFindUniqueUser
        sessionUpdates = []
        // today's behaviour, so the tests below this line read as before the settings
        prSettings = { commitAuthor: 'december', prAuthor: 'user' }
        prisma.pullRequestSettings.findUnique = mock(async () => prSettings) as any
        prisma.session.update = mock(async (args: any) => {
            sessionUpdates.push(args)
            return {}
        }) as any
    })

    afterEach(() => {
        globalThis.fetch = originalFetch
        prisma.session.findUnique = originalFindUniqueSession
        prisma.user.findUnique = originalFindUniqueUser
        prisma.session.update = originalUpdateSession
        prisma.gitConnection.findUnique = originalFindGitConnection
        prisma.pullRequestSettings.findUnique = originalFindPrSettings
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

        // the pull request is saved on the session for the sessions list and Pull requests page
        // first the pushed branch, so the session keeps it (#637), then the pull request
        expect(sessionUpdates).toHaveLength(2)
        expect(sessionUpdates[0]).toEqual({
            where: { id: sessionId },
            data: { prBranch: `december/${sessionId}` },
        })
        expect(sessionUpdates[1]).toEqual({
            where: { id: sessionId },
            data: {
                prNumber: 42,
                prUrl: 'https://github.com/phasehumans/december/pull/42',
                prState: 'open',
                prTitle: prCreatedBody.title,
                prBranch: `december/${sessionId}`,
                prOpenedAt: expect.any(Date),
                prCheckedAt: expect.any(Date),
                prAdditions: 35,
                prDeletions: 4,
            },
        })
    })

    it('pushes the branch but opens no pull request when "open pull request" is off', async () => {
        const sessionId = 'sess-no-pr'
        const executedCommands: string[] = []

        prisma.session.findUnique = mock(async () => ({
            id: sessionId,
            userId: 'user-no-pr',
            title: 'Refactor the cart',
            githubRepoOwner: 'phasehumans',
            githubRepoName: 'december',
            branch: 'main',
            settings: { config: { planFirst: false, effort: 'deep', openPullRequest: false } },
        })) as any
        prisma.user.findUnique = mock(async () => ({
            id: 'user-no-pr',
            githubToken: 'ghp_mock_token_abc',
        })) as any

        const requests: Array<{ url: string; method?: string }> = []
        globalThis.fetch = mock(async (url: string | URL | Request, init?: RequestInit) => {
            requests.push({ url: url.toString(), method: init?.method })
            return new Response('{}', { status: 200 })
        }) as any

        const mockSandbox = {
            commands: {
                run: mock(async (cmd: string) => {
                    executedCommands.push(cmd)
                    if (cmd.includes('git status --porcelain')) {
                        return { stdout: ' M src/cart.ts', exitCode: 0 }
                    }
                    return { stdout: '', exitCode: 0 }
                }),
            },
        }

        const result = await handleAutonomousTaskBranchAndPr({ sessionId, sandbox: mockSandbox })

        expect(result?.state).toBe('branch')
        expect(result?.prNumber).toBeUndefined()
        expect(
            executedCommands.some((c) => c.includes(`git push origin december/${sessionId}`))
        ).toBe(true)
        expect(requests.some((r) => r.url.includes('/pulls') && r.method === 'POST')).toBe(false)
        // only the pushed branch is saved, no pull request
        expect(sessionUpdates).toEqual([
            { where: { id: sessionId }, data: { prBranch: 'december/sess-no-pr' } },
        ])
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

    it('pushes and opens the pull request when the tree is clean but the agent made commits', async () => {
        const sessionId = 'sess-own-commits'
        const userId = 'user-own-commits'
        const executedCommands: string[] = []

        prisma.session.findUnique = mock(async () => ({
            id: sessionId,
            userId,
            title: 'Agent committed its work',
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
                        return { stdout: '', exitCode: 0 }
                    }
                    // two commits that no remote branch has
                    if (cmd.includes('git rev-list --count HEAD --not --remotes')) {
                        return { stdout: '2\n', exitCode: 0 }
                    }
                    return { stdout: '', exitCode: 0 }
                }),
            },
        }

        globalThis.fetch = mock(async (url: string | URL | Request, init?: RequestInit) => {
            if (url.toString().includes('/pulls') && init?.method === 'POST') {
                return new Response(
                    JSON.stringify({
                        number: 77,
                        title: 'feat: Agent committed its work',
                        html_url: 'https://github.com/phasehumans/december/pull/77',
                        state: 'open',
                        additions: 10,
                        deletions: 1,
                        changed_files: 3,
                    }),
                    { status: 201 }
                )
            }
            return new Response('{}', { status: 200 })
        }) as any

        const result = await handleAutonomousTaskBranchAndPr({
            sessionId,
            sandbox: mockSandbox,
        })

        expect(result?.prNumber).toBe(77)
        expect(result?.diffSummary.changedFiles).toBe(3)
        const pushCmd = executedCommands.find((c) => c.includes('git push'))
        expect(pushCmd).toBe(`git push origin december/${sessionId}`)
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

    it('pushes a gitlab session with its own token and opens a merge request on gitlab', async () => {
        const sessionId = 'sess-gitlab-1'
        const userId = 'user-gitlab-1'
        const executedCommands: string[] = []
        const keyHex = '0'.repeat(64)

        prisma.session.findUnique = mock(async () => ({
            id: sessionId,
            userId,
            title: 'Add retry to the importer',
            gitProvider: 'GITLAB',
            githubRepoOwner: 'acme/tools',
            githubRepoName: 'importer',
            branch: 'develop',
        })) as any
        prisma.user.findUnique = mock(async () => ({
            id: userId,
            githubToken: 'ghp_unused',
        })) as any
        prisma.gitConnection.findUnique = mock(async () => ({
            provider: 'GITLAB',
            encryptedAccessToken: encryptText({ text: 'glpat_live', keyHex }),
            encryptedRefreshToken: null,
            expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        })) as any

        const mockSandbox = {
            commands: {
                run: mock(async (cmd: string) => {
                    executedCommands.push(cmd)
                    if (cmd.includes('git status --porcelain')) {
                        return { stdout: ' M src/import.ts', exitCode: 0 }
                    }
                    return { stdout: '', exitCode: 0 }
                }),
            },
        }

        const requests: { url: string; init?: RequestInit }[] = []
        globalThis.fetch = mock(async (url: string | URL | Request, init?: RequestInit) => {
            requests.push({ url: url.toString(), init })
            if (url.toString().endsWith('/merge_requests')) {
                return new Response(
                    JSON.stringify({
                        iid: 8,
                        title: 'feat: Add retry to the importer',
                        web_url: 'https://gitlab.com/acme/tools/importer/-/merge_requests/8',
                        state: 'opened',
                        sha: 'def',
                        changes_count: '1',
                    }),
                    { status: 201 }
                )
            }
            return new Response(JSON.stringify([{ status: 'running' }]), { status: 200 })
        }) as any

        const result = await handleAutonomousTaskBranchAndPr({ sessionId, sandbox: mockSandbox })

        const remoteCmd = executedCommands.find((c) => c.includes('git remote set-url'))
        expect(remoteCmd).toContain('https://oauth2:glpat_live@gitlab.com/acme/tools/importer.git')
        expect(executedCommands.join('\n')).not.toContain('ghp_unused')

        const mrRequest = requests.find((r) => r.url.endsWith('/merge_requests'))
        expect(mrRequest?.url).toBe(
            'https://gitlab.com/api/v4/projects/acme%2Ftools%2Fimporter/merge_requests'
        )
        expect(JSON.parse(String(mrRequest?.init?.body))).toMatchObject({
            source_branch: `december/${sessionId}`,
            target_branch: 'develop',
        })

        expect(result?.prNumber).toBe(8)
        expect(result?.url).toBe('https://gitlab.com/acme/tools/importer/-/merge_requests/8')
        expect(result?.ciStatus).toBe('pending')
        expect(sessionUpdates.at(-1)?.data).toMatchObject({ prNumber: 8, prState: 'open' })
    })

    describe('pull request opening settings (#637)', () => {
        const sessionId = 'sess-open-1'
        const userId = 'user-open-1'

        const setup = (session: Record<string, unknown> = {}) => {
            const executedCommands: string[] = []
            const requests: { url: string; method: string; authorization?: string; body?: any }[] =
                []

            prisma.session.findUnique = mock(async () => ({
                id: sessionId,
                userId,
                title: 'Add search',
                githubRepoOwner: 'acme',
                githubRepoName: 'web',
                branch: 'main',
                ...session,
            })) as any
            prisma.user.findUnique = mock(async () => ({
                id: userId,
                githubToken: 'ghu_user_token',
                githubId: '583231',
                githubUsername: 'octocat',
            })) as any

            const sandbox = {
                commands: {
                    run: mock(async (cmd: string) => {
                        executedCommands.push(cmd)
                        if (cmd.includes('git status --porcelain')) {
                            return { stdout: ' M src/search.ts', exitCode: 0 }
                        }
                        return { stdout: '', exitCode: 0 }
                    }),
                },
            }

            globalThis.fetch = mock(async (url: string | URL | Request, init?: RequestInit) => {
                const urlStr = url.toString()
                const method = init?.method ?? 'GET'
                const authorization = (init?.headers as Record<string, string>)?.Authorization
                const body = init?.body ? JSON.parse(String(init.body)) : undefined
                requests.push({ url: urlStr, method, authorization, body })
                if (urlStr === 'https://api.github.com/user') {
                    return new Response(
                        JSON.stringify({
                            id: 583231,
                            login: 'octocat',
                            name: 'The Octocat',
                            email: null,
                        }),
                        { status: 200 }
                    )
                }
                if (urlStr.endsWith('/pulls') && method === 'POST') {
                    // the app token is refused in the test that says so
                    if (authorization === 'Bearer ghs_refused') {
                        return new Response('{}', { status: 403 })
                    }
                    return new Response(
                        JSON.stringify({
                            number: 7,
                            title: body.title,
                            html_url: 'https://github.com/acme/web/pull/7',
                            state: 'open',
                            draft: body.draft === true,
                        }),
                        { status: 201 }
                    )
                }
                return new Response('{}', { status: 200 })
            }) as any

            return { sandbox, executedCommands, requests }
        }

        const openRequests = (requests: { url: string; method: string }[]) =>
            requests.filter((r) => r.url.endsWith('/pulls') && r.method === 'POST')

        it('uses the branch prefix, the draft setting and the user as commit author', async () => {
            prSettings = {
                branchPrefix: 'feat/ai-',
                prDraft: true,
                prAuthor: 'user',
                commitAuthor: 'both',
            }
            const { sandbox, executedCommands, requests } = setup()

            const result = await handleAutonomousTaskBranchAndPr({ sessionId, sandbox })

            expect(result?.headRef).toBe('feat/ai-sess-open-1')
            expect(
                executedCommands.some((c) => c.includes('git checkout -B feat/ai-sess-open-1'))
            ).toBe(true)
            expect(executedCommands).toContain('git push origin feat/ai-sess-open-1')

            // the email is private on github: the no-reply address
            const identity = executedCommands.find((c) => c.includes('git config user.name'))
            expect(identity).toContain(`git config user.name 'The Octocat'`)
            expect(identity).toContain(
                `git config user.email '583231+octocat@users.noreply.github.com'`
            )
            expect(executedCommands).toContain(
                `git add -A && git commit -m 'feat: add search' -m 'Co-authored-by: December Agent <agent@trydecember.com>'`
            )

            const opened = openRequests(requests) as any[]
            expect(opened).toHaveLength(1)
            expect(opened[0].authorization).toBe('Bearer ghu_user_token')
            expect(opened[0].body).toMatchObject({
                head: 'feat/ai-sess-open-1',
                base: 'main',
                draft: true,
            })
            expect(sessionUpdates.at(-1)?.data).toMatchObject({
                prNumber: 7,
                prState: 'draft',
                prBranch: 'feat/ai-sess-open-1',
            })
        })

        it('keeps the branch the session already has when the prefix changes', async () => {
            prSettings = { branchPrefix: 'feat/', commitAuthor: 'december', prAuthor: 'user' }
            const { sandbox, executedCommands, requests } = setup({
                prBranch: 'december/sess-open-1',
            })

            const result = await handleAutonomousTaskBranchAndPr({ sessionId, sandbox })

            expect(result?.headRef).toBe('december/sess-open-1')
            expect(executedCommands).toContain('git push origin december/sess-open-1')
            expect((openRequests(requests) as any[])[0].body.head).toBe('december/sess-open-1')
        })

        it('"december" opens the pull request with the app token of the repository', async () => {
            prSettings = { prAuthor: 'december', commitAuthor: 'december' }
            const { sandbox, executedCommands, requests } = setup()
            const asked: string[] = []

            const result = await handleAutonomousTaskBranchAndPr({
                sessionId,
                sandbox,
                getAppToken: async (repoPath) => {
                    asked.push(repoPath)
                    return 'ghs_app_token'
                },
            })

            expect(asked).toEqual(['acme/web'])
            const opened = openRequests(requests) as any[]
            expect(opened).toHaveLength(1)
            expect(opened[0].authorization).toBe('Bearer ghs_app_token')
            expect(result?.prNumber).toBe(7)
            // the push stays on the token of the user
            const remote = executedCommands.find((c) => c.includes('git remote set-url'))
            expect(remote).toContain('x-access-token:ghu_user_token@github.com/acme/web.git')
            expect(executedCommands.join('\n')).not.toContain('ghs_app_token')
        })

        it('"december" falls back to the user when the app is not on the repository', async () => {
            prSettings = { prAuthor: 'december', commitAuthor: 'december' }
            const { sandbox, requests } = setup()

            await handleAutonomousTaskBranchAndPr({
                sessionId,
                sandbox,
                getAppToken: async () => null,
            })

            const opened = openRequests(requests) as any[]
            expect(opened.map((r) => r.authorization)).toEqual(['Bearer ghu_user_token'])
        })

        it('"december" falls back to the user when github refuses the app token', async () => {
            prSettings = { prAuthor: 'december', commitAuthor: 'december' }
            const { sandbox, requests } = setup()

            const result = await handleAutonomousTaskBranchAndPr({
                sessionId,
                sandbox,
                getAppToken: async () => 'ghs_refused',
            })

            const opened = openRequests(requests) as any[]
            expect(opened.map((r) => r.authorization)).toEqual([
                'Bearer ghs_refused',
                'Bearer ghu_user_token',
            ])
            expect(result?.prNumber).toBe(7)
        })

        it('"user" never asks for the app token', async () => {
            prSettings = { prAuthor: 'user', commitAuthor: 'december' }
            const { sandbox, requests } = setup()
            let asked = 0

            await handleAutonomousTaskBranchAndPr({
                sessionId,
                sandbox,
                getAppToken: async () => {
                    asked += 1
                    return 'ghs_app_token'
                },
            })

            expect(asked).toBe(0)
            expect((openRequests(requests) as any[])[0].authorization).toBe('Bearer ghu_user_token')
        })

        it('a session with no saved configuration follows the default of the user', async () => {
            prSettings = { prAuthor: 'user', commitAuthor: 'december' }
            const { sandbox, executedCommands, requests } = setup({
                user: { defaultOpenPullRequest: false },
            })

            const result = await handleAutonomousTaskBranchAndPr({ sessionId, sandbox })

            expect(result?.state).toBe('branch')
            expect(executedCommands).toContain('git push origin december/sess-open-1')
            expect(openRequests(requests)).toHaveLength(0)
        })
    })

    it('keeps the work on a local branch when the gitlab connection is missing', async () => {
        const sessionId = 'sess-gitlab-2'
        prisma.session.findUnique = mock(async () => ({
            id: sessionId,
            userId: 'user-gitlab-2',
            title: 't',
            gitProvider: 'GITLAB',
            githubRepoOwner: 'acme',
            githubRepoName: 'app',
            branch: 'main',
        })) as any
        prisma.user.findUnique = mock(async () => ({ githubToken: 'ghp_unused' })) as any
        prisma.gitConnection.findUnique = mock(async () => null) as any
        const executedCommands: string[] = []
        const mockSandbox = {
            commands: {
                run: mock(async (cmd: string) => {
                    executedCommands.push(cmd)
                    return { stdout: cmd.includes('status') ? ' M a.ts' : '', exitCode: 0 }
                }),
            },
        }

        const result = await handleAutonomousTaskBranchAndPr({ sessionId, sandbox: mockSandbox })

        expect(result?.state).toBe('local')
        expect(executedCommands.some((c) => c.includes('git push'))).toBe(false)
    })
})
