import { prisma } from '@december/database'
import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import request from 'supertest'

import app from '../../src/app'
import { emailService } from '../../src/modules/email/email.service'
import { notificationService } from '../../src/modules/notification/notification.service'
import { cleanupTestUser, createSignedInUser, getRandomIP } from '../helpers'

// #630: admin view of who asked for super crew, and the launch-day send
describe('waitlist admin api', () => {
    const stamp = Date.now()
    const adminEmail = `wl-admin-${stamp}@example.com`
    const savedAdminEmails = process.env.ADMIN_EMAILS
    const savedSendMessage = emailService.sendMessageEmail
    const savedSendNotification = notificationService.sendNotificationToUser
    const extraIds: string[] = []
    const sent: Array<{ to: string; subject: string; body: string }> = []
    let failEmailTo: string | null = null

    let admin: { userId: string; token: string }
    let joined: { userId: string; token: string }
    let late: { userId: string; token: string }
    let onlySeen: { userId: string; token: string }

    const call = (token: string) => ({
        get: (path: string) =>
            request(app)
                .get(`/api/v1/waitlist${path}`)
                .set('x-forwarded-for', getRandomIP())
                .set('Authorization', `Bearer ${token}`),
        post: (path: string, body: object = {}) =>
            request(app)
                .post(`/api/v1/waitlist${path}`)
                .set('x-forwarded-for', getRandomIP())
                .set('Authorization', `Bearer ${token}`)
                .send(body),
    })

    const inboxOf = async (token: string) => {
        const res = await request(app)
            .get('/api/v1/notification')
            .set('x-forwarded-for', getRandomIP())
            .set('Authorization', `Bearer ${token}`)
        return res.body.data.notifications.map((n: { title: string; message: string }) => [
            n.title,
            n.message,
        ])
    }

    const launchBody = {
        subject: 'super crew is live',
        body: 'hi {name}, super crew is ready for you.',
        inboxMessage: 'Your crew is ready to start.',
    }

    beforeAll(async () => {
        process.env.ADMIN_EMAILS = adminEmail
        emailService.sendMessageEmail = (async (data: {
            to: string
            subject: string
            body: string
        }) => {
            if (data.to === failEmailTo) return null
            sent.push({ to: data.to, subject: data.subject, body: data.body })
            return { id: `job-${sent.length}` }
        }) as any

        admin = await createSignedInUser({ email: adminEmail })
        joined = await createSignedInUser({ email: `wl-joined-${stamp}@example.com` })
        late = await createSignedInUser({ email: `wl-late-${stamp}@example.com` })
        onlySeen = await createSignedInUser({ email: `wl-seen-${stamp}@example.com` })
        await prisma.user.update({ where: { id: joined.userId }, data: { name: 'Ada Lovelace' } })

        await call(joined.token).post('/super-crew/join')
        await call(onlySeen.token).post('/super-crew/seen')
    })

    afterAll(async () => {
        process.env.ADMIN_EMAILS = savedAdminEmails
        emailService.sendMessageEmail = savedSendMessage
        notificationService.sendNotificationToUser = savedSendNotification
        const ids = [admin.userId, joined.userId, late.userId, onlySeen.userId, ...extraIds]
        await prisma.adminAuditLog.deleteMany({ where: { adminUserId: admin.userId } })
        await prisma.notification.deleteMany({ where: { userId: { in: ids } } })
        await prisma.featureWaitlist.deleteMany({ where: { userId: { in: ids } } })
        for (const id of ids) {
            await cleanupTestUser({ id })
        }
    })

    it('only admins can see the list (403)', async () => {
        const res = await call(joined.token).get('/super-crew/admin')
        expect(res.status).toBe(403)
    })

    it('lists who joined, not people who only saw the popup', async () => {
        const res = await call(admin.token).get('/super-crew/admin')

        expect(res.status).toBe(200)
        const ours = res.body.data.items.filter((item: { userId: string }) =>
            [joined.userId, onlySeen.userId].includes(item.userId)
        )
        expect(ours).toEqual([
            {
                userId: joined.userId,
                name: 'Ada Lovelace',
                email: `wl-joined-${stamp}@example.com`,
                joinedAt: expect.any(String),
                notifiedAt: null,
            },
        ])
        expect(res.body.data.joinedCount).toBeGreaterThanOrEqual(1)
        expect(res.body.data.feature).toBe('super-crew')
    })

    it('only admins can launch (403)', async () => {
        const res = await call(joined.token).post('/super-crew/admin/launch', launchBody)
        expect(res.status).toBe(403)
        expect(sent).toHaveLength(0)
    })

    it('launch rejects an empty subject (400)', async () => {
        const res = await call(admin.token).post('/super-crew/admin/launch', {
            ...launchBody,
            subject: ' ',
        })
        expect(res.status).toBe(400)
    })

    it('launch emails and adds an inbox item for everyone on the list', async () => {
        const res = await call(admin.token).post('/super-crew/admin/launch', launchBody)

        expect(res.status).toBe(200)
        expect(res.body.data.sentCount).toBeGreaterThanOrEqual(1)
        expect(sent).toContainEqual({
            to: `wl-joined-${stamp}@example.com`,
            subject: 'super crew is live',
            body: 'hi ada, super crew is ready for you.',
        })
        expect(sent.map((s) => s.to)).not.toContain(`wl-seen-${stamp}@example.com`)

        const inbox = await inboxOf(joined.token)
        expect(inbox).toEqual([['super crew is live', 'Your crew is ready to start.']])

        const list = await call(admin.token).get('/super-crew/admin')
        const row = list.body.data.items.find(
            (item: { userId: string }) => item.userId === joined.userId
        )
        expect(row.notifiedAt).toEqual(expect.any(String))
        expect(
            await prisma.adminAuditLog.count({
                where: { adminUserId: admin.userId, action: 'waitlist.launch' },
            })
        ).toBe(1)
    })
    it('a second launch only reaches people who joined since, and retries failed emails', async () => {
        await call(late.token).post('/super-crew/join')
        failEmailTo = `wl-late-${stamp}@example.com`
        sent.length = 0

        const failed = await call(admin.token).post('/super-crew/admin/launch', launchBody)
        expect(failed.status).toBe(200)
        expect(failed.body.data.failedCount).toBeGreaterThanOrEqual(1)
        expect(sent.map((s) => s.to)).not.toContain(`wl-joined-${stamp}@example.com`)
        expect(await inboxOf(late.token)).toEqual([])

        failEmailTo = null
        const retried = await call(admin.token).post('/super-crew/admin/launch', launchBody)
        expect(retried.status).toBe(200)
        expect(sent.map((s) => s.to)).toContain(`wl-late-${stamp}@example.com`)
        expect(sent.map((s) => s.to)).not.toContain(`wl-joined-${stamp}@example.com`)
        expect(await inboxOf(late.token)).toHaveLength(1)
        expect(await inboxOf(joined.token)).toHaveLength(1)
    })

    it('a deleted account is not listed and gets nothing', async () => {
        await call(onlySeen.token).post('/super-crew/join')
        await prisma.user.update({ where: { id: onlySeen.userId }, data: { isDeleted: true } })
        sent.length = 0

        const res = await call(admin.token).post('/super-crew/admin/launch', launchBody)

        expect(res.status).toBe(200)
        expect(sent.map((s) => s.to)).not.toContain(`wl-seen-${stamp}@example.com`)
        const list = await call(admin.token).get('/super-crew/admin')
        expect(list.body.data.items.map((item: { userId: string }) => item.userId)).not.toContain(
            onlySeen.userId
        )
    })

    it('an inbox write that fails does not stop the launch', async () => {
        const other = await createSignedInUser({ email: `wl-other-${stamp}@example.com` })
        extraIds.push(other.userId)
        await call(other.token).post('/super-crew/join')
        notificationService.sendNotificationToUser = (async () => {
            throw new Error('db down')
        }) as any
        sent.length = 0

        const res = await call(admin.token).post('/super-crew/admin/launch', launchBody)
        notificationService.sendNotificationToUser = savedSendNotification

        expect(res.status).toBe(200)
        expect(sent.map((s) => s.to)).toContain(`wl-other-${stamp}@example.com`)
        expect(
            await prisma.adminAuditLog.count({
                where: { adminUserId: admin.userId, action: 'waitlist.launch' },
            })
        ).toBeGreaterThanOrEqual(4)
    })
})
