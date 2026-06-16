import { apiRequest } from '@/shared/api/client'

export interface Notification {
    id: string
    userId: string
    title: string
    message: string
    isRead: boolean
    type: 'INFO' | 'WARNING' | 'SUCCESS' | 'ERROR'
    link: string | null
    createdAt: string
}

const getNotifications = () => {
    return apiRequest<Notification[]>('/notification')
}

const getNotificationById = (id: string) => {
    return apiRequest<Notification>(`/notification/${id}`)
}

const markAsRead = (id: string) => {
    return apiRequest<Notification>(`/notification/${id}/read`, {
        method: 'PATCH',
    })
}

const deleteNotification = (id: string) => {
    return apiRequest<void>(`/notification/${id}`, {
        method: 'DELETE',
    })
}

const deleteAllRead = () => {
    return apiRequest<void>('/notification', {
        method: 'DELETE',
    })
}

const deleteAll = () => {
    return apiRequest<void>('/notification', {
        method: 'DELETE',
    })
}

export const notificationAPI = {
    getNotifications,
    getNotificationById,
    markAsRead,
    deleteNotification,
    deleteAllRead,
    deleteAll,
}
