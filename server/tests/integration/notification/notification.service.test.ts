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

        it('should throw user not found if user does not exist', async () => {
            try {
                await notificationService.getNotifications('864e432c-687f-4424-aa61-a831518f8e12')
                throw new Error('expected function to throw')
            } catch (error: any) {
                expect(error.message).toBe('user not found')
                expect(error.statusCode).toBe(404)
            }
        })

        it('should throw user not found for soft-deleted user', async () => {
            const deleted = await createSoftDeletedUser()
            try {
                await notificationService.getNotifications(deleted.id)
                throw new Error('expected function to throw')
            } catch (error: any) {
                expect(error.message).toBe('user not found')
                expect(error.statusCode).toBe(404)
            }
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

        it('should throw user not found if user does not exist', async () => {
            try {
                await notificationService.getNotificationById(
                    '864e432c-687f-4424-aa61-a831518f8e12',
                    '864e432c-687f-4424-aa61-a831518f8e12'
                )
                throw new Error('expected function to throw')
            } catch (error: any) {
                expect(error.message).toBe('user not found')
                expect(error.statusCode).toBe(404)
            }
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

        it('should throw user not found if user does not exist', async () => {
            try {
                await notificationService.deleteAllReadNotification(
                    '864e432c-687f-4424-aa61-a831518f8e12'
                )
                throw new Error('expected function to throw')
            } catch (error: any) {
                expect(error.message).toBe('user not found')
                expect(error.statusCode).toBe(404)
            }
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

        it('should throw user not found if user does not exist', async () => {
            try {
                await notificationService.sendNotificationToUser({
                    userId: '864e432c-687f-4424-aa61-a831518f8e12',
                    title: 'Title',
                    message: 'Message',
                })
                throw new Error('expected function to throw')
            } catch (error: any) {
                expect(error.message).toBe('user not found')
                expect(error.statusCode).toBe(404)
            }
        })
    })

    describe('sendNotificationToAll', () => {
        it('should send notifications to all non-deleted users', async () => {
            // Create another active user and a soft-deleted user
            const activeUser2 = await createUser()
            const softDeletedUser = await createSoftDeletedUser()

            const result = await notificationService.sendNotificationToAll({
                title: 'Broadcast',
                message: 'Hello everyone!',
                type: 'WARNING',
            })

            // Expected to send to 2 active users, not the deleted user
            expect(result.count).toBe(2)

            // Let's verify notifications are fetched for the active users but not soft-deleted
            const list1 = await notificationService.getNotifications(userId)
            expect(list1[0]?.title).toBe('Broadcast')

            const list2 = await notificationService.getNotifications(activeUser2.id)
            expect(list2[0]?.title).toBe('Broadcast')

            // Retrieving from soft-deleted user should throw user not found
            try {
                await notificationService.getNotifications(softDeletedUser.id)
                throw new Error('expected function to throw')
            } catch (error: any) {
                expect(error.message).toBe('user not found')
            }
        })
    })
})
