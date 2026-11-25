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

// notification settings and push (#636)

async function findUserNotifyPrefs(userId: string) {
    return prisma.user.findUnique({
        where: { id: userId },
        select: {
            email: true,
            isDeleted: true,
            notifyLevel: true,
            notifyEmail: true,
            notifyPush: true,
        },
    })
}

async function findPushSubscriptions(userId: string) {
    return prisma.pushSubscription.findMany({
        where: { userId },
        select: { id: true, endpoint: true, p256dh: true, auth: true },
    })
}

// one row per browser. a browser that signs in as someone else moves to that user
async function upsertPushSubscription(data: {
    userId: string
    endpoint: string
    p256dh: string
    auth: string
    userAgent?: string
}) {
    const { endpoint, ...rest } = data
    return prisma.pushSubscription.upsert({
        where: { endpoint },
        create: { endpoint, ...rest },
        update: rest,
        select: { id: true },
    })
}

async function deletePushSubscription(data: { userId: string; endpoint: string }) {
    const { userId, endpoint } = data
    return prisma.pushSubscription.deleteMany({ where: { userId, endpoint } })
}

async function countPushSubscriptions(userId: string) {
    return prisma.pushSubscription.count({ where: { userId } })
}

async function deletePushSubscriptionsByIds(ids: string[]) {
    return prisma.pushSubscription.deleteMany({ where: { id: { in: ids } } })
}

async function touchPushSubscriptions(ids: string[]) {
    return prisma.pushSubscription.updateMany({
        where: { id: { in: ids } },
        data: { lastUsedAt: new Date() },
    })
}

async function updateNotifyPush(userId: string, notifyPush: boolean) {
    return prisma.user.update({
        where: { id: userId },
        data: { notifyPush },
        select: { notifyPush: true },
    })
}

async function findDigestUsers() {
    return prisma.user.findMany({
        where: { digestEnabled: true, isDeleted: false },
        select: {
            id: true,
            email: true,
            digestTime: true,
            timezone: true,
            lastDigestAt: true,
        },
    })
}

async function summarizeSince(userId: string, since: Date) {
    const [sessionsWorkedOn, pullRequestsOpened, credits] = await Promise.all([
        prisma.session.count({
            where: {
                userId,
                messages: { some: { role: 'ASSISTANT', createdAt: { gte: since } } },
            },
        }),
        prisma.session.count({ where: { userId, prOpenedAt: { gte: since } } }),
        prisma.usageEvent.aggregate({
            where: { userId, billingSource: 'CREDITS', createdAt: { gte: since } },
            _sum: { costInCents: true },
        }),
    ])
    return {
        sessionsWorkedOn,
        pullRequestsOpened,
        creditsUsedCents: credits._sum.costInCents ?? 0,
    }
}

async function markDigestSent(userId: string, at: Date) {
    return prisma.user.update({
        where: { id: userId },
        data: { lastDigestAt: at },
        select: { id: true },
    })
}

export const notificationRepository = {
    findUserNotifyPrefs,
    findPushSubscriptions,
    upsertPushSubscription,
    deletePushSubscription,
    countPushSubscriptions,
    deletePushSubscriptionsByIds,
    touchPushSubscriptions,
    updateNotifyPush,
    findDigestUsers,
    summarizeSince,
    markDigestSent,
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
