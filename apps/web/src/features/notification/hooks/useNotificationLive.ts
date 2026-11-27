import { useQueryClient } from '@tanstack/react-query'
import React from 'react'
import { io } from 'socket.io-client'

import { notificationAPI, type Notification } from '../api/notification'

import { sessionIdFromPath } from './useMarkSessionRead'

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
            if (!next) return
            // already looking at that session: it is on screen, so no toast, and read (N6)
            const openSession = sessionIdFromPath(window.location.pathname)
            if (openSession && next.link && sessionIdFromPath(next.link) === openSession) {
                notificationAPI
                    .markSessionRead(openSession)
                    .then(() => {
                        queryClient.invalidateQueries({ queryKey: ['notifications'] })
                        queryClient.invalidateQueries({
                            queryKey: ['notifications-unread-count'],
                        })
                    })
                    .catch((error: unknown) => {
                        // the item stays unread in the inbox
                        console.warn('[inbox] could not mark the open session read:', error)
                    })
                return
            }
            if (!event?.toast) return
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
