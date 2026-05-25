import { prisma } from '../../config/db'
import { AppError } from '../../utils/appError'

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
    const user = await prisma.user.findUnique({
        where: {
            id: userId,
        },
        select: {
            id: true,
            isDeleted: true,
        },
    })

    if (!user || user.isDeleted === true) {
        throw new AppError('user not found', 404)
    }

    return prisma.notification.findMany({
        where: { userId },
        select: notificationSelect,
        orderBy: { createdAt: 'desc' },
    })
}

const getNotificationById = async (userId: string, id: string) => {
    const user = await prisma.user.findUnique({
        where: {
            id: userId,
        },
        select: {
            id: true,
            isDeleted: true,
        },
    })

    if (!user || user.isDeleted === true) {
        throw new AppError('user not found', 404)
    }

    return prisma.notification.findUnique({
        where: {
            id: id,
            userId: userId,
        },
        select: notificationSelect,
    })
}

const markAsRead = async (userId: string, id: string) => {
    const user = await prisma.user.findUnique({
        where: {
            id: userId,
        },
        select: {
            id: true,
            isDeleted: true,
        },
    })

    if (!user || user.isDeleted === true) {
        throw new AppError('user not found', 404)
    }

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
    const user = await prisma.user.findUnique({
        where: {
            id: userId,
        },
        select: {
            id: true,
            isDeleted: true,
        },
    })

    if (!user || user.isDeleted === true) {
        throw new AppError('user not found', 404)
    }

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
    const user = await prisma.user.findUnique({
        where: {
            id: data.userId,
        },
        select: {
            id: true,
            isDeleted: true,
        },
    })

    if (!user || user.isDeleted === true) {
        throw new AppError('user not found', 404)
    }

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

const sendNotificationToAll = async (data: {
    title: string
    message: string
    type?: 'INFO' | 'WARNING' | 'SUCCESS' | 'ERROR'
    link?: string
}) => {
    const users = await prisma.user.findMany({
        where: {
            isDeleted: false,
        },
        select: {
            id: true,
        },
    })
    if (users.length === 0) {
        return { count: 0 }
    }
    const notifications = users.map((user) => ({
        userId: user.id,
        title: data.title,
        message: data.message,
        type: data.type || 'INFO',
        link: data.link,
    }))

    return prisma.notification.createMany({
        data: notifications,
    })
}

export const notificationService = {
    getNotifications,
    getNotificationById,
    markAsRead,
    deleteNotification,
    sendNotificationToUser,
    sendNotificationToAll,
}

export { sendNotificationToUser }
