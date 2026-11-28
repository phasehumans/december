import crypto from 'crypto'

import { prisma } from '@december/database'
import { describe, it, expect, beforeAll, afterAll } from 'bun:test'
import request from 'supertest'

import app from '../../src/app'
import { env } from '../../src/env'
import { sessionService } from '../../src/modules/session/session.service'
import { cleanupTestUser, getRandomIP } from '../helpers'

describe('GitHubApp Module Integration Tests', () => {
    let testUserId: string
    let testEmail: string
    let accessToken: string

    beforeAll(async () => {
        const timestamp = Date.now()
        testEmail = `ghapp-${timestamp}@example.com`

        const user = await prisma.user.create({
            data: {
                name: 'GitHub App Test User',
                email: testEmail,
                emailVerified: true,
            },
        })
        testUserId = user.id

        const { generateAccessToken } = await import('../../src/modules/auth/auth.utils')
        const session = await prisma.authSession.create({
            data: {
                userId: testUserId,
                refreshTokenHash: `ghapp-hash-${timestamp}`,
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            },
        })

        accessToken = generateAccessToken({ userId: testUserId, sessionId: session.id })
    })

    afterAll(async () => {
        if (testUserId) {
            await prisma.githubAppInstallation
                .deleteMany({
                    where: {
                        OR: [
                            { userId: testUserId },
                            {
                                installationId: {
                                    in: ['88888', '98765', '98766', '98767', '77777'],
                                },
                            },
                        ],
                    },
                })
                .catch(() => {
                    // Intentionally swallowed: test cleanup fallback
                })
            await prisma.authSession.deleteMany({ where: { userId: testUserId } }).catch(() => {
                // Intentionally swallowed: test cleanup fallback
            })
            await cleanupTestUser({ id: testUserId })
        }
    })

    it('1. GET /api/v1/githubapp/install-start - unauthorized without token (401)', async () => {
        const res = await request(app)
            .get('/api/v1/githubapp/install-start')
            .set('x-forwarded-for', getRandomIP())

        expect(res.status).toBe(401)
    })

    it('2. GET /api/v1/githubapp/install-start - redirects to GitHub app installation URL (302)', async () => {
        const res = await request(app)
            .get('/api/v1/githubapp/install-start')
            .set('x-forwarded-for', getRandomIP())
            .set('Authorization', `Bearer ${accessToken}`)

        expect(res.status).toBe(302)
        expect(res.headers.location).toContain('https://github.com/apps/')
        expect(res.headers.location).toContain('/installations/new')
    })

    it('3. POST /api/v1/githubapp/webhook - rejects request with missing signature (401)', async () => {
        const payload = JSON.stringify({ action: 'created', installation: { id: 9999 } })
        const res = await request(app)
            .post('/api/v1/githubapp/webhook')
            .set('Content-Type', 'application/json')
            .send(payload)

        expect(res.status).toBe(401)
    })

    it('4. POST /api/v1/githubapp/webhook - rejects request with invalid signature (401)', async () => {
        const payload = JSON.stringify({ action: 'created', installation: { id: 9999 } })
        const res = await request(app)
            .post('/api/v1/githubapp/webhook')
            .set('Content-Type', 'application/json')
            .set(
                'x-hub-signature-256',
                'sha256=invalid0000000000000000000000000000000000000000000000000000000000'
            )
            .send(payload)

        expect(res.status).toBe(401)
    })

    it('5. POST /api/v1/githubapp/webhook - processes installation created event (200)', async () => {
        const { githubAppService } = await import('../../src/modules/githubapp/githubapp.service')
        let processInstallCalledWith: any = null
        const originalProcess = githubAppService.processInstallation
        githubAppService.processInstallation = (async (data: any) => {
            processInstallCalledWith = data
            return {} as any
        }) as any

        try {
            const payloadObj = {
                action: 'created',
                installation: { id: 88888 },
            }
            const payloadStr = JSON.stringify(payloadObj)

            const secret = env.GITHUB_APP_WEBHOOK_SECRET || 'secret'
            const hmac = crypto.createHmac('sha256', secret)
            hmac.update(payloadStr)
            const signature = `sha256=${hmac.digest('hex')}`

            const res = await request(app)
                .post('/api/v1/githubapp/webhook')
                .set('Content-Type', 'application/json')
                .set('x-hub-signature-256', signature)
                .set('x-github-event', 'installation')
                .send(payloadStr)

            expect(res.status).toBe(200)
            expect(res.body.success).toBe(true)
            expect(processInstallCalledWith).toEqual({ installationId: '88888', userId: null })
        } finally {
            githubAppService.processInstallation = originalProcess
        }
    })

    it('5b. POST /api/v1/githubapp/webhook - creates installation with null userId in db without FK error when user is unmatched (200)', async () => {
        const payloadObj = {
            action: 'created',
            installation: {
                id: 77777,
                account: {
                    login: 'unclaimed-org-or-user',
                    type: 'User',
                },
                target_type: 'User',
                permissions: { issues: 'write' },
            },
            sender: {
                login: 'unclaimed-sender',
            },
        }
        const payloadStr = JSON.stringify(payloadObj)

        const secret = env.GITHUB_APP_WEBHOOK_SECRET || 'secret'
        const hmac = crypto.createHmac('sha256', secret)
        hmac.update(payloadStr)
        const signature = `sha256=${hmac.digest('hex')}`

        const res = await request(app)
            .post('/api/v1/githubapp/webhook')
            .set('Content-Type', 'application/json')
            .set('x-hub-signature-256', signature)
            .set('x-github-event', 'installation')
            .send(payloadStr)

        expect(res.status).toBe(200)
        expect(res.body.success).toBe(true)

        const createdInstallation = await prisma.githubAppInstallation.findUnique({
            where: { installationId: '77777' },
        })
        expect(createdInstallation).toBeDefined()
        expect(createdInstallation?.userId).toBeNull()
        expect(createdInstallation?.accountLogin).toBe('unclaimed-org-or-user')
    })

    it('5c. POST /api/v1/githubapp/webhook - never links an installation to a deleted account (200)', async () => {
        const githubId = `deleted-gh-${Date.now()}`
        const deletedUser = await prisma.user.create({
            data: {
                name: 'Deleted GitHub user',
                email: `ghapp-deleted-${Date.now()}@example.com`,
                emailVerified: true,
                githubId,
                isDeleted: true,
            },
        })

        try {
            const payloadStr = JSON.stringify({
                action: 'created',
                installation: {
                    id: 77778,
                    account: { login: 'deleted-user-login', type: 'User', id: githubId },
                    target_type: 'User',
                    permissions: { issues: 'write' },
                },
                sender: { login: 'deleted-user-login', id: githubId },
            })
            const hmac = crypto.createHmac('sha256', env.GITHUB_APP_WEBHOOK_SECRET || 'secret')
            hmac.update(payloadStr)

            const res = await request(app)
                .post('/api/v1/githubapp/webhook')
                .set('Content-Type', 'application/json')
                .set('x-hub-signature-256', `sha256=${hmac.digest('hex')}`)
                .set('x-github-event', 'installation')
                .send(payloadStr)

            expect(res.status).toBe(200)
            const installation = await prisma.githubAppInstallation.findUnique({
                where: { installationId: '77778' },
            })
            expect(installation?.userId).toBeNull()
            const stillDeleted = await prisma.user.findUnique({ where: { id: deletedUser.id } })
            expect(stillDeleted?.githubAppInstall).toBeFalsy()
        } finally {
            await prisma.githubAppInstallation
                .deleteMany({ where: { installationId: '77778' } })
                .catch(() => {
                    // Intentionally swallowed: test cleanup fallback
                })
            await cleanupTestUser({ id: deletedUser.id })
        }
    })

    it('6. POST /api/v1/githubapp/webhook - processes installation deleted event (200)', async () => {
        const { githubAppService } = await import('../../src/modules/githubapp/githubapp.service')
        let processUninstallCalledWith: any = null
        const originalUninstall = githubAppService.processUninstallation
        githubAppService.processUninstallation = (async (data: any) => {
            processUninstallCalledWith = data
            return {} as any
        }) as any

        try {
            const payloadObj = {
                action: 'deleted',
                installation: { id: 88888 },
            }
            const payloadStr = JSON.stringify(payloadObj)

            const secret = env.GITHUB_APP_WEBHOOK_SECRET || 'secret'
            const hmac = crypto.createHmac('sha256', secret)
            hmac.update(payloadStr)
            const signature = `sha256=${hmac.digest('hex')}`

            const res = await request(app)
                .post('/api/v1/githubapp/webhook')
                .set('Content-Type', 'application/json')
                .set('x-hub-signature-256', signature)
                .set('x-github-event', 'installation')
                .send(payloadStr)

            expect(res.status).toBe(200)
            expect(res.body.success).toBe(true)
            expect(processUninstallCalledWith).toEqual({ installationId: '88888' })
        } finally {
            githubAppService.processUninstallation = originalUninstall
        }
    })

    const signedWebhook = (event: string, payloadObj: unknown) => {
        const payloadStr = JSON.stringify(payloadObj)
        const secret = env.GITHUB_APP_WEBHOOK_SECRET || 'secret'
        const hmac = crypto.createHmac('sha256', secret)
        hmac.update(payloadStr)
        return request(app)
            .post('/api/v1/githubapp/webhook')
            .set('Content-Type', 'application/json')
            .set('x-hub-signature-256', `sha256=${hmac.digest('hex')}`)
            .set('x-github-event', event)
            .send(payloadStr)
    }

    const webhookRepository = {
        name: 'my-repo',
        full_name: 'test-org/my-repo',
        owner: { login: 'test-org' },
        default_branch: 'main',
    }

    it('6b. POST /api/v1/githubapp/webhook - routes pull_request events to the automatic review (200)', async () => {
        const { githubAppService } = await import('../../src/modules/githubapp/githubapp.service')
        const calls: any[] = []
        const original = githubAppService.handlePullRequestEvent
        githubAppService.handlePullRequestEvent = (async (data: any) => {
            calls.push(data)
            return { handled: false, reason: 'not_wanted' }
        }) as any

        try {
            for (const action of ['opened', 'synchronize', 'closed']) {
                const res = await signedWebhook('pull_request', {
                    action,
                    installation: { id: 99999 },
                    repository: webhookRepository,
                    pull_request: {
                        number: 123,
                        title: 'test pr',
                        body: 'adds a thing',
                        draft: false,
                        head: {
                            ref: 'feat/test',
                            sha: '111222',
                            repo: { full_name: 'test-org/my-repo' },
                        },
                        base: { ref: 'main' },
                        user: { login: 'tester', id: 44 },
                    },
                })
                expect(res.status).toBe(200)
            }
            // closed is not a review event
            expect(calls.map((c) => c.action)).toEqual(['opened', 'synchronize'])
            expect(calls[0]).toMatchObject({
                installationId: '99999',
                pullRequest: {
                    number: 123,
                    head: { ref: 'feat/test', sha: '111222', repoFullName: 'test-org/my-repo' },
                },
            })
        } finally {
            githubAppService.handlePullRequestEvent = original
        }
    })

    it('6c. POST /api/v1/githubapp/webhook - routes review comments and failed check suites (200)', async () => {
        const { githubAppService } = await import('../../src/modules/githubapp/githubapp.service')
        const reviewComments: any[] = []
        const suites: any[] = []
        const originalComment = githubAppService.handleReviewComment
        const originalSuite = githubAppService.handleCheckSuite
        githubAppService.handleReviewComment = (async (data: any) => {
            reviewComments.push(data)
            return { handled: false }
        }) as any
        githubAppService.handleCheckSuite = (async (data: any) => {
            suites.push(data)
            return { handled: false }
        }) as any

        try {
            await signedWebhook('pull_request_review_comment', {
                action: 'created',
                installation: { id: 99999 },
                repository: webhookRepository,
                pull_request: {
                    number: 5,
                    title: 'pr',
                    user: { login: 'trydecember[bot]' },
                    head: { ref: 'december/issue-1', sha: 'aa' },
                    base: { ref: 'main' },
                },
                comment: {
                    id: 77,
                    body: '@trydecember use a const',
                    path: 'src/a.ts',
                    line: 3,
                    diff_hunk: '@@',
                    user: { login: 'tester' },
                    author_association: 'MEMBER',
                },
            })
            await signedWebhook('check_suite', {
                action: 'completed',
                installation: { id: 99999 },
                repository: webhookRepository,
                check_suite: {
                    conclusion: 'failure',
                    head_sha: 'bb',
                    pull_requests: [{ number: 5 }],
                },
            })

            expect(reviewComments[0]).toMatchObject({
                comment: { id: 77, path: 'src/a.ts', line: 3, authorAssociation: 'MEMBER' },
                pullRequest: { number: 5, authorLogin: 'trydecember[bot]' },
            })
            expect(suites[0]).toMatchObject({
                conclusion: 'failure',
                headSha: 'bb',
                pullRequestNumbers: [5],
            })
        } finally {
            githubAppService.handleReviewComment = originalComment
            githubAppService.handleCheckSuite = originalSuite
        }
    })

    it('6d. POST /api/v1/githubapp/webhook - an @trydecember issue comment becomes a session with a github run (200)', async () => {
        const { setAgentQueue } = await import('@december/shared/queue')
        const jobs: { name: string; data: any }[] = []
        const posted: string[] = []
        const originalFetch = globalThis.fetch

        await prisma.user.update({ where: { id: testUserId }, data: { creditBalance: 500 } })
        await prisma.githubAppInstallation.upsert({
            where: { installationId: '66666' },
            create: { installationId: '66666', userId: testUserId, accountLogin: 'test-org' },
            update: { userId: testUserId },
        })
        setAgentQueue({
            add: (async (name: string, data: any) => {
                jobs.push({ name, data })
                return { id: 'job-6d' }
            }) as any,
        } as any)
        globalThis.fetch = (async (url: string | URL | Request, options?: any) => {
            const href = url.toString()
            if (href.includes('/access_tokens')) {
                return new Response(JSON.stringify({ token: 'ghs_test', expires_at: 'x' }), {
                    status: 201,
                })
            }
            if (
                href.includes('/comments') &&
                options?.method === 'POST' &&
                !href.includes('/reactions')
            ) {
                posted.push(JSON.parse(options.body).body)
            }
            return new Response(JSON.stringify({ id: 1 }), { status: 201 })
        }) as any

        try {
            const res = await signedWebhook('issue_comment', {
                action: 'created',
                installation: { id: 66666 },
                repository: webhookRepository,
                issue: { number: 42, title: 'Login breaks', body: 'Steps to reproduce' },
                comment: {
                    id: 1234,
                    body: '@trydecember fix the redirect',
                    user: { login: 'tester', type: 'User' },
                    author_association: 'OWNER',
                },
            })
            expect(res.status).toBe(200)

            const session = await prisma.session.findFirst({
                where: { userId: testUserId, issueNumber: 42 },
                orderBy: { createdAt: 'desc' },
            })
            expect(session).not.toBeNull()
            expect(session!.title).toBe('#42 Login breaks')
            expect(session!.branch).toBe('main')
            expect(session!.githubRun).toMatchObject({
                mode: 'issue',
                installationId: '66666',
                repoFullName: 'test-org/my-repo',
                number: 42,
                requestedBy: 'tester',
            })
            expect(jobs[0]).toMatchObject({
                name: 'run_agent',
                data: { sessionId: session!.id, userId: testUserId, billingSource: 'CREDITS' },
            })
            expect(jobs[0].data.prompt).toContain('fix the redirect')
            // the run claimed the session: its id is the owner of the run mark
            expect(typeof jobs[0].data.runId).toBe('string')
            expect(await sessionService.claimSessionRun({ sessionId: session!.id })).toBe(null)
            await sessionService.releaseRun({
                sessionId: session!.id,
                runId: jobs[0].data.runId,
            })
            expect(posted.some((body) => body.includes(`/session/${session!.id}`))).toBe(true)
        } finally {
            setAgentQueue(null)
            globalThis.fetch = originalFetch
            await prisma.session.deleteMany({ where: { userId: testUserId } }).catch(() => {
                // Intentionally swallowed: test cleanup fallback
            })
            await prisma.githubAppInstallation
                .deleteMany({ where: { installationId: '66666' } })
                .catch(() => {
                    // Intentionally swallowed: test cleanup fallback
                })
        }
    })

    it('7. GET /api/v1/githubapp/callback - ignores the user id in state when signed out (302)', async () => {
        const state = encodeURIComponent(`${testUserId}|/profile/integrations`)
        const res = await request(app)
            .get(
                `/api/v1/githubapp/callback?installation_id=98765&setup_action=install&state=${state}`
            )
            .set('x-forwarded-for', getRandomIP())

        expect(res.status).toBe(302)
        expect(res.headers.location).toContain('/profile/integrations?github=signed_out')

        const installation = await prisma.githubAppInstallation.findUnique({
            where: { installationId: '98765' },
        })
        expect(installation).toBeNull()
    })

    it('7b. GET /api/v1/githubapp/callback - redirects to localhost origin when provided in returnUrl (302)', async () => {
        const state = encodeURIComponent(`${testUserId}|http://localhost:3000/settings/connections`)
        const res = await request(app)
            .get(
                `/api/v1/githubapp/callback?installation_id=98766&setup_action=install&state=${state}`
            )
            .set('x-forwarded-for', getRandomIP())

        expect(res.status).toBe(302)
        expect(res.headers.location).toBe(
            'http://localhost:3000/settings/connections?github=signed_out'
        )
    })

    it('7c. GET /api/v1/githubapp/callback - does not claim an unclaimed installation it cannot verify (302)', async () => {
        // installation 77777 was created by test 5b with userId: null; github details are
        // unavailable in tests, so ownership cannot be proven
        const res = await request(app)
            .get(
                '/api/v1/githubapp/callback?installation_id=77777&setup_action=install&state=%2Fsettings%2Frepositories'
            )
            .set('x-forwarded-for', getRandomIP())
            .set('Authorization', `Bearer ${accessToken}`)

        expect(res.status).toBe(302)
        expect(res.headers.location).toContain('/settings/repositories?github=unverified')

        const afterCallback = await prisma.githubAppInstallation.findUnique({
            where: { installationId: '77777' },
        })
        expect(afterCallback?.userId).toBeNull()
    })

    it("7d. GET /api/v1/githubapp/callback - never moves another user's installation (302)", async () => {
        const otherUser = await prisma.user.create({
            data: {
                name: 'Installation Owner',
                email: `ghapp-owner-${Date.now()}@example.com`,
                emailVerified: true,
            },
        })

        try {
            await prisma.githubAppInstallation.create({
                data: { installationId: '98767', userId: otherUser.id, accountLogin: 'victim' },
            })

            const res = await request(app)
                .get(
                    `/api/v1/githubapp/callback?installation_id=98767&setup_action=install&state=${encodeURIComponent(`${testUserId}|/settings/repositories`)}`
                )
                .set('x-forwarded-for', getRandomIP())
                .set('Authorization', `Bearer ${accessToken}`)

            expect(res.status).toBe(302)
            expect(res.headers.location).toContain('/settings/repositories?github=in_use')

            const installation = await prisma.githubAppInstallation.findUnique({
                where: { installationId: '98767' },
            })
            expect(installation?.userId).toBe(otherUser.id)
        } finally {
            await prisma.githubAppInstallation
                .deleteMany({ where: { installationId: '98767' } })
                .catch(() => {
                    // Intentionally swallowed: test cleanup fallback
                })
            await cleanupTestUser({ id: otherUser.id })
        }
    })

    it('7e. GET /api/v1/githubapp/callback - keeps an installation the signed-in user already owns (302)', async () => {
        await prisma.githubAppInstallation.create({
            data: { installationId: '98766', userId: testUserId, accountLogin: 'ghapp-test' },
        })

        const res = await request(app)
            .get(
                '/api/v1/githubapp/callback?installation_id=98766&setup_action=update&state=%2Fsettings%2Frepositories'
            )
            .set('x-forwarded-for', getRandomIP())
            .set('Authorization', `Bearer ${accessToken}`)

        expect(res.status).toBe(302)

        const installation = await prisma.githubAppInstallation.findUnique({
            where: { installationId: '98766' },
        })
        expect(installation?.userId).toBe(testUserId)

        expect(res.headers.location).not.toContain('github=')

        const user = await prisma.user.findUnique({ where: { id: testUserId } })
        expect(user?.githubAppInstall).toBe(true)
    })

    it('7f. GET /api/v1/githubapp/callback - an organisation install request says so (302)', async () => {
        const res = await request(app)
            .get('/api/v1/githubapp/callback?setup_action=request&state=%2Fpull-requests')
            .set('x-forwarded-for', getRandomIP())
            .set('Authorization', `Bearer ${accessToken}`)

        expect(res.status).toBe(302)
        expect(res.headers.location).toContain('/pull-requests?github=requested')
    })

    // V1: the code github sends with an install is the proof; github must list the install
    // for the user who authorized
    const withGithubUser = async <T>(
        installationIds: number[],
        fn: (calls: string[]) => Promise<T>
    ): Promise<T> => {
        const realFetch = globalThis.fetch
        const calls: string[] = []
        const json = (body: unknown) =>
            new Response(JSON.stringify(body), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            })
        globalThis.fetch = (async (input: any, init?: RequestInit) => {
            const url = String(input)
            if (url === 'https://github.com/login/oauth/access_token') {
                calls.push(url)
                const body = JSON.parse(String(init?.body ?? '{}'))
                return json(body.code === 'good-code' ? { access_token: 'ghu_user' } : {})
            }
            if (url === 'https://api.github.com/user') {
                calls.push(url)
                return json({ id: 4242001 })
            }
            if (url.startsWith('https://api.github.com/user/installations')) {
                calls.push(url)
                return json({ installations: installationIds.map((id) => ({ id })) })
            }
            return realFetch(input, init)
        }) as typeof fetch
        try {
            return await fn(calls)
        } finally {
            globalThis.fetch = realFetch
        }
    }

    it('7g. GET /api/v1/githubapp/callback - links a new install when github lists it for the user (302)', async () => {
        await prisma.githubAppInstallation.deleteMany({ where: { installationId: '66601' } })
        await prisma.user.update({ where: { id: testUserId }, data: { githubId: null } })
        try {
            const res = await withGithubUser([123, 66601], () =>
                request(app)
                    .get(
                        '/api/v1/githubapp/callback?installation_id=66601&setup_action=install&code=good-code&state=%2Fsettings%2Frepositories'
                    )
                    .set('x-forwarded-for', getRandomIP())
                    .set('Authorization', `Bearer ${accessToken}`)
            )

            expect(res.status).toBe(302)
            expect(res.headers.location).not.toContain('github=')
            const installation = await prisma.githubAppInstallation.findUnique({
                where: { installationId: '66601' },
            })
            expect(installation?.userId).toBe(testUserId)
            const user = await prisma.user.findUnique({ where: { id: testUserId } })
            expect(user?.githubId).toBe('4242001')
        } finally {
            await prisma.githubAppInstallation.deleteMany({ where: { installationId: '66601' } })
            await prisma.user.update({ where: { id: testUserId }, data: { githubId: null } })
        }
    })

    it('7h. GET /api/v1/githubapp/callback - refuses an install github does not list for the user (302)', async () => {
        await prisma.githubAppInstallation.deleteMany({ where: { installationId: '66602' } })
        const res = await withGithubUser([123], () =>
            request(app)
                .get(
                    '/api/v1/githubapp/callback?installation_id=66602&setup_action=install&code=good-code&state=%2Fsettings%2Frepositories'
                )
                .set('x-forwarded-for', getRandomIP())
                .set('Authorization', `Bearer ${accessToken}`)
        )

        expect(res.status).toBe(302)
        expect(res.headers.location).toContain('github=unverified')
        const installation = await prisma.githubAppInstallation.findUnique({
            where: { installationId: '66602' },
        })
        expect(installation).toBeNull()
    })

    it('7i. GET /api/v1/githubapp/callback - a bad code proves nothing (302)', async () => {
        const res = await withGithubUser([66603], () =>
            request(app)
                .get(
                    '/api/v1/githubapp/callback?installation_id=66603&setup_action=install&code=bad-code&state=%2Fsettings%2Frepositories'
                )
                .set('x-forwarded-for', getRandomIP())
                .set('Authorization', `Bearer ${accessToken}`)
        )

        expect(res.status).toBe(302)
        expect(res.headers.location).toContain('github=unverified')
        const installation = await prisma.githubAppInstallation.findUnique({
            where: { installationId: '66603' },
        })
        expect(installation).toBeNull()
    })

    it('8. GET /api/v1/githubapp/status - returns installation status for authenticated user (200)', async () => {
        const res = await request(app)
            .get('/api/v1/githubapp/status')
            .set('x-forwarded-for', getRandomIP())
            .set('Authorization', `Bearer ${accessToken}`)

        expect(res.status).toBe(200)
        expect(res.body.success).toBe(true)
        expect(res.body.data.installed).toBe(true)
        expect(res.body.data.installationId).toBe('98766')
    })
})
