import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'

import { profileAPI } from '@/features/profile/api/profile'

export const GITLAB_STATUS_KEY = ['integrations', 'gitlab'] as const

// the server sends a failed connect back with ?gitlab=error or ?gitlab=in_use
const CONNECT_ERRORS: Record<string, string> = {
    error: 'GitLab did not connect. Try again.',
    in_use: 'This GitLab account is connected to another December account.',
}

const readConnectError = (): string | null => {
    if (typeof window === 'undefined') return null
    const reason = new URLSearchParams(window.location.search).get('gitlab')
    return reason ? (CONNECT_ERRORS[reason] ?? null) : null
}

/**
 * Whether GitLab can be connected (the server has the GitLab app) and whether it is.
 * `available` is false while loading, so a GitLab button never flashes on. A failed
 * status request counts as an answer: GitLab is then treated as not available.
 */
export const useGitlabConnection = (enabled = true) => {
    const [connectError] = useState(readConnectError)
    const status = useQuery({
        queryKey: GITLAB_STATUS_KEY,
        queryFn: profileAPI.getGitlabStatus,
        enabled,
        staleTime: 60 * 1000,
        retry: false,
    })

    return {
        isReady: status.isSuccess || status.isError,
        isAvailable: Boolean(status.data?.available),
        isConnected: Boolean(status.data?.connected),
        username: status.data?.username ?? null,
        connectUrl: (returnPath?: string) => profileAPI.getGitlabConnectUrl(returnPath),
        /** why the last connect failed, from the page address; null when it did not */
        connectError,
    }
}
