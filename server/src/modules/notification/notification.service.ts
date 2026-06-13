import { prisma } from '../../config/db'
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

const getNotifications = async (userId: string) => {
    return prisma.notification.findMany({
        where: { userId },
        select: notificationSelect,
        orderBy: { createdAt: 'desc' },
    })
}

const getNotificationById = async (userId: string, id: string) => {
    return prisma.notification.findUnique({
        where: {
            id: id,
            userId: userId,
        },
        select: notificationSelect,
    })
}

const markAsRead = async (userId: string, id: string) => {
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

const deleteNotification = async (userId: string, id: string) => {
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

const sendNotificationToUser = async (data: {
    userId: string
    title: string
    message: string
    type?: 'INFO' | 'WARNING' | 'SUCCESS' | 'ERROR'
    link?: string
}) => {
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

const deleteAllReadNotification = async (data: string) => {
    return prisma.notification.deleteMany({
        where: {
            userId: data,
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
