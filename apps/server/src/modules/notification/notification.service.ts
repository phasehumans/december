import { prisma } from '@december/database'
import { AppError } from '../../shared/appError'

export const notificationSelect = {
    id: true,
    title: true,
    message: true,
    isRead: true,
    type: true,
    link: true,
    createdAt: true,
}

import type {
    GetNotifications,
    GetNotificationById,
    MarkAsRead,
    DeleteNotification,
    SendNotificationToUser,
    DeleteAllReadNotification,
} from '@december/shared'

const getNotifications = async (data: GetNotifications) => {
    const { userId } = data
    return prisma.notification.findMany({
        where: { userId },
        select: notificationSelect,
        orderBy: { createdAt: 'desc' },
    })
}

const getNotificationById = async (data: GetNotificationById) => {
    const { userId, id } = data
    return prisma.notification.findUnique({
        where: {
            id: id,
            userId: userId,
        },
        select: notificationSelect,
    })
}

const markAsRead = async (data: MarkAsRead) => {
    const { userId, id } = data
    const existing = await prisma.notification.findFirst({
        where: {
            id: id,
            userId: userId,
        },
        select: {
            id: true,
        },
    })

    if (!existing) {
        throw new AppError('notification not found', 404)
    }

    return prisma.notification.update({
        where: {
            id: id,
            userId: userId,
        },
        data: {
            isRead: true,
        },
        select: notificationSelect,
    })
}

const deleteNotification = async (data: DeleteNotification) => {
    const { userId, id } = data
    const existing = await prisma.notification.findFirst({
        where: {
            id: id,
            userId: userId,
        },
        select: {
            id: true,
        },
    })

    if (!existing) {
        throw new AppError('notification not found', 404)
    }

    return prisma.notification.delete({
        where: {
            id: id,
            userId: userId,
        },
        select: notificationSelect,
    })
}

const sendNotificationToUser = async (data: SendNotificationToUser) => {
    return prisma.notification.create({
        data: {
            userId: data.userId,
            title: data.title,
            message: data.message,
            type: data.type || 'INFO',
            link: data.link,
        },
        select: notificationSelect,
    })
}

const deleteAllReadNotification = async (data: DeleteAllReadNotification) => {
    const { userId } = data
    return prisma.notification.deleteMany({
        where: {
            userId,
            isRead: true,
        },
    })
}

export const notificationService = {
    getNotifications,
    getNotificationById,
    markAsRead,
    deleteNotification,
    sendNotificationToUser,
    deleteAllReadNotification,
}

export { sendNotificationToUser }
