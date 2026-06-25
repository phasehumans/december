import { prisma } from '@december/database'

import type { Prisma } from '@december/database'

async function findManyNotifications(data: { userId: string; select: Prisma.NotificationSelect }) {
    const { userId, select } = data
    return prisma.notification.findMany({
        where: { userId },
        select,
        orderBy: { createdAt: 'desc' },
    })
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
    link?: string | null
    select: Prisma.NotificationSelect
}) {
    const { userId, title, message, type, link, select } = data
    return prisma.notification.create({
        data: {
            userId,
            title,
            message,
            type,
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

export const notificationRepository = {
    findManyNotifications,
    findNotificationById,
    findFirstNotification,
    updateNotificationRead,
    deleteNotification,
    createNotification,
    deleteManyReadNotifications,
}
