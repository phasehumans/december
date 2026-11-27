import { useQueryClient } from '@tanstack/react-query'
import React from 'react'
import { useLocation } from 'react-router-dom'

import { notificationAPI } from '../api/notification'

// /sessions/<id>, and the older /session/<id> that some inbox links still have
const SESSION_PATH = /^\/sessions?\/([^/?#]+)\/?$/

/** the session of a web path, or null */
export const sessionIdFromPath = (pathname: string): string | null =>
    pathname.match(SESSION_PATH)?.[1] ?? null

/**
 * N6: while a session is open, its inbox items are read. Runs when the open session
 * changes; the live hook does the same for an item that comes in while it is open.
 */
export const useMarkSessionRead = (isAuthenticated: boolean) => {
    const queryClient = useQueryClient()
    const { pathname } = useLocation()
    const sessionId = isAuthenticated ? sessionIdFromPath(pathname) : null

    React.useEffect(() => {
        if (!sessionId) return
        let isCurrent = true
        notificationAPI
            .markSessionRead(sessionId)
            .then((result) => {
                if (!isCurrent || !result || result.updated === 0) return
                queryClient.invalidateQueries({ queryKey: ['notifications'] })
                queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] })
            })
            .catch((error: unknown) => {
                // the items stay unread; the user can still read them in the inbox
                console.warn('[inbox] could not mark the session read:', error)
            })
        return () => {
            isCurrent = false
        }
    }, [sessionId, queryClient])
}
