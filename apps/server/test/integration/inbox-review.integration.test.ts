import crypto from 'crypto'

import { prisma } from '@december/database'
import bcrypt from 'bcrypt'
import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import request from 'supertest'

import app from '../../src/app'
import { env } from '../../src/env'
import { describeUserAgent } from '../../src/modules/auth/auth.utils'
import { emailService } from '../../src/modules/email/email.service'
import { githubAppService } from '../../src/modules/githubapp/githubapp.service'
import { integrationsService } from '../../src/modules/integration/integration.service'
import { sessionService } from '../../src/modules/session/session.service'
import { cleanupTestUser, createSignedInUser, getRandomIP } from '../helpers'

const CHROME_LINUX =
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36'
const FIREFOX_WINDOWS =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0'
const CODE = '135790'

// the inbox review (rounds 2 and 3): what goes to the inbox now, and what no longer mails
describe('inbox review: inbox items and no extra mail', () => {
    const stamp = Date.now()
    const userIds: string[] = []
    const savedSendMessage = emailService.sendMessageEmail
    const mails: Array<{ to: string; subject: string }> = []

    const titlesOf = async (userId: string) =>
        (
            await prisma.notification.findMany({
                where: { userId },
                orderBy: { createdAt: 'asc' },
            })
        ).map((row) => row.title)

    beforeAll(() => {
        emailService.sendMessageEmail = (async (data: { to: string; subject: string }) => {
            mails.push(data)
            return { id: `mail-${mails.length}` }
        }) as any
    })

    afterAll(async () => {
        emailService.sendMessageEmail = savedSendMessage
        await prisma.notification.deleteMany({ where: { userId: { in: userIds } } })
        await prisma.session.deleteMany({ where: { userId: { in: userIds } } })
        await prisma.githubAppInstallation.deleteMany({ where: { userId: { in: userIds } } })
        await prisma.gitConnection.deleteMany({ where: { userId: { in: userIds } } })
        await prisma.feedback.deleteMany({ where: { userId: { in: userIds } } })
        for (const id of userIds) {
            await cleanupTestUser({ id })
        }
    })

    describe('sign-up and sign-in', () => {
        const email = `inbox-signin-${stamp}@example.com`

        const signIn = async (userAgent: string) => {
            const started = await request(app)
                .post('/api/v1/auth/email/start')
                .set('x-forwarded-for', getRandomIP())
                .send({ email })
            expect([200, 201, 429]).toContain(started.status)
            await prisma.user.update({
                where: { email },
                data: {
                    otpHash: await bcrypt.hash(CODE, env.BCRYPT_SALT_ROUNDS),
                    otpExpiresAt: new Date(Date.now() + 10 * 60 * 1000 - 31 * 1000),
                    otpAttempts: 0,
                },
            })
            const res = await request(app)
                .post('/api/v1/auth/email/verify')
                .set('x-forwarded-for', getRandomIP())
                .set('User-Agent', userAgent)
                .send({ email, otp: CODE })
            expect(res.status).toBe(200)
        }

        it('a new account gets a short welcome item and no welcome mail (E1-A)', async () => {
            await signIn(CHROME_LINUX)
            const user = await prisma.user.findUniqueOrThrow({ where: { email } })
            userIds.push(user.id)

            const rows = await prisma.notification.findMany({ where: { userId: user.id } })
            expect(rows.map((row) => [row.title, row.message])).toEqual([
                ['Welcome to December', 'Start a session from the home page.'],
            ])
            // the first sign-in of a new account is not a "new sign-in"
            expect('sendWelcomeEmail' in emailService).toBe(false)
            expect(mails.filter((mail) => mail.to === email)).toEqual([])
        })

        it('the same browser again: no new sign-in item', async () => {
            await signIn(CHROME_LINUX)
            const user = await prisma.user.findUniqueOrThrow({ where: { email } })
            expect(await titlesOf(user.id)).toEqual(['Welcome to December'])
        })

        it('another browser: "New sign-in" in the inbox, once for that browser (N3)', async () => {
            await signIn(FIREFOX_WINDOWS)
            await signIn(FIREFOX_WINDOWS)
            const user = await prisma.user.findUniqueOrThrow({ where: { email } })
            const label = describeUserAgent(FIREFOX_WINDOWS).label
            expect(label).toBe('Firefox on Windows')
            expect(await titlesOf(user.id)).toEqual([
                'Welcome to December',
                'New sign-in: Firefox on Windows',
            ])
            const item = await prisma.notification.findFirst({
                where: { userId: user.id, title: 'New sign-in: Firefox on Windows' },
            })
            expect(item).toMatchObject({ type: 'WARNING', link: '/settings/account' })
            expect(mails.filter((mail) => mail.to === email)).toEqual([])
        })
    })

    describe('GitHub', () => {
        let owner: { userId: string; token: string }

        beforeAll(async () => {
            owner = await createSignedInUser({ email: `inbox-gh-${stamp}@example.com` })
            userIds.push(owner.userId)
        })

        const signedWebhook = (event: string, payload: unknown) => {
            const body = JSON.stringify(payload)
            const secret = env.GITHUB_APP_WEBHOOK_SECRET || 'secret'
            const signature = crypto.createHmac('sha256', secret).update(body).digest('hex')
            return request(app)
                .post('/api/v1/githubapp/webhook')
                .set('Content-Type', 'application/json')
                .set('x-hub-signature-256', `sha256=${signature}`)
                .set('x-github-event', event)
                .send(body)
        }

        it('connecting GitHub puts nothing in the inbox (R1)', async () => {
            await integrationsService.connectGithub({
                userId: owner.userId,
                username: `octo-${stamp}`,
                accessToken: 'gho_test',
            } as any)
            expect(await titlesOf(owner.userId)).toEqual([])
        })

        it('a suspended app warns the owner and keeps the row; a removed app warns and goes (N4)', async () => {
            const installationId = `${stamp}`.slice(-9)
            await prisma.githubAppInstallation.create({
                data: { installationId, userId: owner.userId, accountLogin: 'octo-org' },
            })

            const suspended = await signedWebhook('installation', {
                action: 'suspend',
                installation: { id: Number(installationId) },
            })
            expect(suspended.status).toBe(200)
            expect(await prisma.githubAppInstallation.count({ where: { installationId } })).toBe(1)

            await githubAppService.processUninstallation({ installationId })
            expect(await prisma.githubAppInstallation.count({ where: { installationId } })).toBe(0)

            const rows = await prisma.notification.findMany({
                where: { userId: owner.userId },
                orderBy: { createdAt: 'asc' },
            })
            expect(rows.map((row) => row.title)).toEqual([
                'GitHub App suspended',
                'GitHub App removed',
            ])
            expect(rows[1]?.message).toContain('from octo-org')
            expect(rows[1]).toMatchObject({ type: 'WARNING', link: '/settings/connections' })
        })

        it('an installation nobody owns tells nobody', async () => {
            const installationId = `${stamp + 1}`.slice(-9)
            await prisma.githubAppInstallation.create({ data: { installationId } })
            const before = await prisma.notification.count()
            await githubAppService.processUninstallation({ installationId })
            expect(await prisma.notification.count()).toBe(before)
        })

        it('a merged or closed pull request is one item per user, only on a change (N2)', async () => {
            await prisma.notification.deleteMany({ where: { userId: owner.userId } })
            const repo = { githubRepoOwner: 'acme', githubRepoName: `inbox-${stamp}` }
            await prisma.session.create({
                data: { userId: owner.userId, ...repo, prNumber: 42, prState: 'open' },
            })
            // a second session of the same user on the same pull request
            await prisma.session.create({
                data: { userId: owner.userId, ...repo, prNumber: 42, prState: 'open' },
            })
            const event = (state: 'merged' | 'closed' | 'open', number = 42) =>
                sessionService.applyPullRequestEvent({
                    gitProvider: 'GITHUB',
                    repoOwner: 'acme',
                    repoName: `inbox-${stamp}`,
                    number,
                    state,
                    title: 'Add dark mode',
                })

            await event('open')
            expect(await titlesOf(owner.userId)).toEqual([])

            await event('merged')
            await event('merged')
            const rows = await prisma.notification.findMany({ where: { userId: owner.userId } })
            expect(rows.map((row) => row.title)).toEqual(['#42 merged'])
            expect(rows[0]?.message).toBe(`acme/inbox-${stamp}: Add dark mode`)
            expect(rows[0]?.type).toBe('SUCCESS')
            expect(rows[0]?.link?.startsWith('/sessions/')).toBe(true)

            await prisma.session.create({
                data: { userId: owner.userId, ...repo, prNumber: 43, prState: 'open' },
            })
            await event('closed', 43)
            expect(await titlesOf(owner.userId)).toEqual(['#42 merged', '#43 closed'])
        })
    })

    describe('GitLab', () => {
        it('a sign-in that cannot be renewed asks to reconnect, once while unread (N5)', async () => {
            const user = await createSignedInUser({ email: `inbox-gl-${stamp}@example.com` })
            userIds.push(user.userId)
            await prisma.gitConnection.create({
                data: {
                    userId: user.userId,
                    provider: 'GITLAB',
                    externalId: `gl-${stamp}`,
                    username: 'gl-user',
                    encryptedAccessToken: 'not-used',
                    encryptedRefreshToken: null,
                    expiresAt: new Date(Date.now() - 60_000),
                },
            })

            for (let i = 0; i < 2; i++) {
                await expect(
                    integrationsService.getGitlabAccessToken({ userId: user.userId } as any)
                ).rejects.toThrow('Connect it again')
            }
            const rows = await prisma.notification.findMany({ where: { userId: user.userId } })
            expect(rows.map((row) => row.title)).toEqual(['Reconnect GitLab'])
            expect(rows[0]).toMatchObject({ type: 'WARNING', link: '/settings/connections' })
        })
    })

    describe('admin inbox', () => {
        it('new feedback goes to the admins inbox, not to email (A2)', async () => {
            const admin = await createSignedInUser({ email: `inbox-admin-${stamp}@example.com` })
            const author = await createSignedInUser({ email: `inbox-fb-${stamp}@example.com` })
            userIds.push(admin.userId, author.userId)
            const saved = process.env.ADMIN_EMAILS
            process.env.ADMIN_EMAILS = `inbox-admin-${stamp}@example.com`
            try {
                const res = await request(app)
                    .post('/api/v1/setting/feedback')
                    .set('x-forwarded-for', getRandomIP())
                    .set('Authorization', `Bearer ${author.token}`)
                    .send({ rating: 'sad', feedback: 'The   inbox\nis noisy' })
                expect(res.status).toBe(200)
            } finally {
                process.env.ADMIN_EMAILS = saved
            }

            const rows = await prisma.notification.findMany({ where: { userId: admin.userId } })
            expect(rows.map((row) => [row.title, row.message])).toEqual([
                ['Feedback (sad)', `inbox-fb-${stamp}@example.com: The inbox is noisy`],
            ])
            // the author gets nothing, and nobody gets a mail
            expect(await titlesOf(author.userId)).toEqual([])
            expect(mails.filter((mail) => mail.to.includes(`${stamp}`))).toEqual([])
        })
    })
})
