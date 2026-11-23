import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import React from 'react'

import { notificationAPI, type Notification } from '../api/notification'

type NotificationPage = { notifications: Notification[] }
type NotificationCache = { pages: NotificationPage[] } | undefined

const mapPages = (old: NotificationCache, fn: (list: Notification[]) => Notification[]) => {
    if (!old?.pages) return old
    return {
        ...old,
        pages: old.pages.map((p) => ({ ...p, notifications: fn(p.notifications ?? []) })),
    }
}

// inbox data for the mobile inbox sheet: same query keys as the desktop popover, so both
// stay in sync with the unread badge
export const useInbox = (enabled: boolean) => {
    const queryClient = useQueryClient()

    const query = useInfiniteQuery({
        queryKey: ['notifications'],
        queryFn: ({ pageParam = 1 }) =>
            notificationAPI.getNotifications({ page: pageParam, limit: 20 }),
        getNextPageParam: (lastPage) => {
            const { page, totalPages } = lastPage.pagination
            return page < totalPages ? page + 1 : undefined
        },
        initialPageParam: 1,
        enabled,
    })

    const notifications = React.useMemo(
        () => query.data?.pages.flatMap((p) => p.notifications) ?? [],
        [query.data]
    )

    const refresh = () => {
        queryClient.invalidateQueries({ queryKey: ['notifications'] })
        queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] })
    }

    const markAsRead = useMutation({
        mutationFn: notificationAPI.markAsRead,
        onMutate: (id: string) => {
            queryClient.setQueriesData({ queryKey: ['notifications'] }, (old: NotificationCache) =>
                mapPages(old, (list) => list.map((n) => (n.id === id ? { ...n, isRead: true } : n)))
            )
            queryClient.setQueryData(
                ['notifications-unread-count'],
                (old: { count: number } | undefined) =>
                    old ? { count: Math.max(0, old.count - 1) } : old
            )
        },
        onSettled: refresh,
    })

    const remove = useMutation({
        mutationFn: notificationAPI.deleteNotification,
        onMutate: (id: string) => {
            queryClient.setQueriesData({ queryKey: ['notifications'] }, (old: NotificationCache) =>
                mapPages(old, (list) => list.filter((n) => n.id !== id))
            )
        },
        onSettled: refresh,
    })

    const clearRead = useMutation({
        mutationFn: notificationAPI.deleteAllRead,
        onMutate: () => {
            queryClient.setQueriesData({ queryKey: ['notifications'] }, (old: NotificationCache) =>
                mapPages(old, (list) => list.filter((n) => !n.isRead))
            )
        },
        onSettled: refresh,
    })

    return {
        notifications,
        isLoading: query.isLoading,
        hasNextPage: query.hasNextPage,
        fetchNextPage: query.fetchNextPage,
        isFetchingNextPage: query.isFetchingNextPage,
        markAsRead,
        remove,
        clearRead,
    }
}
