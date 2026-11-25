import React from 'react'

import { useProfileSettingsData } from './useProfileSettingsData'

import { profileAPI, type UpdateNotificationInput } from '@/features/profile/api/profile'

export const useProfileSettingsController = () => {
    const [nameModalOpen, setNameModalOpen] = React.useState(false)
    const [tempName, setTempName] = React.useState('')
    const [profileActionError, setProfileActionError] = React.useState<string | null>(null)

    const {
        profile,
        profileQuery: {
            isLoading: isProfileLoading,
            isFetching: isProfileFetching,
            error: profileError,
        },
        updateNameMutation,
        updateNotificationMutation,
    } = useProfileSettingsData({
        setProfileActionError,
        onNameMutate: () => {},
        onNameSuccess: () => {
            setNameModalOpen(false)
        },
    })

    const isGithubConnected = Boolean(profile?.githubAppInstall || profile?.githubConnected)
    const resolvedName = profile?.name ?? 'User'

    const openNameModal = () => {
        setProfileActionError(null)
        setTempName(profile?.name ?? '')
        setNameModalOpen(true)
    }

    const handleSaveName = () => {
        if (!tempName.trim()) {
            return
        }

        updateNameMutation.mutate({ name: tempName.trim() })
    }

    // one or more notification settings (#636); the profile updates at once and rolls back
    // on an error
    const handleNotificationChange = (settings: UpdateNotificationInput) => {
        updateNotificationMutation.mutate(settings)
    }

    const redirectToIntegration = (getUrl: (userId: string) => string) => {
        setProfileActionError(null)
        window.location.href = getUrl(profile?.id || '')
    }

    const connectGithub = () => {
        redirectToIntegration(profileAPI.getGithubConnectUrl)
    }

    return {
        profile,
        isProfileLoading,
        isProfileFetching,
        profileError,
        profileActionError,
        setProfileActionError,
        nameModalOpen,
        tempName,
        setNameModalOpen,
        setTempName,
        updateNameMutation,
        updateNotificationMutation,
        isGithubConnected,
        resolvedName,
        openNameModal,
        handleSaveName,
        handleNotificationChange,
        connectGithub,
    }
}
