import { apiRequest } from '@/shared/api/client'

export type NotificationCategory = 'GENERAL' | 'MENTION'

/** inbox filter: all notifications, or mentions only (K3-B) */
export type InboxFilter = 'all' | 'mentions'

export interface UnreadCount {
    count: number
    mentions?: number
}

export interface Notification {
    id: string
    userId: string
    title: string
    message: string
    isRead: boolean
    type: 'INFO' | 'WARNING' | 'SUCCESS' | 'ERROR'
    // MENTION = replies, review comments and @trydecember mentions (the Mentions filter)
    category?: NotificationCategory
    link: string | null
    createdAt: string
}

export interface PaginatedNotificationsResponse {
    notifications: Notification[]
    pagination: {
        total: number
        page: number
        limit: number
        totalPages: number
    }
}

const getNotifications = (params?: {
    page?: number
    limit?: number
    isRead?: boolean
    category?: NotificationCategory
}) => {
    const query = new URLSearchParams()
    if (params?.page) query.set('page', params.page.toString())
    if (params?.limit) query.set('limit', params.limit.toString())
    if (params?.isRead !== undefined) query.set('isRead', params.isRead.toString())
    if (params?.category) query.set('category', params.category)
    const qs = query.toString()
    return apiRequest<PaginatedNotificationsResponse>(`/notification${qs ? `?${qs}` : ''}`)
}

const getUnreadCount = () => {
    return apiRequest<UnreadCount>('/notification/unread-count')
}

const getNotificationById = (id: string) => {
    return apiRequest<Notification>(`/notification/${id}`)
}

const markAsRead = (id: string) => {
    return apiRequest<Notification>(`/notification/${id}/read`, {
        method: 'PATCH',
    })
}

const markAllAsRead = () => {
    return apiRequest<{ updated: number }>('/notification/read-all', {
        method: 'PATCH',
    })
}

// N6: opening a session reads its unread items (input, failed, finished, pull request)
const markSessionRead = (sessionId: string) => {
    return apiRequest<{ updated: number }>(
        `/notification/read-session/${encodeURIComponent(sessionId)}`,
        { method: 'PATCH' }
    )
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
    getUnreadCount,
    getNotificationById,
    markAsRead,
    markAllAsRead,
    markSessionRead,
    deleteNotification,
    deleteAllRead,
    deleteAll,
}
