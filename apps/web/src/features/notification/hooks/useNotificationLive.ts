import { useQueryClient } from '@tanstack/react-query'
import React from 'react'
import { io } from 'socket.io-client'

import type { Notification } from '../api/notification'

import { getWebSocketUrl } from '@/shared/config/env'

type LiveNotificationEvent = {
    notification?: Notification
    toast?: boolean
}

// listens for new inbox notifications over the socket (the server joins every socket to a
// user:<id> room). the badge and lists refresh at once; mentions, replies and agent
// questions also come back as a toast. the 30s unread poll stays as the fallback.
export const useNotificationLive = (isAuthenticated: boolean) => {
    const queryClient = useQueryClient()
    const [toast, setToast] = React.useState<Notification | null>(null)

    React.useEffect(() => {
        if (!isAuthenticated) return

        const socket = io(getWebSocketUrl(), {
            path: '/socket.io/',
            withCredentials: true,
            reconnection: true,
            reconnectionAttempts: 10,
            reconnectionDelay: 2000,
            transports: ['websocket', 'polling'],
        })

        const onNotification = (event: LiveNotificationEvent) => {
            queryClient.invalidateQueries({ queryKey: ['notifications'] })
            queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] })
            const next = event?.notification
            if (!event?.toast || !next) return
            // already looking at that session: the question is on screen, no toast
            if (next.link && next.link.startsWith('/') && window.location.pathname === next.link)
                return
            setToast(next)
        }

        socket.on('notification', onNotification)
        return () => {
            socket.off('notification', onNotification)
            socket.disconnect()
        }
    }, [isAuthenticated, queryClient])

    const dismiss = React.useCallback(() => setToast(null), [])

    return { toast, dismiss }
}
