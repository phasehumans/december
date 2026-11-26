import { prisma } from '@december/database'
import { describe, it, expect, afterAll, beforeAll } from 'bun:test'
import request from 'supertest'

import app from '../../src/app'
import { notificationService } from '../../src/modules/notification/notification.service'
import { authCookieToken, cleanupTestUser, getRandomIP, signInWithEmailCode } from '../helpers'

describe('Notification Integration Tests', () => {
    const testEmail = `notiftest-${Date.now()}@example.com`
    let testUserId: string
    let accessToken: string
    let notif1Id: string
    let notif2Id: string

    beforeAll(async () => {
        const user = await prisma.user.create({
            data: {
                email: testEmail,
                name: 'Notif Test User',
                emailVerified: true,
            },
        })
        testUserId = user.id

        const loginRes = await signInWithEmailCode(app, testEmail)

        accessToken = authCookieToken(loginRes)

        // Seed notifications
        const n1 = await notificationService.sendNotificationToUser({
            userId: testUserId,
            title: 'Welcome Notification',
            message: 'First test notification message',
            type: 'INFO',
        })
        notif1Id = n1.id

        const n2 = await notificationService.sendNotificationToUser({
            userId: testUserId,
            title: 'System Update',
            message: 'Second test notification message',
            type: 'SUCCESS',
            link: '/settings',
        })
        notif2Id = n2.id
    })

    afterAll(async () => {
        if (testUserId) {
            await prisma.notification.deleteMany({ where: { userId: testUserId } })
            await cleanupTestUser({ id: testUserId })
        }
    })

    it('1. GET /api/v1/notification - unauthorized without token (401)', async () => {
        const res = await request(app)
            .get('/api/v1/notification')
            .set('x-forwarded-for', getRandomIP())

        expect(res.status).toBe(401)
    })

    it('2. GET /api/v1/notification - returns paginated notifications for user', async () => {
        const res = await request(app)
            .get('/api/v1/notification?page=1&limit=10')
            .set('x-forwarded-for', getRandomIP())
            .set('Authorization', `Bearer ${accessToken}`)

        expect(res.status).toBe(200)
        expect(res.body.data.notifications).toBeArray()
        expect(res.body.data.pagination).toBeDefined()
        expect(res.body.data.pagination.page).toBe(1)
        expect(res.body.data.pagination.limit).toBe(10)
        expect(res.body.data.notifications.length).toBeGreaterThanOrEqual(2)
        const ids = res.body.data.notifications.map((n: any) => n.id)
        expect(ids).toContain(notif1Id)
        expect(ids).toContain(notif2Id)
    })

    it('2b. GET /api/v1/notification/unread-count - returns unread count', async () => {
        const res = await request(app)
            .get('/api/v1/notification/unread-count')
            .set('x-forwarded-for', getRandomIP())
            .set('Authorization', `Bearer ${accessToken}`)

        expect(res.status).toBe(200)
        expect(res.body.data.count).toBeGreaterThanOrEqual(2)
    })

    it('3. GET /api/v1/notification/:id - fetches detail and auto-marks as read', async () => {
        const res = await request(app)
            .get(`/api/v1/notification/${notif1Id}`)
            .set('x-forwarded-for', getRandomIP())
            .set('Authorization', `Bearer ${accessToken}`)

        expect(res.status).toBe(200)
        expect(res.body.data.id).toBe(notif1Id)
        expect(res.body.data.isRead).toBe(true)

        // Verify DB update
        const dbNotif = await prisma.notification.findUnique({ where: { id: notif1Id } })
        expect(dbNotif?.isRead).toBe(true)
    })

    it('4. PATCH /api/v1/notification/:id/read - explicitly marks notification as read', async () => {
        const res = await request(app)
            .patch(`/api/v1/notification/${notif2Id}/read`)
            .set('x-forwarded-for', getRandomIP())
            .set('Authorization', `Bearer ${accessToken}`)

        expect(res.status).toBe(200)
        expect(res.body.data.isRead).toBe(true)
    })

    it('5. DELETE /api/v1/notification/:id - deletes individual notification', async () => {
        const res = await request(app)
            .delete(`/api/v1/notification/${notif1Id}`)
            .set('x-forwarded-for', getRandomIP())
            .set('Authorization', `Bearer ${accessToken}`)

        expect(res.status).toBe(200)

        // Verify deletion from DB
        const dbNotif = await prisma.notification.findUnique({ where: { id: notif1Id } })
        expect(dbNotif).toBeNull()
    })

    it('6. DELETE /api/v1/notification - deletes all read notifications', async () => {
        const res = await request(app)
            .delete('/api/v1/notification')
            .set('x-forwarded-for', getRandomIP())
            .set('Authorization', `Bearer ${accessToken}`)

        expect(res.status).toBe(200)

        // Verify remaining read notifications for user is 0
        const remainingRead = await prisma.notification.count({
            where: { userId: testUserId, isRead: true },
        })
        expect(remainingRead).toBe(0)
    })

    it('7. GET /api/v1/notification/:id - returns 404 for non-existent notification', async () => {
        const nonExistentId = '00000000-0000-0000-0000-000000000000'
        const res = await request(app)
            .get(`/api/v1/notification/${nonExistentId}`)
            .set('x-forwarded-for', getRandomIP())
            .set('Authorization', `Bearer ${accessToken}`)

        expect(res.status).toBe(404)
    })

    it('8. GET /api/v1/notification?category=MENTION - returns mentions only, with counts', async () => {
        const mention = await notificationService.sendNotificationToUser({
            userId: testUserId,
            title: 'maya-k commented on #482',
            message: 'Can we keep the old retry count?',
            category: 'MENTION',
            toast: true,
        })
        await notificationService.sendNotificationToUser({
            userId: testUserId,
            title: 'Checks failed on #482',
            message: 'typecheck failed',
            type: 'ERROR',
        })

        const list = await request(app)
            .get('/api/v1/notification?category=MENTION')
            .set('x-forwarded-for', getRandomIP())
            .set('Authorization', `Bearer ${accessToken}`)
        expect(list.status).toBe(200)
        const ids = list.body.data.notifications.map((n: any) => n.id)
        expect(ids).toEqual([mention.id])
        expect(list.body.data.notifications[0].category).toBe('MENTION')

        const count = await request(app)
            .get('/api/v1/notification/unread-count')
            .set('x-forwarded-for', getRandomIP())
            .set('Authorization', `Bearer ${accessToken}`)
        expect(count.status).toBe(200)
        expect(count.body.data.mentions).toBe(1)
        expect(count.body.data.count).toBeGreaterThanOrEqual(2)
    })

    it('9. PATCH /api/v1/notification/read-all - marks every notification read', async () => {
        const res = await request(app)
            .patch('/api/v1/notification/read-all')
            .set('x-forwarded-for', getRandomIP())
            .set('Authorization', `Bearer ${accessToken}`)
        expect(res.status).toBe(200)
        expect(res.body.data.updated).toBeGreaterThanOrEqual(2)

        const unread = await prisma.notification.count({
            where: { userId: testUserId, isRead: false },
        })
        expect(unread).toBe(0)
    })
})
