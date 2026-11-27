import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'

import { profileAPI } from '@/features/profile/api/profile'

// the server sends an install it could not link back with ?github=<reason>
const CONNECT_ERRORS: Record<string, string> = {
    in_use: 'This GitHub install is connected to another December account.',
    unverified:
        'December could not confirm this GitHub install. Remove the December app on GitHub, then connect again.',
    signed_out: 'You were signed out. Sign in, then connect GitHub again.',
    requested: 'GitHub sent your request to the organization owner to approve.',
}

/** why the last GitHub connect failed, from the page address; null when it did not */
export const readGithubConnectError = (): string | null => {
    if (typeof window === 'undefined') return null
    const reason = new URLSearchParams(window.location.search).get('github')
    return reason ? (CONNECT_ERRORS[reason] ?? null) : null
}

/**
 * Whether the user has connected GitHub. `isReady` is false until both answers are in,
 * so a "not connected" hint never shows for a moment to a user who is connected.
 */
export const useGithubConnection = (enabled: boolean) => {
    const [connectError] = useState(readGithubConnectError)
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
        /** why the last connect failed, from the page address; null when it did not */
        connectError,
    }
}
