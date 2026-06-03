import '../../../tests/env'

import bcrypt from 'bcrypt'
import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'bun:test'
import express from 'express'
import { Router } from 'express'
import request from 'supertest'

import { prisma } from '../../../src/config/db'
import { notificationController } from '../../../src/modules/notification/notification.controller'

const TEST_USER_ID = '864e432c-687f-4424-aa61-a831518f8e12'
const TEST_SESSION_ID = '864e432c-687f-4424-aa61-a831518f8e13'

const createTestUser = async (overrides: Record<string, unknown> = {}) => {
    return prisma.user.create({
        data: {
            id: TEST_USER_ID,
            email: `test-${crypto.randomUUID()}@example.com`,
            name: 'Notification Route User',
            username: `user_${crypto.randomUUID().slice(0, 12)}`,
            password: await bcrypt.hash('Password123', 10),
            isDeleted: false,
            notifyProductUpdates: false,
            notifyProjectActivity: false,
            notifySecurityAlerts: false,
            chatSuggestions: false,
            githubConnected: false,
            ...overrides,
        },
    })
}

const createTestSession = async (overrides: Record<string, unknown> = {}) => {
    return prisma.session.create({
        data: {
            id: TEST_SESSION_ID,
            userId: TEST_USER_ID,
            refreshTokenHash: `hash-${crypto.randomUUID()}`,
            expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24),
            isRevoked: false,
            ...overrides,
        },
    })
}

describe('notification.routes.integration', () => {
    let app: express.Application

    beforeAll(() => {
        app = express()
        app.use(express.json())
        app.use((req, _res, next) => {
            req.user = { userId: TEST_USER_ID, sessionId: TEST_SESSION_ID }
            next()
        })
        const testRouter = Router()
        testRouter.get('/', notificationController.getNotifications)
        testRouter.post('/send', notificationController.sendNotificationToUser)
        testRouter.post('/sendall', notificationController.sendNotificationToAll)
        testRouter.get('/:id', notificationController.getNotificationById)
        testRouter.patch('/:id/read', notificationController.markAsRead)
        testRouter.delete('/:id', notificationController.deleteNotification)
        testRouter.delete('/', notificationController.deleteAllReadNotification)
        app.use('/api/v1/notifications', testRouter)
    })

    beforeEach(async () => {
        await prisma.notification.deleteMany()
        await prisma.session.deleteMany()
        await prisma.user.deleteMany()

        await createTestUser()
        await createTestSession()
    })

    afterAll(async () => {
        await prisma.notification.deleteMany()
        await prisma.session.deleteMany()
        await prisma.user.deleteMany()
        await prisma.$disconnect()
    })

    describe('GET /', () => {
        it('should return 200 with list of notifications', async () => {
            await prisma.notification.create({
                data: {
                    userId: TEST_USER_ID,
                    title: 'System alert',
                    message: 'Running out of disk space',
                    type: 'WARNING',
                },
            })

            const res = await request(app).get('/api/v1/notifications')

            expect(res.status).toBe(200)
            expect(res.body.success).toBe(true)
            expect(res.body.data.length).toBe(1)
            expect(res.body.data[0].title).toBe('System alert')
            expect(res.body.data[0].userId).toBeUndefined()
        })

        it('should return 404 if user is soft-deleted', async () => {
            await prisma.user.update({ where: { id: TEST_USER_ID }, data: { isDeleted: true } })

            const res = await request(app).get('/api/v1/notifications')
            expect(res.status).toBe(404)
            expect(res.body.success).toBe(false)
        })
    })

    describe('GET /:id', () => {
        it('should return 200 and details', async () => {
            const notif = await prisma.notification.create({
                data: {
                    userId: TEST_USER_ID,
                    title: 'Welcome',
                    message: 'Hello!',
                    type: 'INFO',
                },
            })

            const res = await request(app).get(`/api/v1/notifications/${notif.id}`)

            expect(res.status).toBe(200)
            expect(res.body.success).toBe(true)
            expect(res.body.data.title).toBe('Welcome')
            expect(res.body.data.isRead).toBe(true) // Should mark as read when fetched in detail
        })

        it('should return 404 for non-existent notification', async () => {
            const res = await request(app).get(
                `/api/v1/notifications/864e432c-687f-4424-aa61-a831518f8e12`
            )
            expect(res.status).toBe(404)
        })

        it('should return 400 for invalid UUID', async () => {
            const res = await request(app).get(`/api/v1/notifications/invalid-uuid`)
            expect(res.status).toBe(400)
            expect(res.body.success).toBe(false)
            expect(res.body.errors.id).toContain('notification ID must be a valid UUID')
        })
    })

    describe('PATCH /:id/read', () => {
        it('should mark notification as read', async () => {
            const notif = await prisma.notification.create({
                data: {
                    userId: TEST_USER_ID,
                    title: 'Read me',
                    message: 'Do it',
                },
            })

            const res = await request(app).patch(`/api/v1/notifications/${notif.id}/read`)

            expect(res.status).toBe(200)
            expect(res.body.success).toBe(true)
            expect(res.body.data.isRead).toBe(true)
        })

        it('should return 404 for non-existent notification', async () => {
            const res = await request(app).patch(
                `/api/v1/notifications/864e432c-687f-4424-aa61-a831518f8e12/read`
            )
            expect(res.status).toBe(404)
        })
    })

    describe('DELETE /:id', () => {
        it('should delete notification', async () => {
            const notif = await prisma.notification.create({
                data: {
                    userId: TEST_USER_ID,
                    title: 'Read me',
                    message: 'Do it',
                },
            })

            const res = await request(app).delete(`/api/v1/notifications/${notif.id}`)

            expect(res.status).toBe(200)
            expect(res.body.success).toBe(true)

            // Verify it was deleted
            const dbNotif = await prisma.notification.findUnique({ where: { id: notif.id } })
            expect(dbNotif).toBeNull()
        })
    })

    describe('DELETE /', () => {
        it('should delete all read notifications for user', async () => {
            // Create read notification
            const notifRead = await prisma.notification.create({
                data: {
                    userId: TEST_USER_ID,
                    title: 'Read notification',
                    message: 'Hello',
                    isRead: true,
                },
            })

            // Create unread notification
            const notifUnread = await prisma.notification.create({
                data: {
                    userId: TEST_USER_ID,
                    title: 'Unread notification',
                    message: 'World',
                    isRead: false,
                },
            })

            const res = await request(app).delete('/api/v1/notifications')

            expect(res.status).toBe(200)
            expect(res.body.success).toBe(true)

            // Verify read notification is deleted
            const dbRead = await prisma.notification.findUnique({ where: { id: notifRead.id } })
            expect(dbRead).toBeNull()

            // Verify unread notification still exists
            const dbUnread = await prisma.notification.findUnique({ where: { id: notifUnread.id } })
            expect(dbUnread).not.toBeNull()
        })
    })

    describe('POST /send', () => {
        it('should send notification and return 201', async () => {
            const res = await request(app).post('/api/v1/notifications/send').send({
                userId: TEST_USER_ID,
                title: 'Custom title',
                message: 'Custom message',
                type: 'SUCCESS',
            })

            expect(res.status).toBe(201)
            expect(res.body.success).toBe(true)
            expect(res.body.data.title).toBe('Custom title')
            expect(res.body.data.userId).toBeUndefined()
        })

        it('should return 400 for validation failure', async () => {
            const res = await request(app).post('/api/v1/notifications/send').send({
                userId: 'invalid-uuid',
                title: '',
                message: '',
                type: 'WRONG',
            })

            expect(res.status).toBe(400)
            expect(res.body.success).toBe(false)
            expect(res.body.errors.userId).toContain('user ID must be a valid UUID')
            expect(res.body.errors.title).toContain('title is required')
            expect(res.body.errors.message).toContain('message is required')
            expect(res.body.errors.type).toContain(
                "type must be one of 'INFO', 'WARNING', 'SUCCESS', 'ERROR'"
            )
        })
    })

    describe('POST /sendall', () => {
        it('should send notifications to all and return 201', async () => {
            const res = await request(app).post('/api/v1/notifications/sendall').send({
                title: 'Global announcement',
                message: 'Hello all!',
            })

            expect(res.status).toBe(201)
            expect(res.body.success).toBe(true)
        })

        it('should return 400 for validation failure', async () => {
            const res = await request(app).post('/api/v1/notifications/sendall').send({
                title: '',
                message: '',
            })

            expect(res.status).toBe(400)
            expect(res.body.success).toBe(false)
            expect(res.body.errors.title).toContain('title is required')
            expect(res.body.errors.message).toContain('message is required')
        })
    })
})
