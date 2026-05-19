import { prisma } from '../../config/db'

const getNotifications = async (userId: string) => {
    return prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
    })
}

const getNotificationById = async (userId: string, id: string) => {
    return prisma.notification.findUnique({
        where: { id, userId },
    })
}

const markAsRead = async (userId: string, id: string) => {
    return prisma.notification.update({
        where: { id, userId },
        data: { isRead: true },
    })
}

const deleteNotification = async (userId: string, id: string) => {
    return prisma.notification.delete({
        where: { id, userId },
    })
}

const deleteAllReadNotifications = async (userId: string) => {
    return prisma.notification.deleteMany({
        where: { userId, isRead: true },
    })
}

const deleteAllNotifications = async (userId: string) => {
    return prisma.notification.deleteMany({
        where: { userId },
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
    })
}

const sendNotificationToAll = async (data: {
    title: string
    message: string
    type?: 'INFO' | 'WARNING' | 'SUCCESS' | 'ERROR'
    link?: string
}) => {
    const users = await prisma.user.findMany({ select: { id: true } })
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
    deleteAllReadNotifications,
    deleteAllNotifications,
    sendNotificationToUser,
    sendNotificationToAll,
}

// Named export for direct import by other modules (e.g. template.service.ts)
export { sendNotificationToUser }
