import crypto from 'crypto'

import { prisma } from '@december/database'
import { describe, it, expect, beforeAll, afterAll } from 'bun:test'
import request from 'supertest'

import app from '../../src/app'
import { env } from '../../src/env'
import { cleanupTestUser, getRandomIP } from '../helpers'

describe('GitHubApp Module Integration Tests', () => {
    let testUserId: string
    let testEmail: string
    const testPassword = 'Password123!'
    let accessToken: string

    beforeAll(async () => {
        const timestamp = Date.now()
        testEmail = `ghapp-${timestamp}@example.com`

        const bcrypt = await import('bcrypt')
        const hashedPassword = await bcrypt.hash(testPassword, env.BCRYPT_SALT_ROUNDS)

        const user = await prisma.user.create({
            data: {
                name: 'GitHub App Test User',
                email: testEmail,
                password: hashedPassword,
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

    it('6b. POST /api/v1/githubapp/webhook - processes pull_request opened event (200)', async () => {
        const { githubAppService } = await import('../../src/modules/githubapp/githubapp.service')
        let handlePrOpenedCalledWith: any = null
        const originalHandlePr = githubAppService.handlePullRequestOpened
        githubAppService.handlePullRequestOpened = (async (data: any) => {
            handlePrOpenedCalledWith = data
            return { handled: true, pullRequestNumber: 123 }
        }) as any

        try {
            const payloadObj = {
                action: 'opened',
                installation: { id: 99999 },
                repository: {
                    name: 'my-repo',
                    full_name: 'test-org/my-repo',
                    owner: { login: 'test-org' },
                    default_branch: 'main',
                },
                pull_request: {
                    number: 123,
                    title: 'test pr',
                    body: '@trydecember review this pr',
                    head: { ref: 'feat/test', sha: '111222' },
                    base: { ref: 'main' },
                    user: { login: 'tester', id: 44 },
                    author_association: 'MEMBER',
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
                .set('x-github-event', 'pull_request')
                .send(payloadStr)

            expect(res.status).toBe(200)
            expect(res.body.success).toBe(true)
            expect(handlePrOpenedCalledWith.installationId).toBe('99999')
            expect(handlePrOpenedCalledWith.pullRequest.number).toBe(123)
            expect(handlePrOpenedCalledWith.pullRequest.body).toBe('@trydecember review this pr')
        } finally {
            githubAppService.handlePullRequestOpened = originalHandlePr
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
        expect(res.headers.location).toContain('/profile/integrations')

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
        expect(res.headers.location).toBe('http://localhost:3000/settings/connections')
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
        expect(res.headers.location).toContain('/settings/repositories')

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

        const user = await prisma.user.findUnique({ where: { id: testUserId } })
        expect(user?.githubAppInstall).toBe(true)
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
