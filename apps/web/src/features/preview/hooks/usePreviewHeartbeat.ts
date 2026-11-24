import { useEffect } from 'react'

import { apiRequest } from '@/shared/api/client'

// under the 10 minute idle pause, with room for a missed ping
export const PREVIEW_HEARTBEAT_MS = 2 * 60 * 1000

/**
 * The preview frame talks to the sandbox directly, so the server never sees it in use.
 * While a live preview is on screen, tell the server every 2 minutes, so the sandbox
 * is not paused as idle (#624 part 4).
 */
export const usePreviewHeartbeat = (data: { sessionId?: string | null; active: boolean }) => {
    const { sessionId, active } = data

    useEffect(() => {
        if (!sessionId || !active) return

        const ping = () => {
            if (document.visibilityState !== 'visible') return
            apiRequest(`/session/${sessionId}/preview-activity`, { method: 'POST' }).catch(
                (err) => {
                    // a missed ping only shortens the idle window; the next one tries again
                    console.warn('Preview activity ping failed', err)
                }
            )
        }

        ping()
        const timer = setInterval(ping, PREVIEW_HEARTBEAT_MS)
        document.addEventListener('visibilitychange', ping)
        return () => {
            clearInterval(timer)
            document.removeEventListener('visibilitychange', ping)
        }
    }, [sessionId, active])
}
