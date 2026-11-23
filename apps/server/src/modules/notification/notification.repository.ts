import { prisma } from '@december/database'

import type { Prisma } from '@december/database'

async function findManyNotifications(data: {
    userId: string
    select: Prisma.NotificationSelect
    page?: number
    limit?: number
    isRead?: boolean
    category?: 'GENERAL' | 'MENTION'
}) {
    const { userId, select, page = 1, limit = 20, isRead, category } = data
    const skip = (page - 1) * limit
    const where: Prisma.NotificationWhereInput = {
        userId,
        ...(isRead !== undefined ? { isRead } : {}),
        ...(category ? { category } : {}),
    }

    const [total, notifications] = await Promise.all([
        prisma.notification.count({ where }),
        prisma.notification.findMany({
            where,
            select,
            skip,
            take: limit,
            orderBy: { createdAt: 'desc' },
        }),
    ])

    return {
        notifications,
        pagination: {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        },
    }
}

async function findNotificationById(data: {
    userId: string
    id: string
    select: Prisma.NotificationSelect
}) {
    const { userId, id, select } = data
    return prisma.notification.findUnique({
        where: {
            id,
            userId,
        },
        select,
    })
}

async function findFirstNotification(data: {
    userId: string
    id: string
    select: Prisma.NotificationSelect
}) {
    const { userId, id, select } = data
    return prisma.notification.findFirst({
        where: {
            id,
            userId,
        },
        select,
    })
}

async function updateNotificationRead(data: {
    userId: string
    id: string
    select: Prisma.NotificationSelect
}) {
    const { userId, id, select } = data
    return prisma.notification.update({
        where: {
            id,
            userId,
        },
        data: {
            isRead: true,
        },
        select,
    })
}

async function deleteNotification(data: {
    userId: string
    id: string
    select: Prisma.NotificationSelect
}) {
    const { userId, id, select } = data
    return prisma.notification.delete({
        where: {
            id,
            userId,
        },
        select,
    })
}

async function createNotification(data: {
    userId: string
    title: string
    message: string
    type: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR'
    category?: 'GENERAL' | 'MENTION'
    link?: string | null
    select: Prisma.NotificationSelect
}) {
    const { userId, title, message, type, category = 'GENERAL', link, select } = data
    return prisma.notification.create({
        data: {
            userId,
            title,
            message,
            type,
            category,
            link,
        },
        select,
    })
}

async function deleteManyReadNotifications(userId: string) {
    return prisma.notification.deleteMany({
        where: {
            userId,
            isRead: true,
        },
    })
}

async function countUnreadNotifications(userId: string, category?: 'GENERAL' | 'MENTION') {
    return prisma.notification.count({
        where: {
            userId,
            isRead: false,
            ...(category ? { category } : {}),
        },
    })
}

async function updateAllNotificationsRead(userId: string) {
    return prisma.notification.updateMany({
        where: {
            userId,
            isRead: false,
        },
        data: {
            isRead: true,
        },
    })
}

export const notificationRepository = {
    findManyNotifications,
    countUnreadNotifications,
    findNotificationById,
    findFirstNotification,
    updateNotificationRead,
    deleteNotification,
    createNotification,
    deleteManyReadNotifications,
    updateAllNotificationsRead,
}
