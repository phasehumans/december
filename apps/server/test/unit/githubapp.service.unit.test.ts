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

    describe('handleIssueComment', () => {
        const baseCommentData = {
            installationId: 'inst-999',
            repository: {
                name: 'test-repo',
                fullName: 'org/test-repo',
                owner: { login: 'org' },
                defaultBranch: 'main',
                private: false,
            },
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

        it('returns handled: false if comment does not mention @trydecember', async () => {
            const res = await githubAppService.handleIssueComment(baseCommentData)
            expect(res.handled).toBe(false)
            expect(res.reason).toBe('not_mentioned')
        })

        it('rejects trigger and posts warning comment if sender is unauthorized', async () => {
            const originalFetch = globalThis.fetch
            const originalGetToken = githubAppService.getInstallationAccessToken
            let postedCommentBody = ''

            githubAppService.getInstallationAccessToken = (async () => ({
                token: 'ghs_token_mock',
                expiresAt: '2026-10-30T00:00:00Z',
            })) as any

            globalThis.fetch = (async (url: string | URL | Request, options?: any) => {
                if (url.toString().includes('/comments') && options?.method === 'POST') {
                    postedCommentBody = JSON.parse(options.body).body
                    return new Response(JSON.stringify({ id: 1 }), { status: 201 })
                }
                return new Response(JSON.stringify({}), { status: 200 })
            }) as any

            try {
                const res = await githubAppService.handleIssueComment({
                    ...baseCommentData,
                    comment: {
                        ...baseCommentData.comment,
                        body: '@trydecember fix this',
                        authorAssociation: 'NONE',
                    },
                })

                expect(res.handled).toBe(false)
                expect(res.reason).toBe('unauthorized_sender')
                expect(postedCommentBody).toContain('collaborator')
            } finally {
                githubAppService.getInstallationAccessToken = originalGetToken
                globalThis.fetch = originalFetch
            }
        })

        it('acknowledges with eyes reaction and enqueues job for authorized mention', async () => {
            const originalFetch = globalThis.fetch
            const originalGetToken = githubAppService.getInstallationAccessToken
            const originalFindByInstallationId = githubAppRepository.findByInstallationId
            let reactionAdded = ''
            let enqueuedJobName = ''
            let enqueuedJobData: any = null

            setAgentQueue({
                add: (async (name: string, data: any) => {
                    enqueuedJobName = name
                    enqueuedJobData = data
                    return { id: 'job-123' }
                }) as any,
            } as any)

            githubAppService.getInstallationAccessToken = (async () => ({
                token: 'ghs_token_mock',
                expiresAt: '2026-10-30T00:00:00Z',
            })) as any

            githubAppRepository.findByInstallationId = (async () => ({
                id: 'inst-rec-1',
                installationId: 'inst-999',
                userId: null,
            })) as any

            globalThis.fetch = (async (url: string | URL | Request, options?: any) => {
                if (url.toString().includes('/reactions') && options?.method === 'POST') {
                    reactionAdded = JSON.parse(options.body).content
                    return new Response(JSON.stringify({ id: 1, content: 'eyes' }), { status: 201 })
                }
                return new Response(JSON.stringify({}), { status: 200 })
            }) as any

            try {
                const res = await githubAppService.handleIssueComment({
                    ...baseCommentData,
                    comment: {
                        ...baseCommentData.comment,
                        body: '@trydecember please fix auth token refresh and write tests',
                        authorAssociation: 'OWNER',
                    },
                })

                expect(res.handled).toBe(true)
                expect(res.issueNumber).toBe(101)
                expect(res.jobId).toBe('job-123')
                expect(reactionAdded).toBe('eyes')
                expect(enqueuedJobName).toBe('github_issue_fix')
                expect(enqueuedJobData.prompt).toBe('please fix auth token refresh and write tests')
                expect(enqueuedJobData.repoFullName).toBe('org/test-repo')
            } finally {
                setAgentQueue(null)
                githubAppService.getInstallationAccessToken = originalGetToken
                githubAppRepository.findByInstallationId = originalFindByInstallationId
                globalThis.fetch = originalFetch
            }
        })
    })

    describe('handlePullRequestOpened', () => {
        const basePrData = {
            installationId: 'inst-pr-100',
            repository: {
                name: 'test-repo',
                fullName: 'org/test-repo',
                owner: { login: 'org' },
                defaultBranch: 'main',
                private: false,
            },
            pullRequest: {
                number: 456,
                title: 'feat: add user sessions',
                body: 'Here is PR description without bot mention',
                head: { ref: 'feat/sessions', sha: 'abc123' },
                base: { ref: 'main' },
                user: { login: 'contributor', id: 55 },
                authorAssociation: 'COLLABORATOR',
            },
        }

        it('returns handled: false if PR body does not mention @trydecember', async () => {
            const res = await githubAppService.handlePullRequestOpened(basePrData)
            expect(res.handled).toBe(false)
            expect(res.reason).toBe('not_mentioned')
        })

        it('rejects trigger and posts warning comment if sender is unauthorized', async () => {
            const originalFetch = globalThis.fetch
            const originalGetToken = githubAppService.getInstallationAccessToken
            let postedCommentBody = ''

            githubAppService.getInstallationAccessToken = (async () => ({
                token: 'ghs_token_mock',
                expiresAt: '2026-10-30T00:00:00Z',
            })) as any

            globalThis.fetch = (async (url: string | URL | Request, options?: any) => {
                if (url.toString().includes('/comments') && options?.method === 'POST') {
                    postedCommentBody = JSON.parse(options.body).body
                    return new Response(JSON.stringify({ id: 1 }), { status: 201 })
                }
                return new Response(JSON.stringify({}), { status: 200 })
            }) as any

            try {
                const res = await githubAppService.handlePullRequestOpened({
                    ...basePrData,
                    pullRequest: {
                        ...basePrData.pullRequest,
                        body: '@trydecember review this pr',
                        authorAssociation: 'NONE',
                    },
                })

                expect(res.handled).toBe(false)
                expect(res.reason).toBe('unauthorized_sender')
                expect(postedCommentBody).toContain('collaborator')
            } finally {
                githubAppService.getInstallationAccessToken = originalGetToken
                globalThis.fetch = originalFetch
            }
        })

        it('acknowledges with eyes reaction and enqueues job with PR branch details for authorized mention', async () => {
            const originalFetch = globalThis.fetch
            const originalGetToken = githubAppService.getInstallationAccessToken
            const originalFindByInstallationId = githubAppRepository.findByInstallationId
            let reactionAdded = ''
            let reactionTargetUrl = ''
            let enqueuedJobName = ''
            let enqueuedJobData: any = null

            setAgentQueue({
                add: (async (name: string, data: any) => {
                    enqueuedJobName = name
                    enqueuedJobData = data
                    return { id: 'job-pr-456' }
                }) as any,
            } as any)

            githubAppService.getInstallationAccessToken = (async () => ({
                token: 'ghs_token_mock',
                expiresAt: '2026-10-30T00:00:00Z',
            })) as any

            githubAppRepository.findByInstallationId = (async () => ({
                id: 'inst-rec-2',
                installationId: 'inst-pr-100',
                userId: null,
            })) as any

            globalThis.fetch = (async (url: string | URL | Request, options?: any) => {
                if (url.toString().includes('/reactions') && options?.method === 'POST') {
                    reactionTargetUrl = url.toString()
                    reactionAdded = JSON.parse(options.body).content
                    return new Response(JSON.stringify({ id: 1, content: 'eyes' }), { status: 201 })
                }
                return new Response(JSON.stringify({}), { status: 200 })
            }) as any

            try {
                const res = await githubAppService.handlePullRequestOpened({
                    ...basePrData,
                    pullRequest: {
                        ...basePrData.pullRequest,
                        body: '@trydecember review this pr and check for regressions',
                        authorAssociation: 'COLLABORATOR',
                    },
                })

                expect(res.handled).toBe(true)
                expect(res.pullRequestNumber).toBe(456)
                expect(res.jobId).toBe('job-pr-456')
                expect(reactionAdded).toBe('eyes')
                expect(reactionTargetUrl).toContain('/issues/456/reactions')
                expect(enqueuedJobName).toBe('github_issue_fix')
                expect(enqueuedJobData.isPullRequest).toBe(true)
                expect(enqueuedJobData.pullRequestHead).toBe('feat/sessions')
                expect(enqueuedJobData.prompt).toBe('review this pr and check for regressions')
            } finally {
                setAgentQueue(null)
                githubAppService.getInstallationAccessToken = originalGetToken
                githubAppRepository.findByInstallationId = originalFindByInstallationId
                globalThis.fetch = originalFetch
            }
        })
    })
})
