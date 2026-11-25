import crypto from 'crypto'

import { setAgentQueue } from '@december/shared/queue'
import { describe, it, expect } from 'bun:test'

import { env } from '../../src/env'
import { githubAppRepository } from '../../src/modules/githubapp/githubapp.repository'
import { githubAppService } from '../../src/modules/githubapp/githubapp.service'
import {
    canClaimInstallation,
    resolveInstallReturnUrl,
} from '../../src/modules/githubapp/githubapp.utils'
import { secretsService } from '../../src/modules/secrets/secrets.service'
import { sessionService } from '../../src/modules/session/session.service'
import { AppError } from '../../src/shared/appError'

describe('GitHubApp Service - Unit Tests', () => {
    describe('verifySignature', () => {
        const payload = JSON.stringify({ action: 'created', installation: { id: 12345 } })
        const secret = env.GITHUB_APP_WEBHOOK_SECRET || 'secret'

        it('should return true for valid HMAC SHA-256 signature', () => {
            const hmac = crypto.createHmac('sha256', secret)
            hmac.update(payload)
            const signature = `sha256=${hmac.digest('hex')}`

            const result = githubAppService.verifySignature({ payload, signature })
            expect(result).toBe(true)
        })

        it('should return false for invalid signature value or signature length mismatch', () => {
            const invalidSignature = 'sha256=invalidhashvalue12345'
            const result1 = githubAppService.verifySignature({
                payload,
                signature: invalidSignature,
            })
            expect(result1).toBe(false)

            const wrongLengthSig = 'sha256=123'
            const result2 = githubAppService.verifySignature({
                payload,
                signature: wrongLengthSig,
            })
            expect(result2).toBe(false)
        })
    })

    describe('processInstallation', () => {
        it('should call githubAppRepository.upsertInstallation', async () => {
            const originalUpsert = githubAppRepository.upsertInstallation
            let calledWith: any = null

            githubAppRepository.upsertInstallation = (async (data: any) => {
                calledWith = data
                return { id: 'inst-1', ...data } as any
            }) as any

            try {
                const res = await githubAppService.processInstallation({
                    installationId: 'install-100',
                    userId: 'user-1',
                    accountLogin: 'test-user',
                    accountType: 'User',
                    targetType: 'selected',
                })
                expect(calledWith).toEqual({
                    installationId: 'install-100',
                    userId: 'user-1',
                    accountLogin: 'test-user',
                    accountType: 'User',
                    targetType: 'selected',
                    permissions: undefined,
                })
                expect(res.installationId).toBe('install-100')
            } finally {
                githubAppRepository.upsertInstallation = originalUpsert
            }
        })
    })

    describe('canClaimInstallation', () => {
        const now = new Date('2026-11-22T12:00:00Z')
        const minutesAgo = (minutes: number) =>
            new Date(now.getTime() - minutes * 60 * 1000).toISOString()

        it('keeps an installation the user already owns', () => {
            expect(
                canClaimInstallation({ existingUserId: 'me', userId: 'me', details: null, now })
            ).toEqual({ linked: true, reason: 'already_owned' })
        })

        it("refuses another user's installation even with matching details", () => {
            expect(
                canClaimInstallation({
                    existingUserId: 'someone-else',
                    userId: 'me',
                    userGithubId: '42',
                    details: { account: { id: 42, type: 'User' }, created_at: minutesAgo(1) },
                    now,
                })
            ).toEqual({ linked: false, reason: 'owned_by_other_user' })
        })

        it('refuses when github details are unavailable', () => {
            expect(canClaimInstallation({ userId: 'me', details: null, now })).toEqual({
                linked: false,
                reason: 'unverified',
            })
        })

        it('links a personal install whose account id matches the user github id', () => {
            expect(
                canClaimInstallation({
                    existingUserId: null,
                    userId: 'me',
                    userGithubId: '42',
                    details: { account: { id: 42, type: 'User' }, created_at: minutesAgo(600) },
                    now,
                })
            ).toEqual({ linked: true, reason: 'account_matches' })
        })

        it("refuses a personal install on someone else's account, however recent", () => {
            expect(
                canClaimInstallation({
                    userId: 'me',
                    userGithubId: '42',
                    details: { account: { id: 7, type: 'User' }, created_at: minutesAgo(1) },
                    now,
                })
            ).toEqual({ linked: false, reason: 'account_mismatch' })
        })

        it('links an unclaimed organisation install only right after it was created', () => {
            const org = (createdAt: string) => ({
                account: { id: 9, type: 'Organization' },
                created_at: createdAt,
            })
            expect(
                canClaimInstallation({
                    userId: 'me',
                    userGithubId: '42',
                    details: org(minutesAgo(5)),
                    now,
                })
            ).toEqual({ linked: true, reason: 'recent_unclaimed' })
            expect(
                canClaimInstallation({
                    userId: 'me',
                    userGithubId: '42',
                    details: org(minutesAgo(61)),
                    now,
                })
            ).toEqual({ linked: false, reason: 'stale_unclaimed' })
        })

        it('treats a user without github id like an organisation install', () => {
            const details = { account: { id: 7, type: 'User' }, created_at: minutesAgo(5) }
            expect(
                canClaimInstallation({ userId: 'me', userGithubId: null, details, now })
            ).toEqual({
                linked: true,
                reason: 'recent_unclaimed',
            })
            expect(
                canClaimInstallation({ userId: 'me', details: { account: details.account }, now })
            ).toEqual({ linked: false, reason: 'stale_unclaimed' })
        })
    })

    describe('resolveInstallReturnUrl', () => {
        const appUrl = 'https://app.trydecember.com'
        const prod = (returnUrl: string) =>
            resolveInstallReturnUrl({ returnUrl, appUrl, isProduction: true })

        it('keeps relative paths on the app host', () => {
            expect(prod('/settings/repositories')).toBe(
                'https://app.trydecember.com/settings/repositories'
            )
            expect(prod('settings')).toBe('https://app.trydecember.com/settings')
            expect(prod('//evil.com')).toBe('https://app.trydecember.com//evil.com')
        })

        it('allows https urls on our own hosts', () => {
            expect(prod('https://app.trydecember.com/x')).toBe('https://app.trydecember.com/x')
            expect(prod('https://trydecember.com/x')).toBe('https://trydecember.com/x')
        })

        it('rejects other hosts, including any vercel app', () => {
            const fallback = 'https://app.trydecember.com/settings/repositories'
            expect(prod('https://evil.vercel.app/x')).toBe(fallback)
            expect(prod('https://evil.com')).toBe(fallback)
            expect(prod('https://trydecember.com.evil.com')).toBe(fallback)
            expect(prod('http://app.trydecember.com/x')).toBe(fallback)
        })

        it('allows localhost only outside production', () => {
            expect(prod('http://localhost:3000/x')).toBe(
                'https://app.trydecember.com/settings/repositories'
            )
            expect(
                resolveInstallReturnUrl({
                    returnUrl: 'http://localhost:3000/x',
                    appUrl,
                    isProduction: false,
                })
            ).toBe('http://localhost:3000/x')
        })
    })

    describe('findInstallationOwner', () => {
        const withGithubIds = async (ids: Record<string, string>, run: () => Promise<void>) => {
            const original = githubAppRepository.findUserIdByGithubId
            githubAppRepository.findUserIdByGithubId = (async (githubId: string) =>
                ids[githubId] ?? null) as any
            try {
                await run()
            } finally {
                githubAppRepository.findUserIdByGithubId = original
            }
        }

        it('matches a personal install by the account github id', async () => {
            await withGithubIds({ '42': 'user-42' }, async () => {
                expect(
                    await githubAppService.findInstallationOwner({
                        accountId: '42',
                        accountType: 'User',
                        senderId: '7',
                    })
                ).toBe('user-42')
            })
        })

        it('uses the sender id for organisation installs, never the org id', async () => {
            await withGithubIds({ '9': 'collides-with-org-id', '7': 'user-7' }, async () => {
                expect(
                    await githubAppService.findInstallationOwner({
                        accountId: '9',
                        accountType: 'Organization',
                        senderId: '7',
                    })
                ).toBe('user-7')
            })
        })

        it('returns null when no github id matches', async () => {
            await withGithubIds({}, async () => {
                expect(
                    await githubAppService.findInstallationOwner({ accountType: 'User' })
                ).toBeNull()
            })
        })
    })

    describe('claimInstallation', () => {
        const withRepoStubs = async (
            stubs: { user?: any; existing?: any },
            run: (upserts: any[]) => Promise<void>
        ) => {
            const upserts: any[] = []
            const original = {
                findUserGithubId: githubAppRepository.findUserGithubId,
                findByInstallationId: githubAppRepository.findByInstallationId,
                upsertInstallation: githubAppRepository.upsertInstallation,
            }
            githubAppRepository.findUserGithubId = (async () => stubs.user ?? null) as any
            githubAppRepository.findByInstallationId = (async () => stubs.existing ?? null) as any
            githubAppRepository.upsertInstallation = (async (data: any) => {
                upserts.push(data)
                return data
            }) as any
            try {
                await run(upserts)
            } finally {
                githubAppRepository.findUserGithubId = original.findUserGithubId
                githubAppRepository.findByInstallationId = original.findByInstallationId
                githubAppRepository.upsertInstallation = original.upsertInstallation
            }
        }

        it('does not write when the installation belongs to another user', async () => {
            await withRepoStubs(
                {
                    user: { id: 'me', githubId: '42', isDeleted: false },
                    existing: { installationId: '1', userId: 'someone-else' },
                },
                async (upserts) => {
                    const res = await githubAppService.claimInstallation({
                        installationId: '1',
                        userId: 'me',
                    })
                    expect(res).toEqual({ linked: false, reason: 'owned_by_other_user' })
                    expect(upserts).toHaveLength(0)
                }
            )
        })

        it('does not write for an unknown or deleted user', async () => {
            await withRepoStubs({ user: { id: 'me', isDeleted: true } }, async (upserts) => {
                const res = await githubAppService.claimInstallation({
                    installationId: '1',
                    userId: 'me',
                })
                expect(res.linked).toBe(false)
                expect(upserts).toHaveLength(0)
            })
        })

        it('refreshes an installation the user already owns', async () => {
            await withRepoStubs(
                {
                    user: { id: 'me', githubId: '42', isDeleted: false },
                    existing: { installationId: '1', userId: 'me' },
                },
                async (upserts) => {
                    const res = await githubAppService.claimInstallation({
                        installationId: '1',
                        userId: 'me',
                    })
                    expect(res).toEqual({ linked: true, reason: 'already_owned' })
                    expect(upserts).toEqual([{ installationId: '1', userId: 'me' }])
                }
            )
        })
    })

    describe('processUninstallation', () => {
        it('should call githubAppRepository.deleteInstallation', async () => {
            const originalDelete = githubAppRepository.deleteInstallation
            let calledWith: any = null

            githubAppRepository.deleteInstallation = (async (installationId: string) => {
                calledWith = { installationId }
                return { id: 'inst-1', installationId } as any
            }) as any

            try {
                const res = await githubAppService.processUninstallation({
                    installationId: 'install-100',
                })
                expect(calledWith).toEqual({ installationId: 'install-100' })
                expect(res?.installationId).toBe('install-100')
            } finally {
                githubAppRepository.deleteInstallation = originalDelete
            }
        })
    })

    describe('getUserInstallationStatus', () => {
        it('should return installed: false when no installation exists', async () => {
            const originalFindByUserId = githubAppRepository.findByUserId
            githubAppRepository.findByUserId = (async () => null) as any

            try {
                const status = await githubAppService.getUserInstallationStatus({
                    userId: 'user-404',
                })
                expect(status).toEqual({
                    installed: false,
                    installationId: null,
                    accountLogin: null,
                    accountType: null,
                    targetType: null,
                })
            } finally {
                githubAppRepository.findByUserId = originalFindByUserId
            }
        })

        it('should return installed: true and metadata when installation exists', async () => {
            const originalFindByUserId = githubAppRepository.findByUserId
            githubAppRepository.findByUserId = (async () => ({
                id: 'inst-row-1',
                installationId: '123456',
                userId: 'user-1',
                accountLogin: 'octocat',
                accountType: 'User',
                targetType: 'selected',
                permissions: {},
                createdAt: new Date(),
                updatedAt: new Date(),
            })) as any

            try {
                const status = await githubAppService.getUserInstallationStatus({
                    userId: 'user-1',
                })
                expect(status).toEqual({
                    installed: true,
                    installationId: '123456',
                    accountLogin: 'octocat',
                    accountType: 'User',
                    targetType: 'selected',
                })
            } finally {
                githubAppRepository.findByUserId = originalFindByUserId
            }
        })
    })

    describe('getUserInstallationToken', () => {
        it('should throw AppError 400 when installation does not exist', async () => {
            const originalFindByUserId = githubAppRepository.findByUserId
            githubAppRepository.findByUserId = (async () => null) as any

            try {
                await expect(
                    githubAppService.getUserInstallationToken({ userId: 'user-none' })
                ).rejects.toThrow('GitHub App is not installed for this account')
            } finally {
                githubAppRepository.findByUserId = originalFindByUserId
            }
        })

        it('should look up installation by owner if owner is provided', async () => {
            const originalFindByOwnerAndUser = githubAppRepository.findByOwnerAndUser
            const originalFetch = globalThis.fetch

            let searchedOwner: string | null = null
            githubAppRepository.findByOwnerAndUser = (async (owner: string) => {
                searchedOwner = owner
                return {
                    id: 'inst-org-1',
                    installationId: '999111',
                    userId: 'user-1',
                    accountLogin: 'my-org',
                    accountType: 'Organization',
                    targetType: 'selected',
                    permissions: {},
                    createdAt: new Date(),
                    updatedAt: new Date(),
                } as any
            }) as any

            globalThis.fetch = (async (url: string) => {
                if (url.includes('/access_tokens')) {
                    return {
                        ok: true,
                        json: async () => ({
                            token: 'ghs_mocked_token',
                            expires_at: '2026-08-25T12:00:00Z',
                        }),
                    }
                }
                return { ok: false, text: async () => 'Not found' }
            }) as any

            try {
                const token = await githubAppService.getUserInstallationToken({
                    userId: 'user-1',
                    owner: 'my-org',
                })
                expect(searchedOwner).toBe('my-org')
                expect(token).toBe('ghs_mocked_token')
            } finally {
                githubAppRepository.findByOwnerAndUser = originalFindByOwnerAndUser
                globalThis.fetch = originalFetch
            }
        })
    })

    describe('getUserInstallationRepos', () => {
        it('should aggregate repositories across multiple installations', async () => {
            const originalFindAll = githubAppRepository.findAllByUserId
            const originalFetch = globalThis.fetch

            githubAppRepository.findAllByUserId = (async () => [
                { installationId: 'inst-1', userId: 'user-1' },
                { installationId: 'inst-2', userId: 'user-1' },
            ]) as any

            let repoFetchCount = 0
            globalThis.fetch = (async (url: string) => {
                if (url.includes('/access_tokens')) {
                    return {
                        ok: true,
                        json: async () => ({
                            token: 'ghs_token',
                            expires_at: '2026-08-25T12:00:00Z',
                        }),
                    }
                }

                if (url.includes('/installation/repositories')) {
                    repoFetchCount++
                    return {
                        ok: true,
                        json: async () => ({
                            repositories: [
                                {
                                    id: repoFetchCount === 1 ? 101 : 102,
                                    name: repoFetchCount === 1 ? 'personal-private' : 'org-private',
                                    full_name:
                                        repoFetchCount === 1
                                            ? 'user/personal-private'
                                            : 'org/org-private',
                                    private: true,
                                    default_branch: 'main',
                                    updated_at: '2026-08-25T00:00:00Z',
                                    html_url: 'https://github.com/...',
                                    clone_url: 'https://github.com/...',
                                    owner: { login: repoFetchCount === 1 ? 'user' : 'org' },
                                },
                            ],
                        }),
                    }
                }

                return { ok: false, text: async () => 'Not found' }
            }) as any

            try {
                const repos = await githubAppService.getUserInstallationRepos({
                    userId: 'user-1',
                })
                expect(repos.length).toBe(2)
                expect(repos[0].name).toBe('personal-private')
                expect(repos[0].private).toBe(true)
                expect(repos[1].name).toBe('org-private')
                expect(repos[1].private).toBe(true)
            } finally {
                githubAppRepository.findAllByUserId = originalFindAll
                globalThis.fetch = originalFetch
            }
        })
    })

    describe('github runs (#568)', () => {
        const repository = {
            name: 'test-repo',
            fullName: 'org/test-repo',
            owner: { login: 'org' },
            defaultBranch: 'main',
            private: false,
        }
        const baseCommentData = {
            installationId: 'inst-999',
            repository,
            issue: {
                number: 101,
                title: 'Bug in auth token',
                body: 'The auth token expires too early.',
            },
            comment: {
                id: 555,
                body: 'Hello world without bot mention',
                user: { login: 'someuser', id: 12 },
                authorAssociation: 'COLLABORATOR',
            },
        }

        type Stubs = {
            settings?: Record<string, unknown> | null
            owner?: string | null
            modelSource?: 'CREDITS' | 'OWN_KEY'
            ownKey?: { provider: string; defaultModel: string } | null
            createSession?: (data: any) => Promise<any>
            pr?: Record<string, unknown>
            runs?: any[]
            githubUsername?: string | null
            prSession?: { userId: string } | null
        }

        // stubs every outside call; returns what the handler did
        const withStubs = async <T>(stubs: Stubs, fn: () => Promise<T>) => {
            const calls = {
                comments: [] as string[],
                reactions: [] as string[],
                sessions: [] as any[],
                githubRuns: [] as any[],
                jobs: [] as { name: string; data: any }[],
            }
            const repo = githubAppRepository as any
            const saved = {
                findByInstallationId: repo.findByInstallationId,
                findPullRequestSettings: repo.findPullRequestSettings,
                findRunOwner: repo.findRunOwner,
                findLatestOwnKey: repo.findLatestOwnKey,
                setSessionGithubRun: repo.setSessionGithubRun,
                findGithubRuns: repo.findGithubRuns,
                findUserGithubUsername: repo.findUserGithubUsername,
                findSessionByPullRequest: repo.findSessionByPullRequest,
                createSession: sessionService.createSession,
                getAllDecryptedSecrets: secretsService.getAllDecryptedSecrets,
                fetch: globalThis.fetch,
            }
            const ownerId = stubs.owner === undefined ? 'user-1' : stubs.owner
            repo.findByInstallationId = async () =>
                ownerId
                    ? { installationId: 'inst-999', userId: ownerId, accountLogin: 'org' }
                    : null
            repo.findPullRequestSettings = async () => stubs.settings ?? null
            repo.findRunOwner = async () => ({
                id: 'user-1',
                githubUsername: stubs.githubUsername ?? 'owner-login',
                defaultModelSource: stubs.modelSource ?? 'CREDITS',
            })
            repo.findLatestOwnKey = async () => stubs.ownKey ?? null
            repo.setSessionGithubRun = async (_id: string, run: any) => {
                calls.githubRuns.push(run)
                return { id: _id }
            }
            repo.findGithubRuns = async () => stubs.runs ?? []
            repo.findUserGithubUsername = async () => stubs.githubUsername ?? 'owner-login'
            repo.findSessionByPullRequest = async () => stubs.prSession ?? null
            ;(sessionService as any).createSession =
                stubs.createSession ??
                (async (data: any) => {
                    calls.sessions.push(data)
                    return { id: 'session-1' }
                })
            ;(secretsService as any).getAllDecryptedSecrets = async () => []
            setAgentQueue({
                add: (async (name: string, data: any) => {
                    calls.jobs.push({ name, data })
                    return { id: 'job-1' }
                }) as any,
            } as any)
            globalThis.fetch = (async (url: string | URL | Request, options?: any) => {
                const href = url.toString()
                if (href.includes('/access_tokens')) {
                    return new Response(JSON.stringify({ token: 'ghs_test', expires_at: 'x' }), {
                        status: 201,
                    })
                }
                if (href.includes('/reactions')) {
                    calls.reactions.push(href)
                    return new Response(JSON.stringify({ id: 1 }), { status: 201 })
                }
                if (href.includes('/comments') && options?.method === 'POST') {
                    calls.comments.push(JSON.parse(options.body).body)
                    return new Response(JSON.stringify({ id: 1 }), { status: 201 })
                }
                if (href.includes('/check-runs')) {
                    return new Response(
                        JSON.stringify({
                            check_runs: [
                                { name: 'lint', conclusion: 'failure', output: { title: 'boom' } },
                            ],
                        }),
                        { status: 200 }
                    )
                }
                if (href.includes('/pulls/')) {
                    return new Response(
                        JSON.stringify({
                            number: 7,
                            title: 'feat: sessions',
                            body: 'adds sessions',
                            draft: false,
                            user: { login: 'contributor' },
                            head: {
                                ref: 'feat/sessions',
                                sha: 'abc123',
                                repo: { full_name: 'org/test-repo' },
                            },
                            base: { ref: 'main' },
                            ...stubs.pr,
                        }),
                        { status: 200 }
                    )
                }
                return new Response(JSON.stringify({}), { status: 200 })
            }) as any

            try {
                const result = await fn()
                return { result, calls }
            } finally {
                Object.assign(repo, {
                    findByInstallationId: saved.findByInstallationId,
                    findPullRequestSettings: saved.findPullRequestSettings,
                    findRunOwner: saved.findRunOwner,
                    findLatestOwnKey: saved.findLatestOwnKey,
                    setSessionGithubRun: saved.setSessionGithubRun,
                    findGithubRuns: saved.findGithubRuns,
                    findUserGithubUsername: saved.findUserGithubUsername,
                    findSessionByPullRequest: saved.findSessionByPullRequest,
                })
                ;(sessionService as any).createSession = saved.createSession
                ;(secretsService as any).getAllDecryptedSecrets = saved.getAllDecryptedSecrets
                setAgentQueue(null)
                globalThis.fetch = saved.fetch
            }
        }

        const comment = (body: string, extra: Partial<typeof baseCommentData.comment> = {}) => ({
            ...baseCommentData,
            comment: { ...baseCommentData.comment, body, ...extra },
        })
        const onPullRequest = (body: string) => ({
            ...comment(body),
            issue: { ...baseCommentData.issue, number: 7, pullRequest: { url: 'x' } },
        })

        it('ignores comments without @trydecember', async () => {
            const { result, calls } = await withStubs({}, () =>
                githubAppService.handleIssueComment(baseCommentData)
            )
            expect(result.reason).toBe('not_mentioned')
            expect(calls.comments).toEqual([])
        })

        it("never answers December's own comments", async () => {
            const { result } = await withStubs({}, () =>
                githubAppService.handleIssueComment(
                    comment('@trydecember opened #2', {
                        user: { login: 'trydecember[bot]', id: 1 },
                    })
                )
            )
            expect(result.reason).toBe('bot')
        })

        it('tells people who are not collaborators that it only runs for collaborators', async () => {
            const { result, calls } = await withStubs({}, () =>
                githubAppService.handleIssueComment(
                    comment('@trydecember fix this', { authorAssociation: 'NONE' })
                )
            )
            expect(result.reason).toBe('unauthorized_sender')
            expect(calls.comments[0]).toContain('collaborators')
            expect(calls.sessions).toEqual([])
        })

        it('asks to link an installation that has no December account', async () => {
            const { result, calls } = await withStubs({ owner: null }, () =>
                githubAppService.handleIssueComment(comment('@trydecember fix this'))
            )
            expect(result.reason).toBe('no_owner')
            expect(calls.comments[0]).toContain('not linked')
        })

        it('stays quiet when the owner paused github comments', async () => {
            const { result, calls } = await withStubs(
                { settings: { githubCommentsEnabled: false } },
                () => githubAppService.handleIssueComment(comment('@trydecember fix this'))
            )
            expect(result.reason).toBe('paused')
            expect(calls.comments).toEqual([])
            expect(calls.reactions).toEqual([])
        })

        it('explains that review works on pull requests only', async () => {
            const { result, calls } = await withStubs({}, () =>
                githubAppService.handleIssueComment(comment('@trydecember review'))
            )
            expect(result.reason).toBe('review_on_issue')
            expect(calls.comments[0]).toContain('reviews pull requests')
        })

        it('starts an issue run as a session on the default branch and links it', async () => {
            const { result, calls } = await withStubs({}, () =>
                githubAppService.handleIssueComment(
                    comment('@trydecember please fix auth token refresh', {
                        authorAssociation: 'OWNER',
                    })
                )
            )
            expect(result).toEqual({ handled: true, reason: undefined, sessionId: 'session-1' })
            expect(calls.reactions[0]).toContain('/issues/comments/555/reactions')
            expect(calls.sessions[0]).toMatchObject({
                userId: 'user-1',
                title: '#101 Bug in auth token',
                repoUrl: 'https://github.com/org/test-repo',
                branch: 'main',
                issueNumber: 101,
                billingSource: 'CREDITS',
            })
            expect(calls.sessions[0].prompt).toContain('please fix auth token refresh')
            expect(calls.githubRuns[0]).toMatchObject({
                mode: 'issue',
                number: 101,
                requestedBy: 'someuser',
                baseRef: 'main',
            })
            expect(calls.jobs[0].name).toBe('run_agent')
            expect(calls.jobs[0].data).toMatchObject({ sessionId: 'session-1', userId: 'user-1' })
            expect(calls.comments[0]).toContain('/session/session-1')
        })

        it('starts a review run on a pull request with its head commit', async () => {
            const { calls } = await withStubs({}, () =>
                githubAppService.handleIssueComment(onPullRequest('@trydecember review'))
            )
            expect(calls.githubRuns[0]).toMatchObject({
                mode: 'review',
                number: 7,
                baseRef: 'main',
                headRef: 'feat/sessions',
                headSha: 'abc123',
            })
            expect(calls.sessions[0].branch).toBe('main')
            expect(calls.sessions[0].title).toBe('Review #7 feat: sessions')
            expect(calls.comments[0]).toContain('Reviewing')
        })

        it('any other request on a pull request changes that branch', async () => {
            const { calls } = await withStubs({}, () =>
                githubAppService.handleIssueComment(onPullRequest('@trydecember rename the flag'))
            )
            expect(calls.githubRuns[0].mode).toBe('change')
            expect(calls.sessions[0].branch).toBe('feat/sessions')
        })

        it('does not take tasks on a pull request from a fork', async () => {
            const { result, calls } = await withStubs(
                {
                    pr: {
                        head: {
                            ref: 'patch-1',
                            sha: 'f1',
                            repo: { full_name: 'someone/test-repo' },
                        },
                    },
                },
                () => githubAppService.handleIssueComment(onPullRequest('@trydecember fix it'))
            )
            expect(result.reason).toBe('fork')
            expect(calls.comments[0]).toContain('fork')
            expect(calls.sessions).toEqual([])
        })

        it('runs on the own key the owner used last', async () => {
            const { calls } = await withStubs(
                { modelSource: 'OWN_KEY', ownKey: { provider: 'anthropic', defaultModel: 'm-1' } },
                () => githubAppService.handleIssueComment(comment('@trydecember fix this'))
            )
            expect(calls.sessions[0]).toMatchObject({
                billingSource: 'OWN_KEY',
                provider: 'anthropic',
                model: 'm-1',
            })
            expect(calls.jobs[0].data).toMatchObject({ billingSource: 'OWN_KEY', model: 'm-1' })
        })

        it('own key with no saved key: replies and starts nothing', async () => {
            const { result, calls } = await withStubs(
                { modelSource: 'OWN_KEY', ownKey: null },
                () => githubAppService.handleIssueComment(comment('@trydecember fix this'))
            )
            expect(result.reason).toBe('no_own_key')
            expect(calls.comments[0]).toContain('no key is saved')
            expect(calls.sessions).toEqual([])
        })

        it('a low balance replies with the billing link', async () => {
            const { result, calls } = await withStubs(
                {
                    createSession: async () => {
                        throw new AppError('Insufficient balance.', 402)
                    },
                },
                () => githubAppService.handleIssueComment(comment('@trydecember fix this'))
            )
            expect(result.reason).toBe('session_402')
            expect(calls.comments[0]).toContain('/settings/billing')
            expect(calls.jobs).toEqual([])
        })

        describe('automatic review', () => {
            const event = (action: string, extra: Record<string, unknown> = {}) => ({
                installationId: 'inst-999',
                action,
                repository,
                pullRequest: {
                    number: 7,
                    title: 'feat: sessions',
                    body: 'adds sessions',
                    draft: false,
                    head: { ref: 'feat/sessions', sha: 'abc123' },
                    base: { ref: 'main' },
                    user: { login: 'owner-login' },
                    ...extra,
                },
            })

            it('"when asked" never reviews on its own', async () => {
                const { result, calls } = await withStubs({}, () =>
                    githubAppService.handlePullRequestEvent(event('opened'))
                )
                expect(result.reason).toBe('not_wanted')
                expect(calls.sessions).toEqual([])
            })

            it('"my PRs" reviews a new pull request by the owner, quietly', async () => {
                const { result, calls } = await withStubs(
                    { settings: { autoReview: 'mine' } },
                    () => githubAppService.handlePullRequestEvent(event('opened'))
                )
                expect(result.handled).toBe(true)
                expect(calls.githubRuns[0]).toMatchObject({
                    mode: 'review',
                    trigger: 'auto_review',
                    requestedBy: 'december',
                })
                expect(calls.comments).toEqual([])
            })

            it('reviews a commit only once', async () => {
                const { result } = await withStubs(
                    {
                        settings: { autoReview: 'all', reviewCadence: 'push' },
                        runs: [{ githubRun: { mode: 'review', headSha: 'abc123' } }],
                    },
                    () => githubAppService.handlePullRequestEvent(event('synchronize'))
                )
                expect(result.reason).toBe('already_reviewed')
            })
        })

        describe('review comments', () => {
            const reviewComment = (body: string, user = 'someuser') => ({
                installationId: 'inst-999',
                repository,
                pullRequest: {
                    number: 7,
                    title: 'feat: sessions',
                    body: '',
                    authorLogin: 'trydecember[bot]',
                    head: { ref: 'feat/sessions', sha: 'abc123', repoFullName: 'org/test-repo' },
                    base: { ref: 'main' },
                },
                comment: {
                    id: 9,
                    body,
                    path: 'src/a.ts',
                    line: 4,
                    diffHunk: '@@ -1 +1 @@',
                    user: { login: user },
                    authorAssociation: 'MEMBER',
                },
            })

            it('"off" answers no line comments', async () => {
                const { result } = await withStubs({ settings: { reviewReplies: 'off' } }, () =>
                    githubAppService.handleReviewComment(reviewComment('@trydecember fix'))
                )
                expect(result.reason).toBe('off')
            })

            it('a mention on a line starts a change run with the file and lines', async () => {
                const { calls } = await withStubs({}, () =>
                    githubAppService.handleReviewComment(reviewComment('@trydecember use a const'))
                )
                expect(calls.reactions[0]).toContain('/pulls/comments/9/reactions')
                expect(calls.githubRuns[0]).toMatchObject({
                    mode: 'change',
                    trigger: 'review_comment',
                })
                expect(calls.sessions[0].prompt).toContain('src/a.ts line 4')
            })

            it('"all" answers comments without a mention on December pull requests', async () => {
                const { result } = await withStubs(
                    { settings: { reviewReplies: 'all' }, prSession: { userId: 'user-1' } },
                    () => githubAppService.handleReviewComment(reviewComment('use a const here'))
                )
                expect(result.handled).toBe(true)
            })
        })

        describe('failed checks', () => {
            const suite = {
                installationId: 'inst-999',
                repository,
                conclusion: 'failure',
                headSha: 'abc123',
                pullRequestNumbers: [7],
            }

            it('fixes failed checks on a December pull request, with the failed checks', async () => {
                const { calls } = await withStubs({ prSession: { userId: 'user-1' } }, () =>
                    githubAppService.handleCheckSuite(suite)
                )
                expect(calls.githubRuns[0]).toMatchObject({
                    mode: 'change',
                    trigger: 'failed_checks',
                    headSha: 'abc123',
                })
                expect(calls.sessions[0].prompt).toContain('lint (failure): boom')
            })

            it('never fixes the same commit twice', async () => {
                const { result } = await withStubs(
                    {
                        prSession: { userId: 'user-1' },
                        runs: [{ githubRun: { trigger: 'failed_checks', headSha: 'abc123' } }],
                    },
                    () => githubAppService.handleCheckSuite(suite)
                )
                expect(result.reason).toBe('already_fixing')
            })

            it('leaves pull requests that are not December pull requests alone', async () => {
                const { result } = await withStubs({}, () =>
                    githubAppService.handleCheckSuite(suite)
                )
                expect(result.reason).toBe('not_december_pull_request')
            })
        })
    })
})
