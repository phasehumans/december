import bcrypt from 'bcrypt'
import { describe, it, expect, beforeEach, afterAll } from 'bun:test'

import { prisma } from '../../../src/config/db'
import { notificationService } from '../../../src/modules/notification/notification.service'

const createUser = async (overrides: Record<string, unknown> = {}) => {
    return prisma.user.create({
        data: {
            name: 'Notification Test User',
            email: `test-${crypto.randomUUID()}@example.com`,
            username: `user_${crypto.randomUUID().slice(0, 12)}`,
            password: await bcrypt.hash('Password123', 10),
            emailVerified: true,
            notifyProductUpdates: false,
            notifyProjectActivity: false,
            notifySecurityAlerts: false,
            chatSuggestions: false,
            githubConnected: false,
            isDeleted: false,
            ...overrides,
        },
    })
}

const createSoftDeletedUser = () => createUser({ isDeleted: true })

describe('notification.service.integration', () => {
    let userId: string

    beforeEach(async () => {
        await prisma.notification.deleteMany()
        await prisma.user.deleteMany()

        const user = await createUser()
        userId = user.id
    })

    afterAll(async () => {
        await prisma.notification.deleteMany()
        await prisma.user.deleteMany()
        await prisma.$disconnect()
    })

    describe('getNotifications', () => {
        it('should get all notifications for a user in desc order', async () => {
            // Create two notifications
            await notificationService.sendNotificationToUser({
                userId,
                title: 'First Notification',
                message: 'Hello World 1',
            })
            // Small delay to ensure separate timestamps
            await new Promise((resolve) => setTimeout(resolve, 50))
            await notificationService.sendNotificationToUser({
                userId,
                title: 'Second Notification',
                message: 'Hello World 2',
            })

            const notifications = await notificationService.getNotifications(userId)
            expect(notifications.length).toBe(2)
            expect(notifications[0]?.title).toBe('Second Notification')
            expect(notifications[1]?.title).toBe('First Notification')

            // Check selected fields (ensure userId is omitted)
            expect((notifications[0] as any)?.userId).toBeUndefined()
            expect(notifications[0]?.id).toBeDefined()
            expect(notifications[0]?.title).toBeDefined()
            expect(notifications[0]?.message).toBeDefined()
            expect(notifications[0]?.isRead).toBe(false)
        })

        it('should return empty list if user does not exist or is soft-deleted', async () => {
            const result1 = await notificationService.getNotifications(
                '864e432c-687f-4424-aa61-a831518f8e12'
            )
            expect(result1).toEqual([])

            const deleted = await createSoftDeletedUser()
            const result2 = await notificationService.getNotifications(deleted.id)
            expect(result2).toEqual([])
        })
    })

    describe('getNotificationById', () => {
        it('should retrieve a single notification', async () => {
            const created = await notificationService.sendNotificationToUser({
                userId,
                title: 'Test Title',
                message: 'Test Message',
            })

            const fetched = await notificationService.getNotificationById(userId, created.id)
            expect(fetched).not.toBeNull()
            expect(fetched!.title).toBe('Test Title')
            expect((fetched as any).userId).toBeUndefined()
        })

        it('should return null for non-existent notification', async () => {
            const fetched = await notificationService.getNotificationById(
                userId,
                '864e432c-687f-4424-aa61-a831518f8e12'
            )
            expect(fetched).toBeNull()
        })

        it('should return null if user does not exist', async () => {
            const fetched = await notificationService.getNotificationById(
                '864e432c-687f-4424-aa61-a831518f8e12',
                '864e432c-687f-4424-aa61-a831518f8e12'
            )
            expect(fetched).toBeNull()
        })
    })

    describe('markAsRead', () => {
        it('should mark a notification as read successfully', async () => {
            const created = await notificationService.sendNotificationToUser({
                userId,
                title: 'To Read',
                message: 'Some message',
            })

            const updated = await notificationService.markAsRead(userId, created.id)
            expect(updated.isRead).toBe(true)
            expect((updated as any).userId).toBeUndefined()
        })

        it('should throw notification not found for non-existent notification', async () => {
            try {
                await notificationService.markAsRead(userId, '864e432c-687f-4424-aa61-a831518f8e12')
                throw new Error('expected function to throw')
            } catch (error: any) {
                expect(error.message).toBe('notification not found')
                expect(error.statusCode).toBe(404)
            }
        })
    })

    describe('deleteNotification', () => {
        it('should delete notification successfully', async () => {
            const created = await notificationService.sendNotificationToUser({
                userId,
                title: 'To Delete',
                message: 'Delete me',
            })

            const deleted = await notificationService.deleteNotification(userId, created.id)
            expect(deleted.id).toBe(created.id)

            // Double check it's gone
            const fetched = await notificationService.getNotificationById(userId, created.id)
            expect(fetched).toBeNull()
        })

        it('should throw notification not found for non-existent notification', async () => {
            try {
                await notificationService.deleteNotification(
                    userId,
                    '864e432c-687f-4424-aa61-a831518f8e12'
                )
                throw new Error('expected function to throw')
            } catch (error: any) {
                expect(error.message).toBe('notification not found')
                expect(error.statusCode).toBe(404)
            }
        })
    })

    describe('deleteAllReadNotification', () => {
        it('should delete all read notifications for user successfully', async () => {
            const readNotif = await notificationService.sendNotificationToUser({
                userId,
                title: 'Read notification',
                message: 'Hello',
            })
            await notificationService.markAsRead(userId, readNotif.id)

            const unreadNotif = await notificationService.sendNotificationToUser({
                userId,
                title: 'Unread notification',
                message: 'World',
            })

            await notificationService.deleteAllReadNotification(userId)

            const fetchedRead = await notificationService.getNotificationById(userId, readNotif.id)
            expect(fetchedRead).toBeNull()

            const fetchedUnread = await notificationService.getNotificationById(
                userId,
                unreadNotif.id
            )
            expect(fetchedUnread).not.toBeNull()
        })

        it('should return 0 deleted count if user does not exist', async () => {
            const res = await notificationService.deleteAllReadNotification(
                '864e432c-687f-4424-aa61-a831518f8e12'
            )
            expect(res.count).toBe(0)
        })
    })

    describe('sendNotificationToUser', () => {
        it('should send notification to valid user', async () => {
            const created = await notificationService.sendNotificationToUser({
                userId,
                title: 'Notification Title',
                message: 'A custom notification',
                type: 'SUCCESS',
            })

            expect(created.title).toBe('Notification Title')
            expect(created.isRead).toBe(false)
            expect(created.type).toBe('SUCCESS')
            expect((created as any).userId).toBeUndefined()
        })

        it('should throw foreign key error if user does not exist', async () => {
            let error: any = null
            try {
                await notificationService.sendNotificationToUser({
                    userId: '864e432c-687f-4424-aa61-a831518f8e12',
                    title: 'Title',
                    message: 'Message',
                })
            } catch (e) {
                error = e
            }
            expect(error).not.toBeNull()
        })
    })

    describe('markAsRead and deleteNotification cross-user security', () => {
        it("should throw AppError if user tries to mark another user's notification as read", async () => {
            const otherUser = await createUser({
                email: 'other@example.com',
                username: 'other_user',
            })
            const notif = await prisma.notification.create({
                data: {
                    userId: otherUser.id,
                    title: 'Other User Notification',
                    message: 'Secret message',
                },
            })

            let error: any = null
            try {
                await notificationService.markAsRead(userId, notif.id)
            } catch (e) {
                error = e
            }

            expect(error).not.toBeNull()
            expect(error.message).toBe('notification not found')
            expect(error.statusCode).toBe(404)
        })

        it("should throw AppError if user tries to delete another user's notification", async () => {
            const otherUser = await createUser({
                email: 'other2@example.com',
                username: 'other_user2',
            })
            const notif = await prisma.notification.create({
                data: {
                    userId: otherUser.id,
                    title: 'Other User Notification 2',
                    message: 'Secret message 2',
                },
            })

            let error: any = null
            try {
                await notificationService.deleteNotification(userId, notif.id)
            } catch (e) {
                error = e
            }

            expect(error).not.toBeNull()
            expect(error.message).toBe('notification not found')
            expect(error.statusCode).toBe(404)
        })

        it("should return null if user tries to get another user's notification", async () => {
            const otherUser = await createUser({
                email: 'other3@example.com',
                username: 'other_user3',
            })
            const notif = await prisma.notification.create({
                data: {
                    userId: otherUser.id,
                    title: 'Other User Notification 3',
                    message: 'Secret message 3',
                },
            })

            const fetched = await notificationService.getNotificationById(userId, notif.id)
            expect(fetched).toBeNull()
        })
    })
})
