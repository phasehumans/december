import crypto from 'crypto'

import { setAgentQueue } from '@december/shared/queue'
import { describe, it, expect } from 'bun:test'

import { env } from '../../src/env'
import { githubAppRepository } from '../../src/modules/githubapp/githubapp.repository'
import { githubAppService } from '../../src/modules/githubapp/githubapp.service'
import {
    canClaimInstallation,
    resolveInstallReturnUrl,
    toInstallProblem,
    toLocalCallbackUrl,
    withInstallProblem,
} from '../../src/modules/githubapp/githubapp.utils'
import { secretsService } from '../../src/modules/secrets/secrets.service'
import { sessionService } from '../../src/modules/session/session.service'
import { AppError } from '../../src/shared/appError'
import { appCache } from '../../src/shared/cache'

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

        it('refuses an unclaimed organisation install without proof, however recent (V1)', () => {
            expect(
                canClaimInstallation({
                    userId: 'me',
                    userGithubId: '42',
                    details: {
                        account: { id: 9, type: 'Organization' },
                        created_at: minutesAgo(1),
                    },
                })
            ).toEqual({ linked: false, reason: 'unverified' })
        })

        it('refuses a new install for a user without github id when github gave no proof (V1)', () => {
            const details = { account: { id: 7, type: 'User' }, created_at: minutesAgo(1) }
            expect(canClaimInstallation({ userId: 'me', userGithubId: null, details })).toEqual({
                linked: false,
                reason: 'unverified',
            })
        })

        it('links an install that github lists for the authorizing user', () => {
            expect(
                canClaimInstallation({
                    userId: 'me',
                    details: { account: { id: 9, type: 'Organization' } },
                    userHasAccess: true,
                })
            ).toEqual({ linked: true, reason: 'user_has_access' })
            // even when github did not answer the details call
            expect(
                canClaimInstallation({ userId: 'me', details: null, userHasAccess: true })
            ).toEqual({ linked: true, reason: 'user_has_access' })
        })

        it("never takes another user's install, even with access proof", () => {
            expect(
                canClaimInstallation({
                    existingUserId: 'someone-else',
                    userId: 'me',
                    details: null,
                    userHasAccess: true,
                })
            ).toEqual({ linked: false, reason: 'owned_by_other_user' })
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

    describe('toLocalCallbackUrl', () => {
        it('prod sends a localhost install on to the local callback, state unchanged', () => {
            const state = 'user-1|http://localhost:3000/pull-requests?x=1'
            const url = toLocalCallbackUrl({
                returnUrl: 'http://localhost:3000/pull-requests?x=1',
                installationId: '123',
                setupAction: 'install',
                state,
                isProduction: true,
            })
            const parsed = new URL(url!)
            expect(parsed.origin).toBe('http://localhost:3000')
            expect(parsed.pathname).toBe('/api/v1/githubapp/callback')
            expect(parsed.searchParams.get('installation_id')).toBe('123')
            expect(parsed.searchParams.get('setup_action')).toBe('install')
            expect(parsed.searchParams.get('state')).toBe(state)
        })

        it('only for localhost, and never on a local server', () => {
            const base = { installationId: '1', isProduction: true }
            expect(
                toLocalCallbackUrl({ ...base, returnUrl: 'https://app.trydecember.com/x' })
            ).toBeNull()
            expect(toLocalCallbackUrl({ ...base, returnUrl: 'https://evil.com/x' })).toBeNull()
            expect(toLocalCallbackUrl({ ...base, returnUrl: '/settings/repositories' })).toBeNull()
            expect(
                toLocalCallbackUrl({ ...base, returnUrl: 'http://localhost.evil.com/x' })
            ).toBeNull()
            expect(
                toLocalCallbackUrl({
                    ...base,
                    returnUrl: 'http://localhost:3000/x',
                    isProduction: false,
                })
            ).toBeNull()
            expect(toLocalCallbackUrl({ ...base, returnUrl: 'http://127.0.0.1:3000/x' })).toContain(
                'http://127.0.0.1:3000/api/v1/githubapp/callback'
            )
        })
    })

    describe('install problems in the return url', () => {
        it('names why an install did not link, and nothing when it did', () => {
            expect(toInstallProblem({ linked: true, reason: 'account_matches' })).toBeNull()
            expect(toInstallProblem({ linked: false, reason: 'owned_by_other_user' })).toBe(
                'in_use'
            )
            expect(toInstallProblem({ linked: false, reason: 'stale_unclaimed' })).toBe(
                'unverified'
            )
        })

        it('keeps the query and hash of the return url', () => {
            expect(withInstallProblem('https://app.trydecember.com/a?x=1#h', 'in_use')).toBe(
                'https://app.trydecember.com/a?x=1&github=in_use#h'
            )
            expect(withInstallProblem('https://app.trydecember.com/a', null)).toBe(
                'https://app.trydecember.com/a'
            )
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
            stubs: { user?: any; users?: Record<string, any>; existing?: any },
            run: (upserts: any[]) => Promise<void>
        ) => {
            const upserts: any[] = []
            const original = {
                findUserGithubId: githubAppRepository.findUserGithubId,
                findByInstallationId: githubAppRepository.findByInstallationId,
                upsertInstallation: githubAppRepository.upsertInstallation,
            }
            githubAppRepository.findUserGithubId = (async (id: string) =>
                stubs.users ? (stubs.users[id] ?? null) : (stubs.user ?? null)) as any
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

        it('a deleted account does not hold an installation', async () => {
            await withRepoStubs(
                {
                    users: {
                        me: { id: 'me', githubId: null, isDeleted: false },
                        gone: { id: 'gone', githubId: null, isDeleted: true },
                    },
                    existing: { installationId: '1', userId: 'gone' },
                },
                async () => {
                    const res = await githubAppService.claimInstallation({
                        installationId: '1',
                        userId: 'me',
                    })
                    // github cannot be asked in tests, so it needs proof, but it is not "in use"
                    expect(res.reason).not.toBe('owned_by_other_user')
                }
            )
        })

        it('clears the cached profile after it links', async () => {
            const cleared: string[] = []
            const originalDel = appCache.del
            appCache.del = (async (key: string) => {
                cleared.push(key)
            }) as any
            try {
                await withRepoStubs(
                    {
                        user: { id: 'me', githubId: '42', isDeleted: false },
                        existing: { installationId: '1', userId: 'me' },
                    },
                    async () => {
                        await githubAppService.claimInstallation({
                            installationId: '1',
                            userId: 'me',
                        })
                    }
                )
            } finally {
                appCache.del = originalDel
            }
            expect(cleared).toContain(appCache.key('setting', 'me', 'me'))
            expect(cleared).toContain(appCache.key('setting', 'profile', 'me'))
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
                const { repos, unavailable } = await githubAppService.getUserInstallationRepos({
                    userId: 'user-1',
                })
                expect(unavailable).toEqual([])
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

    describe('getUserInstallationRepos paging (B1, B12, V6)', () => {
        const repoPage = (start: number, count: number) =>
            Array.from({ length: count }, (_, i) => ({
                id: start + i,
                name: `repo-${start + i}`,
                full_name: `org/repo-${start + i}`,
                private: false,
                default_branch: 'main',
                updated_at: '2026-11-01T00:00:00Z',
                html_url: `https://github.com/org/repo-${start + i}`,
                clone_url: `https://github.com/org/repo-${start + i}.git`,
                owner: { login: 'org' },
            }))

        const withInstalls = async <T>(
            installs: { installationId: string; accountLogin?: string }[],
            onRepos: (url: string) => any,
            fn: () => Promise<T>
        ) => {
            const originalFindAll = githubAppRepository.findAllByUserId
            const originalFetch = globalThis.fetch
            githubAppRepository.findAllByUserId = (async () =>
                installs.map((install) => ({ ...install, userId: 'user-1' }))) as any
            globalThis.fetch = (async (url: string) => {
                if (url.includes('/access_tokens')) {
                    if (url.includes('gone'))
                        return { ok: false, status: 404, text: async () => '' }
                    return {
                        ok: true,
                        json: async () => ({ token: 'ghs', expires_at: '2099-01-01T00:00:00Z' }),
                    }
                }
                return onRepos(url)
            }) as any
            try {
                await appCache.clear()
                return await fn()
            } finally {
                githubAppRepository.findAllByUserId = originalFindAll
                globalThis.fetch = originalFetch
            }
        }

        it('reads every page of 100 when no page is asked for, and stops at 1,000', async () => {
            const asked: string[] = []
            const { repos } = await withInstalls(
                [{ installationId: 'inst-big', accountLogin: 'org' }],
                (url) => {
                    asked.push(url)
                    const page = Number(new URL(url).searchParams.get('page'))
                    return {
                        ok: true,
                        json: async () => ({ repositories: repoPage(page * 1000, 100) }),
                    }
                },
                () => githubAppService.getUserInstallationRepos({ userId: 'user-1' })
            )
            expect(asked.length).toBe(10)
            expect(asked[0]).toContain('per_page=100&page=1')
            expect(repos.length).toBe(1000)
        })

        it('reads one page when a page is asked for', async () => {
            const asked: string[] = []
            await withInstalls(
                [{ installationId: 'inst-big' }],
                (url) => {
                    asked.push(url)
                    return { ok: true, json: async () => ({ repositories: repoPage(1, 30) }) }
                },
                () =>
                    githubAppService.getUserInstallationRepos({
                        userId: 'user-1',
                        page: 2,
                        limit: 30,
                    })
            )
            expect(asked).toEqual([
                'https://api.github.com/installation/repositories?per_page=30&page=2',
            ])
        })

        it('names the installs that could not be read and keeps the others', async () => {
            const result = await withInstalls(
                [
                    { installationId: 'inst-ok', accountLogin: 'works' },
                    { installationId: 'gone', accountLogin: 'acme' },
                ],
                () => ({ ok: true, json: async () => ({ repositories: repoPage(1, 2) }) }),
                () => githubAppService.getUserInstallationRepos({ userId: 'user-1' })
            )
            expect(result.repos.length).toBe(2)
            expect(result.unavailable).toEqual(['acme'])
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
            // the installer's balance in cents; enough for a run unless a test says otherwise
            creditBalance?: number
            ownKeys?: { provider: string; defaultModel: string; models: unknown }[]
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
                secretLoads: 0,
            }
            const repo = githubAppRepository as any
            const saved = {
                findByInstallationId: repo.findByInstallationId,
                findPullRequestSettings: repo.findPullRequestSettings,
                findRunOwner: repo.findRunOwner,
                findOwnKeys: repo.findOwnKeys,
                setSessionGithubRun: repo.setSessionGithubRun,
                findGithubRuns: repo.findGithubRuns,
                findUserGithubUsername: repo.findUserGithubUsername,
                findSessionByPullRequest: repo.findSessionByPullRequest,
                createSession: sessionService.createSession,
                claimSessionRun: sessionService.claimSessionRun,
                releaseRun: sessionService.releaseRun,
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
                creditBalance: stubs.creditBalance ?? 10_000,
            })
            repo.findOwnKeys = async () => stubs.ownKeys ?? []
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
            // the new session is free: its run claims it (the run mark, not in this test)
            ;(sessionService as any).claimSessionRun = async () => 'run-1'
            ;(sessionService as any).releaseRun = async () => {}
            // one saved secret, so a run that loads them carries it
            ;(secretsService as any).getAllDecryptedSecrets = async () => {
                calls.secretLoads += 1
                return [{ key: 'API_TOKEN', value: 's3cret' }]
            }
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
                    findOwnKeys: saved.findOwnKeys,
                    setSessionGithubRun: saved.setSessionGithubRun,
                    findGithubRuns: saved.findGithubRuns,
                    findUserGithubUsername: saved.findUserGithubUsername,
                    findSessionByPullRequest: saved.findSessionByPullRequest,
                })
                ;(sessionService as any).createSession = saved.createSession
                ;(sessionService as any).claimSessionRun = saved.claimSessionRun
                ;(sessionService as any).releaseRun = saved.releaseRun
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
            expect(calls.jobs[0].data).toMatchObject({
                sessionId: 'session-1',
                userId: 'user-1',
                // the run claimed the session: the worker runs only this job on it
                runId: 'run-1',
            })
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

        // V1: the code and text of a fork are not trusted, so a review of it gets no secrets
        it('reviews a pull request from a fork with no secrets', async () => {
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
                () => githubAppService.handleIssueComment(onPullRequest('@trydecember review'))
            )
            expect(result.handled).toBe(true)
            expect(calls.githubRuns[0]).toMatchObject({ mode: 'review', fromFork: true })
            expect(calls.secretLoads).toBe(0)
            expect(calls.jobs[0].data.secrets).toEqual([])
        })

        it('a run on a pull request from the same repository gets the secrets', async () => {
            const { calls } = await withStubs({}, () =>
                githubAppService.handleIssueComment(onPullRequest('@trydecember review'))
            )
            expect(calls.githubRuns[0].fromFork).toBe(false)
            expect(calls.jobs[0].data.secrets).toEqual([{ key: 'API_TOKEN', value: 's3cret' }])
        })

        describe('the model source of a run', () => {
            const anthropicKey = { provider: 'anthropic', defaultModel: 'm-1', models: ['m-1'] }
            const groqKey = { provider: 'groq', defaultModel: 'g-1', models: ['g-1', 'g-2'] }
            // what a session start that fails was asked for
            const calls_: any[] = []
            const run = (stubs: Stubs) =>
                withStubs(stubs, () =>
                    githubAppService.handleIssueComment(comment('@trydecember fix this'))
                )

            it('runs on credits while the owner has credits, even with a saved key', async () => {
                const { calls } = await run({ creditBalance: 500, ownKeys: [anthropicKey] })
                expect(calls.sessions[0].billingSource).toBe('CREDITS')
                expect(calls.sessions[0].provider).toBeUndefined()
                expect(calls.sessions[0].model).toBeUndefined()
                expect(calls.jobs[0].data).toMatchObject({ billingSource: 'CREDITS' })
            })

            it('runs on credits at exactly the start balance', async () => {
                const { calls } = await run({ creditBalance: 50, ownKeys: [anthropicKey] })
                expect(calls.sessions[0].billingSource).toBe('CREDITS')
            })

            it('falls back to the key used last when the credits are gone', async () => {
                const { calls } = await run({ creditBalance: 0, ownKeys: [anthropicKey, groqKey] })
                expect(calls.sessions[0]).toMatchObject({
                    billingSource: 'OWN_KEY',
                    provider: 'anthropic',
                    model: 'm-1',
                })
                expect(calls.jobs[0].data).toMatchObject({
                    billingSource: 'OWN_KEY',
                    provider: 'anthropic',
                    model: 'm-1',
                })
            })

            it('falls back when the balance is under the start balance', async () => {
                const { calls } = await run({ creditBalance: 49, ownKeys: [groqKey] })
                expect(calls.sessions[0]).toMatchObject({ billingSource: 'OWN_KEY', model: 'g-1' })
            })

            it('skips a key whose default model is no longer in its list', async () => {
                const stale = { provider: 'openai', defaultModel: 'gone', models: ['other'] }
                const broken = { provider: 'xai', defaultModel: 'x', models: 'not a list' }
                const { calls } = await run({ creditBalance: 0, ownKeys: [stale, broken, groqKey] })
                expect(calls.sessions[0]).toMatchObject({
                    billingSource: 'OWN_KEY',
                    provider: 'groq',
                    model: 'g-1',
                })
            })

            it('with no credits and no key that can run, starts on credits and the 402 replies with the billing link', async () => {
                const stale = { provider: 'openai', defaultModel: 'gone', models: [] }
                const { result, calls } = await run({
                    creditBalance: 0,
                    ownKeys: [stale],
                    createSession: async (data: any) => {
                        calls_.push(data)
                        throw new AppError('Insufficient balance.', 402)
                    },
                })
                expect(calls_[0].billingSource).toBe('CREDITS')
                expect(result.reason).toBe('session_402')
                expect(calls.comments.at(-1)).toContain('/settings/billing')
                expect(calls.jobs).toEqual([])
            })
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
                    authorAssociation: 'OWNER',
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
                        settings: { autoReview: 'all' },
                        runs: [{ githubRun: { mode: 'review', headSha: 'abc123' } }],
                    },
                    () => githubAppService.handlePullRequestEvent(event('ready_for_review'))
                )
                expect(result.reason).toBe('already_reviewed')
            })

            it('"all" reviews a pull request by a member or collaborator, with the secrets', async () => {
                for (const authorAssociation of ['OWNER', 'MEMBER', 'COLLABORATOR']) {
                    const { result, calls } = await withStubs(
                        { settings: { autoReview: 'all' } },
                        () =>
                            githubAppService.handlePullRequestEvent(
                                event('opened', {
                                    user: { login: 'teammate' },
                                    authorAssociation,
                                    head: {
                                        ref: 'feat/sessions',
                                        sha: 'abc123',
                                        repoFullName: 'org/test-repo',
                                    },
                                })
                            )
                    )
                    expect({ authorAssociation, handled: result.handled }).toEqual({
                        authorAssociation,
                        handled: true,
                    })
                    expect(calls.githubRuns[0].fromFork).toBe(false)
                    expect(calls.jobs[0].data.secrets).toEqual([
                        { key: 'API_TOKEN', value: 's3cret' },
                    ])
                }
            })

            // V1: a stranger cannot start runs on the owner's account
            it('"all" never reviews a pull request by someone outside the repository', async () => {
                for (const authorAssociation of [
                    'NONE',
                    'CONTRIBUTOR',
                    'FIRST_TIMER',
                    'FIRST_TIME_CONTRIBUTOR',
                    'MANNEQUIN',
                    undefined,
                    null,
                ]) {
                    const { result, calls } = await withStubs(
                        { settings: { autoReview: 'all' } },
                        () =>
                            githubAppService.handlePullRequestEvent(
                                event('opened', {
                                    user: { login: 'stranger' },
                                    authorAssociation,
                                    head: {
                                        ref: 'main',
                                        sha: 'evil1',
                                        repoFullName: 'stranger/test-repo',
                                    },
                                })
                            )
                    )
                    expect({ authorAssociation, reason: result.reason }).toEqual({
                        authorAssociation,
                        reason: 'not_wanted',
                    })
                    expect(calls.sessions).toEqual([])
                    expect(calls.secretLoads).toBe(0)
                }
            })

            it('"my PRs" needs the owner to be the author', async () => {
                const { result } = await withStubs({ settings: { autoReview: 'mine' } }, () =>
                    githubAppService.handlePullRequestEvent(
                        event('opened', {
                            user: { login: 'teammate' },
                            authorAssociation: 'MEMBER',
                        })
                    )
                )
                expect(result.reason).toBe('not_wanted')
            })

            it('a new push never starts an automatic review, even on "all"', async () => {
                const { result, calls } = await withStubs({ settings: { autoReview: 'all' } }, () =>
                    githubAppService.handlePullRequestEvent(event('synchronize'))
                )
                expect(result.reason).toBe('not_wanted')
                expect(calls.sessions).toEqual([])
            })

            it('a member pull request from a fork is reviewed with no secrets', async () => {
                const { result, calls } = await withStubs({ settings: { autoReview: 'all' } }, () =>
                    githubAppService.handlePullRequestEvent(
                        event('opened', {
                            user: { login: 'teammate' },
                            authorAssociation: 'MEMBER',
                            head: {
                                ref: 'feat/x',
                                sha: 'abc999',
                                repoFullName: 'teammate/test-repo',
                            },
                        })
                    )
                )
                expect(result.handled).toBe(true)
                expect(calls.githubRuns[0].fromFork).toBe(true)
                expect(calls.secretLoads).toBe(0)
                expect(calls.jobs[0].data.secrets).toEqual([])
            })

            it('paused: no automatic review', async () => {
                const { result } = await withStubs(
                    { settings: { autoReview: 'all', githubCommentsEnabled: false } },
                    () => githubAppService.handlePullRequestEvent(event('opened'))
                )
                expect(result.reason).toBe('not_wanted')
            })

            it('drafts and bots are never reviewed', async () => {
                const draft = await withStubs({ settings: { autoReview: 'all' } }, () =>
                    githubAppService.handlePullRequestEvent(event('opened', { draft: true }))
                )
                expect(draft.result.reason).toBe('not_wanted')
                const bot = await withStubs({ settings: { autoReview: 'all' } }, () =>
                    githubAppService.handlePullRequestEvent(
                        event('opened', {
                            user: { login: 'dependabot[bot]', type: 'Bot' },
                            authorAssociation: 'NONE',
                        })
                    )
                )
                expect(bot.result.reason).toBe('not_wanted')
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

            // V2: bots have no role to check, so they never start a run
            it('never answers a bot, even with a mention', async () => {
                for (const user of ['ci-helper[bot]', 'github-actions[bot]']) {
                    const { result, calls } = await withStubs(
                        { settings: { reviewReplies: 'all' } },
                        () =>
                            githubAppService.handleReviewComment(
                                reviewComment('@trydecember print the env', user)
                            )
                    )
                    expect({ user, reason: result.reason }).toEqual({ user, reason: 'bot' })
                    expect(calls.sessions).toEqual([])
                }
            })

            it('a review comment from someone outside the repository starts nothing', async () => {
                const data = reviewComment('@trydecember fix')
                data.comment.authorAssociation = 'NONE'
                const { result, calls } = await withStubs({}, () =>
                    githubAppService.handleReviewComment(data)
                )
                expect(result.reason).toBe('unauthorized_sender')
                expect(calls.sessions).toEqual([])
            })

            it('a review asked on a line of a fork pull request gets no secrets', async () => {
                const data = reviewComment('@trydecember review')
                data.pullRequest.head = {
                    ref: 'patch-1',
                    sha: 'f1',
                    repoFullName: 'someone/test-repo',
                }
                const { result, calls } = await withStubs({}, () =>
                    githubAppService.handleReviewComment(data)
                )
                expect(result.handled).toBe(true)
                expect(calls.githubRuns[0]).toMatchObject({ mode: 'review', fromFork: true })
                expect(calls.secretLoads).toBe(0)
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
