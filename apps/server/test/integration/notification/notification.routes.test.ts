import '../../env'

import bcrypt from 'bcrypt'
import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'bun:test'
import express from 'express'
import { Router } from 'express'
import request from 'supertest'

import { prisma } from '@december/database'
import { notificationController } from '../../../src/modules/notification/notification.controller'
import { notificationService } from '../../../src/modules/notification/notification.service'

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
    let mockAuth = true

    beforeAll(() => {
        app = express()
        app.use(express.json())
        app.use(async (req, res, next) => {
            if (mockAuth) {
                const user = await prisma.user.findUnique({
                    where: { id: TEST_USER_ID },
                    select: { isDeleted: true },
                })
                if (!user || user.isDeleted) {
                    return res.status(404).json({
                        success: false,
                        message: 'user not found',
                    })
                }
                req.user = { userId: TEST_USER_ID, sessionId: TEST_SESSION_ID }
            } else {
                req.user = undefined
            }
            next()
        })
        const testRouter = Router()
        testRouter.get('/', notificationController.getNotifications)
        testRouter.get('/:id', notificationController.getNotificationById)
        testRouter.patch('/:id/read', notificationController.markAsRead)
        testRouter.delete('/:id', notificationController.deleteNotification)
        testRouter.delete('/', notificationController.deleteAllReadNotification)
        app.use('/api/v1/notifications', testRouter)
    })

    beforeEach(async () => {
        mockAuth = true
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

    describe('GET /:id extra flows', () => {
        it('should mark an unread notification as read when fetched', async () => {
            const notif = await prisma.notification.create({
                data: {
                    userId: TEST_USER_ID,
                    title: 'Unread to Read',
                    message: 'Hello details',
                    isRead: false,
                },
            })

            const res = await request(app).get(`/api/v1/notifications/${notif.id}`)
            expect(res.status).toBe(200)
            expect(res.body.success).toBe(true)
            expect(res.body.data.isRead).toBe(true)

            // Verify db state
            const dbNotif = await prisma.notification.findUnique({ where: { id: notif.id } })
            expect(dbNotif!.isRead).toBe(true)
        })

        it('should return 400 when param id is not a valid UUID', async () => {
            const res = await request(app).get('/api/v1/notifications/not-a-valid-uuid')
            expect(res.status).toBe(400)
            expect(res.body.success).toBe(false)
            expect(res.body.errors.id).toContain('notification ID must be a valid UUID')
        })
    })

    describe('Unauthorized flows', () => {
        beforeEach(() => {
            mockAuth = false // disable auth injection
        })

        it('should return 400 when fetching notifications list unauthorized', async () => {
            const res = await request(app).get('/api/v1/notifications')
            expect(res.status).toBe(400)
            expect(res.body.success).toBe(false)
            expect(res.body.message).toBe('unauthorized')
        })

        it('should return 400 when fetching notification details unauthorized', async () => {
            const res = await request(app).get(
                '/api/v1/notifications/864e432c-687f-4424-aa61-a831518f8e12'
            )
            expect(res.status).toBe(400)
            expect(res.body.success).toBe(false)
            expect(res.body.message).toBe('unauthorized')
        })

        it('should return 400 when marking notification read unauthorized', async () => {
            const res = await request(app).patch(
                '/api/v1/notifications/864e432c-687f-4424-aa61-a831518f8e12/read'
            )
            expect(res.status).toBe(400)
            expect(res.body.success).toBe(false)
            expect(res.body.message).toBe('unauthorized')
        })

        it('should return 400 when deleting notification unauthorized', async () => {
            const res = await request(app).delete(
                '/api/v1/notifications/864e432c-687f-4424-aa61-a831518f8e12'
            )
            expect(res.status).toBe(400)
            expect(res.body.success).toBe(false)
            expect(res.body.message).toBe('unauthorized')
        })

        it('should return 401 when deleting all read notifications unauthorized', async () => {
            const res = await request(app).delete('/api/v1/notifications')
            expect(res.status).toBe(401)
            expect(res.body.success).toBe(false)
            expect(res.body.message).toBe('unauthorized')
        })
    })

    describe('Validation failure flows', () => {
        it('should return 400 when marking read with invalid UUID', async () => {
            const res = await request(app).patch('/api/v1/notifications/invalid-uuid/read')
            expect(res.status).toBe(400)
            expect(res.body.success).toBe(false)
            expect(res.body.errors.id).toContain('notification ID must be a valid UUID')
        })

        it('should return 400 when deleting with invalid UUID', async () => {
            const res = await request(app).delete('/api/v1/notifications/invalid-uuid')
            expect(res.status).toBe(400)
            expect(res.body.success).toBe(false)
            expect(res.body.errors.id).toContain('notification ID must be a valid UUID')
        })
    })

    describe('Internal Server Error 500 flows', () => {
        it('should return 500 when GET / throws unexpected error', async () => {
            const original = notificationService.getNotifications
            notificationService.getNotifications = async () => {
                throw new Error('Database crash')
            }
            try {
                const res = await request(app).get('/api/v1/notifications')
                expect(res.status).toBe(500)
                expect(res.body.success).toBe(false)
                expect(res.body.message).toBe('failed to fetch notifications')
                expect(res.body.errors).toBe('Database crash')
            } finally {
                notificationService.getNotifications = original
            }
        })

        it('should return 500 when GET /:id throws unexpected error', async () => {
            const original = notificationService.getNotificationById
            notificationService.getNotificationById = async () => {
                throw new Error('Database crash')
            }
            try {
                const res = await request(app).get(
                    '/api/v1/notifications/864e432c-687f-4424-aa61-a831518f8e12'
                )
                expect(res.status).toBe(500)
                expect(res.body.success).toBe(false)
                expect(res.body.message).toBe('failed to fetch notification')
                expect(res.body.errors).toBe('Database crash')
            } finally {
                notificationService.getNotificationById = original
            }
        })

        it('should return 500 when PATCH /:id/read throws unexpected error', async () => {
            const original = notificationService.markAsRead
            notificationService.markAsRead = async () => {
                throw new Error('Database crash')
            }
            try {
                const res = await request(app).patch(
                    '/api/v1/notifications/864e432c-687f-4424-aa61-a831518f8e12/read'
                )
                expect(res.status).toBe(500)
                expect(res.body.success).toBe(false)
                expect(res.body.message).toBe('failed to mark notification as read')
                expect(res.body.errors).toBe('Database crash')
            } finally {
                notificationService.markAsRead = original
            }
        })

        it('should return 500 when DELETE /:id throws unexpected error', async () => {
            const original = notificationService.deleteNotification
            notificationService.deleteNotification = async () => {
                throw new Error('Database crash')
            }
            try {
                const res = await request(app).delete(
                    '/api/v1/notifications/864e432c-687f-4424-aa61-a831518f8e12'
                )
                expect(res.status).toBe(500)
                expect(res.body.success).toBe(false)
                expect(res.body.message).toBe('failed to delete notification')
                expect(res.body.errors).toBe('Database crash')
            } finally {
                notificationService.deleteNotification = original
            }
        })

        it('should return 500 when DELETE / throws unexpected error', async () => {
            const original = notificationService.deleteAllReadNotification
            notificationService.deleteAllReadNotification = async () => {
                throw new Error('Database crash')
            }
            try {
                const res = await request(app).delete('/api/v1/notifications')
                expect(res.status).toBe(500)
                expect(res.body.success).toBe(false)
                expect(res.body.message).toBe('failed to delete read notifications')
                expect(res.body.errors).toBe('Database crash')
            } finally {
                notificationService.deleteAllReadNotification = original
            }
        })
    })
})
