import { useQuery } from '@tanstack/react-query'

import { profileAPI } from '@/features/profile/api/profile'

export const GITLAB_STATUS_KEY = ['integrations', 'gitlab'] as const

/**
 * Whether GitLab can be connected (the server has the GitLab app) and whether it is.
 * `available` is false while loading, so a GitLab button never flashes on. A failed
 * status request counts as an answer: GitLab is then treated as not available.
 */
export const useGitlabConnection = (enabled = true) => {
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
    }
}
