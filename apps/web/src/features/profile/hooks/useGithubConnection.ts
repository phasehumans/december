import { useQuery } from '@tanstack/react-query'

import { profileAPI } from '@/features/profile/api/profile'

/**
 * Whether the user has connected GitHub. `isReady` is false until both answers are in,
 * so a "not connected" hint never shows for a moment to a user who is connected.
 */
export const useGithubConnection = (enabled: boolean) => {
    const profile = useQuery({
        queryKey: ['profile'],
        queryFn: profileAPI.getProfile,
        enabled,
    })
    const quickInfo = useQuery({
        queryKey: ['quickinfo'],
        queryFn: profileAPI.getQuickInfo,
        enabled,
    })

    const isReady =
        enabled && profile.data !== undefined && !profile.isFetching && !quickInfo.isLoading
    const isConnected = Boolean(
        profile.data?.githubAppInstall ||
        profile.data?.githubConnected ||
        quickInfo.data?.githubConnected
    )

    return {
        isReady,
        isConnected,
        connectUrl: profileAPI.getGithubConnectUrl(profile.data?.id || ''),
    }
}
