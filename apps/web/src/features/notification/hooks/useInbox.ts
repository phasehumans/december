import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import React from 'react'

import {
    notificationAPI,
    type InboxFilter,
    type Notification,
    type UnreadCount,
} from '../api/notification'

type NotificationPage = { notifications: Notification[] }
type NotificationCache = { pages: NotificationPage[] } | undefined

const mapPages = (old: NotificationCache, fn: (list: Notification[]) => Notification[]) => {
    if (!old?.pages) return old
    return {
        ...old,
        pages: old.pages.map((p) => ({ ...p, notifications: fn(p.notifications ?? []) })),
    }
}

const findCached = (queryClient: ReturnType<typeof useQueryClient>, id: string) => {
    for (const [, data] of queryClient.getQueriesData<NotificationCache>({
        queryKey: ['notifications'],
    })) {
        const hit = data?.pages?.flatMap((p) => p.notifications ?? []).find((n) => n.id === id)
        if (hit) return hit
    }
    return undefined
}

// inbox data for the desktop popover and the mobile inbox sheet. every filter lives under
// the ['notifications', filter] key, so reads and deletes stay in sync with the unread badge
export const useInbox = (enabled: boolean, filter: InboxFilter = 'all') => {
    const queryClient = useQueryClient()

    const query = useInfiniteQuery({
        queryKey: ['notifications', filter],
        queryFn: ({ pageParam = 1 }) =>
            notificationAPI.getNotifications({
                page: pageParam,
                limit: 20,
                ...(filter === 'mentions' ? { category: 'MENTION' as const } : {}),
            }),
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
            const cached = findCached(queryClient, id)
            const wasUnread = cached ? !cached.isRead : true
            queryClient.setQueriesData({ queryKey: ['notifications'] }, (old: NotificationCache) =>
                mapPages(old, (list) => list.map((n) => (n.id === id ? { ...n, isRead: true } : n)))
            )
            if (!wasUnread) return
            // keep the { count, mentions } shape: the badge reads .count
            queryClient.setQueryData(
                ['notifications-unread-count'],
                (old: UnreadCount | undefined) =>
                    old
                        ? {
                              count: Math.max(0, old.count - 1),
                              mentions:
                                  cached?.category === 'MENTION'
                                      ? Math.max(0, (old.mentions ?? 0) - 1)
                                      : old.mentions,
                          }
                        : old
            )
        },
        onSettled: refresh,
    })

    const markAllAsRead = useMutation({
        mutationFn: notificationAPI.markAllAsRead,
        onMutate: () => {
            queryClient.setQueriesData({ queryKey: ['notifications'] }, (old: NotificationCache) =>
                mapPages(old, (list) => list.map((n) => ({ ...n, isRead: true })))
            )
            queryClient.setQueryData(['notifications-unread-count'], { count: 0, mentions: 0 })
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
        markAllAsRead,
        remove,
        clearRead,
    }
}
