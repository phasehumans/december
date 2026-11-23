import { publishEvent } from '@december/shared/queue'

import { AppError } from '../../shared/appError'

import { notificationRepository } from './notification.repository'

export const notificationSelect = {
    id: true,
    title: true,
    message: true,
    isRead: true,
    type: true,
    category: true,
    link: true,
    createdAt: true,
}

import type {
    GetNotifications,
    GetUnreadCount,
    GetNotificationById,
    MarkAsRead,
    DeleteNotification,
    SendNotificationToUser,
    DeleteAllReadNotification,
    MarkAllAsRead,
} from './notification.types'

const getNotifications = async (data: GetNotifications) => {
    const { userId, page, limit, isRead, category } = data
    return notificationRepository.findManyNotifications({
        userId,
        page,
        limit,
        isRead,
        category,
        select: notificationSelect,
    })
}

const getUnreadCount = async (data: GetUnreadCount) => {
    const { userId } = data
    const [count, mentions] = await Promise.all([
        notificationRepository.countUnreadNotifications(userId),
        notificationRepository.countUnreadNotifications(userId, 'MENTION'),
    ])
    return { count, mentions }
}

const getNotificationById = async (data: GetNotificationById) => {
    const { userId, id } = data
    return notificationRepository.findNotificationById({
        userId,
        id,
        select: notificationSelect,
    })
}

const markAsRead = async (data: MarkAsRead) => {
    const { userId, id } = data
    const existing = await notificationRepository.findFirstNotification({
        userId,
        id,
        select: {
            id: true,
        },
    })

    if (!existing) {
        throw new AppError('notification not found', 404)
    }

    return notificationRepository.updateNotificationRead({
        userId,
        id,
        select: notificationSelect,
    })
}

const deleteNotification = async (data: DeleteNotification) => {
    const { userId, id } = data
    const existing = await notificationRepository.findFirstNotification({
        userId,
        id,
        select: {
            id: true,
        },
    })

    if (!existing) {
        throw new AppError('notification not found', 404)
    }

    return notificationRepository.deleteNotification({
        userId,
        id,
        select: notificationSelect,
    })
}

const sendNotificationToUser = async (data: SendNotificationToUser) => {
    const {
        userId,
        title,
        message,
        type = 'INFO',
        link,
        category = 'GENERAL',
        toast = false,
    } = data
    const notification = await notificationRepository.createNotification({
        userId,
        title,
        message,
        type,
        category,
        link,
        select: notificationSelect,
    })

    // open tabs get it at once over the socket (socket.ts relays user_notifications:*)
    try {
        await publishEvent(`user_notifications:${userId}`, { notification, toast })
    } catch (err) {
        // the inbox still refetches the unread count every 30s, so a missed publish only delays it
        console.error('[Notification] live publish failed:', err)
    }

    return notification
}

const markAllAsRead = async (data: MarkAllAsRead) => {
    const { userId } = data
    const result = await notificationRepository.updateAllNotificationsRead(userId)
    return { updated: result.count }
}

const deleteAllReadNotification = async (data: DeleteAllReadNotification) => {
    const { userId } = data
    return notificationRepository.deleteManyReadNotifications(userId)
}

export const notificationService = {
    getNotifications,
    getUnreadCount,
    getNotificationById,
    markAsRead,
    deleteNotification,
    sendNotificationToUser,
    deleteAllReadNotification,
    markAllAsRead,
}
