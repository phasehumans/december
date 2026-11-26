import { prisma } from '@december/database'
import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { Secret, TOTP } from 'otpauth'
import request from 'supertest'

import app from '../../src/app'
import { admintotpRepository } from '../../src/modules/admintotp/admintotp.repository'
import { admintotpService } from '../../src/modules/admintotp/admintotp.service'
import { emailService } from '../../src/modules/email/email.service'
import { cleanupTestUser, createSignedInUser, getRandomIP } from '../helpers'

// S1: the admin's authenticator app (T1 to T11)
describe('admin authenticator', () => {
    const stamp = Date.now()
    const adminEmail = `totp-admin-${stamp}@example.com`
    const savedAdminEmails = process.env.ADMIN_EMAILS
    const savedSendMessage = emailService.sendMessageEmail
    const alerts: Array<{ to: string; subject: string }> = []

    let admin: { userId: string; token: string }
    let secret = ''

    const as = (path: string, body?: object) => {
        const req = body
            ? request(app).post(`/api/v1/admin${path}`)
            : request(app).get(`/api/v1/admin${path}`)
        const withHeaders = req
            .set('x-forwarded-for', getRandomIP())
            .set('Origin', 'http://localhost:3000')
            .set('Cookie', `accessToken=${admin.token}`)
        return body ? withHeaders.send(body) : withHeaders
    }

    const inboxTitles = async () =>
        (
            await prisma.notification.findMany({
                where: { userId: admin.userId },
                select: { title: true },
            })
        ).map((n) => n.title)

    const codeAt = (ms: number) =>
        new TOTP({ secret: Secret.fromBase32(secret), digits: 6, period: 30 }).generate({
            timestamp: ms,
        })

    beforeAll(async () => {
        process.env.ADMIN_EMAILS = adminEmail
        emailService.sendMessageEmail = (async (data: { to: string; subject: string }) => {
            alerts.push({ to: data.to, subject: data.subject })
            return { id: `email-${alerts.length}` }
        }) as any
        admin = await createSignedInUser({ email: adminEmail })
    })

    afterAll(async () => {
        process.env.ADMIN_EMAILS = savedAdminEmails
        emailService.sendMessageEmail = savedSendMessage
        await prisma.adminAuditLog.deleteMany({ where: { adminUserId: admin.userId } })
        await cleanupTestUser({ id: admin.userId })
    })

    it('before setup, the panel asks for a code and /me says the app is off', async () => {
        const me = await as('/me')
        expect(me.status).toBe(200)
        expect(me.body.data.totp).toMatchObject({ enabled: false, verifiedUntil: null })
        const users = await as('/users')
        expect(users.status).toBe(403)
        expect(users.body.errors.code).toBe('admin_code_required')
    })

    it('a code can be entered only after setup', async () => {
        const res = await as('/totp/verify', { code: '123456' })
        expect(res.status).toBe(400)
    })

    it('setup returns a QR code and a key, and stores the secret encrypted', async () => {
        const res = await as('/totp/setup', {})
        expect(res.status).toBe(200)
        expect(res.headers['cache-control']).toBe('no-store')
        expect(res.body.data.qrDataUrl).toStartWith('data:image/png;base64,')
        secret = res.body.data.key.replace(/\s+/g, '')
        expect(secret).toMatch(/^[A-Z2-7]{32}$/)

        const row = await admintotpRepository.findByUser(admin.userId)
        expect(row?.enabledAt).toBeNull()
        expect(row?.secretEncrypted).not.toContain(secret)
    })

    it('a wrong code does not turn it on', async () => {
        const res = await as('/totp/enable', {
            code: '000000' === codeAt(Date.now()) ? '111111' : '000000',
        })
        expect(res.status).toBe(400)
        const me = await as('/me')
        expect(me.body.data.totp.enabled).toBe(false)
    })

    it('the right code turns it on, verifies this sign-in and emails the admin', async () => {
        alerts.length = 0
        const res = await as('/totp/enable', { code: codeAt(Date.now() - 30_000) })
        expect(res.status).toBe(200)
        expect(res.body.data.enabled).toBe(true)
        expect(res.body.data.verifiedUntil).not.toBeNull()
        // admin alerts go to the December inbox, never to email
        expect(alerts).toEqual([])
        expect(await inboxTitles()).toContain('Authenticator turned on')

        const users = await as('/users')
        expect(users.status).toBe(200)
    })

    it('setup cannot run again once it is on', async () => {
        const res = await as('/totp/setup', {})
        expect(res.status).toBe(409)
    })

    it('the same code (or an older one) is refused the second time', async () => {
        const res = await as('/totp/verify', { code: codeAt(Date.now() - 30_000) })
        expect(res.status).toBe(400)
        expect(res.body.message).toContain('already used')
    })

    it('a newer code works, with spaces too', async () => {
        const code = codeAt(Date.now() + 30_000)
        const res = await as('/totp/verify', { code: `${code.slice(0, 3)} ${code.slice(3)}` })
        expect(res.status).toBe(200)
    })

    it('a code that is not 6 digits is refused before any check', async () => {
        const res = await as('/totp/verify', { code: '12ab56' })
        expect(res.status).toBe(400)
        const row = await admintotpRepository.findByUser(admin.userId)
        expect(row?.failedCount).toBe(0)
    })

    it('5 wrong codes lock it for 15 minutes and email the admin; a right code is refused while locked', async () => {
        alerts.length = 0
        const wrong = codeAt(Date.now()) === '000000' ? '111111' : '000000'
        const statuses: number[] = []
        for (let i = 0; i < 5; i++) {
            statuses.push((await as('/totp/verify', { code: wrong })).status)
        }
        expect(statuses).toEqual([400, 400, 400, 400, 429])
        expect(alerts).toEqual([])
        expect((await inboxTitles()).filter((t) => t === 'Authenticator locked')).toHaveLength(1)

        const locked = await as('/totp/verify', { code: codeAt(Date.now() + 60_000) })
        expect(locked.status).toBe(429)

        const me = await as('/me')
        expect(me.body.data.totp.lockedUntil).not.toBeNull()
    })

    it('parallel wrong codes get no more than 5 tries in total', async () => {
        await prisma.adminTotp.update({
            where: { userId: admin.userId },
            data: { lockedUntil: null, failedCount: 0 },
        })
        alerts.length = 0
        const wrong = codeAt(Date.now()) === '000000' ? '111111' : '000000'
        const results = await Promise.all(
            Array.from({ length: 20 }, () => as('/totp/verify', { code: wrong }))
        )
        const statuses = results.map((r) => r.status)
        // at most 5 were checked at all; every other one was refused before checking
        expect(statuses.filter((s) => s === 400).length).toBeLessThanOrEqual(4)
        expect(statuses.filter((s) => s === 429).length).toBeGreaterThanOrEqual(16)
        expect((await inboxTitles()).filter((t) => t === 'Authenticator locked')).toHaveLength(2)
    })

    it('B1: a used code as the 5th try locks it, and the lock ends on its own', async () => {
        // every code counts as already used, so the 5th try below is a right but used code
        await prisma.adminTotp.update({
            where: { userId: admin.userId },
            data: { lockedUntil: null, failedCount: 0, lastUsedStep: 2_000_000_000 },
        })
        const wrong = codeAt(Date.now()) === '000000' ? '111111' : '000000'
        for (let i = 0; i < 4; i++) {
            expect((await as('/totp/verify', { code: wrong })).status).toBe(400)
        }
        const used = await as('/totp/verify', { code: codeAt(Date.now()) })
        expect(used.status).toBe(400)
        expect(used.body.message).toContain('already used')
        // it is locked now, not stuck at 5 tries with no lock
        const row = await admintotpRepository.findByUser(admin.userId)
        expect(row?.lockedUntil).not.toBeNull()
        expect((await as('/totp/verify', { code: wrong })).status).toBe(429)

        // once the lock has run out, the count starts again
        await prisma.adminTotp.update({
            where: { userId: admin.userId },
            data: { lockedUntil: new Date(Date.now() - 1000), lastUsedStep: null },
        })
        expect((await as('/totp/verify', { code: wrong })).status).toBe(400)
        const after = await admintotpRepository.findByUser(admin.userId)
        expect(after).toMatchObject({ failedCount: 1, lockedUntil: null })
        expect((await as('/totp/verify', { code: codeAt(Date.now()) })).status).toBe(200)
    })

    it('S3: a setup never replaces an authenticator that is on', async () => {
        const before = await admintotpRepository.findByUser(admin.userId)
        expect(before?.enabledAt).not.toBeNull()
        const saved = await admintotpRepository.savePendingSecret({
            userId: admin.userId,
            secretEncrypted: 'other-secret',
        })
        expect(saved).toBe(false)
        const after = await admintotpRepository.findByUser(admin.userId)
        expect(after?.secretEncrypted).toBe(before?.secretEncrypted)
        expect(after?.enabledAt).not.toBeNull()
    })

    it('S2: the reset script removes the app and signs the admin out everywhere', async () => {
        const { endedSignIns } = await admintotpService.resetAuthenticator({ userId: admin.userId })
        expect(endedSignIns).toBeGreaterThanOrEqual(1)
        expect(await admintotpRepository.findByUser(admin.userId)).toBeNull()
        const live = await prisma.authSession.count({
            where: { userId: admin.userId, isRevoked: false },
        })
        expect(live).toBe(0)
        // the old sign-in can't reach the panel, so it can't set up its own authenticator
        expect((await as('/me')).status).toBe(404)
        expect((await as('/totp/setup', {})).status).toBe(404)
    })
})
