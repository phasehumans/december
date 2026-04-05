import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { profileAPI } from '@/features/profile/api/profile'
import type { Profile } from '@/features/profile/types'

const profileQueryKey = ['profile'] as const

type UseProfileSettingsDataOptions = {
    setProfileActionError: (message: string | null) => void
    onNameMutate: () => void
    onPasswordSuccess: () => void
}

const getErrorMessage = (error: unknown, fallback: string) => {
    if (error instanceof Error) {
        return error.message
    }

    return fallback
}

export const useProfileSettingsData = ({
    setProfileActionError,
    onNameMutate,
    onPasswordSuccess,
}: UseProfileSettingsDataOptions) => {
    const queryClient = useQueryClient()

    const profileQuery = useQuery({
        queryKey: profileQueryKey,
        queryFn: profileAPI.getProfile,
        placeholderData: (previousData) => previousData,
    })

    const profile = profileQuery.data

    const updateNameMutation = useMutation({
        mutationFn: profileAPI.updateName,
        onMutate: async ({ name }) => {
            setProfileActionError(null)
            await queryClient.cancelQueries({ queryKey: profileQueryKey })

            const previousProfile = queryClient.getQueryData<Profile>(profileQueryKey)

            queryClient.setQueryData<Profile>(profileQueryKey, (currentProfile) =>
                currentProfile ? { ...currentProfile, name } : currentProfile
            )

            onNameMutate()

            return { previousProfile }
        },
        onError: (error, _variables, context) => {
            if (context?.previousProfile) {
                queryClient.setQueryData(profileQueryKey, context.previousProfile)
            }

            setProfileActionError(getErrorMessage(error, 'Failed to update name'))
        },
        onSuccess: () => {
            setProfileActionError(null)
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: profileQueryKey })
        },
    })

    const updatePasswordMutation = useMutation({
        mutationFn: profileAPI.changePassword,
        onSuccess: () => {
            setProfileActionError(null)
            onPasswordSuccess()
        },
        onError: (error) => {
            setProfileActionError(getErrorMessage(error, 'Failed to update password'))
        },
    })

    const updateNotificationMutation = useMutation({
        mutationFn: profileAPI.updateNotification,
        onMutate: async ({ receiveNotification }) => {
            setProfileActionError(null)

            await queryClient.cancelQueries({ queryKey: profileQueryKey })

            const previousProfile = queryClient.getQueryData<Profile>(profileQueryKey)

            queryClient.setQueryData<Profile>(profileQueryKey, (currentProfile) =>
                currentProfile ? { ...currentProfile, receiveNotification } : currentProfile
            )

            return { previousProfile }
        },
        onError: (error, _variables, context) => {
            if (context?.previousProfile) {
                queryClient.setQueryData(profileQueryKey, context.previousProfile)
            }

            setProfileActionError(getErrorMessage(error, 'Failed to update notifications'))
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: profileQueryKey })
        },
    })

    return {
        profile,
        profileQuery,
        updateNameMutation,
        updatePasswordMutation,
        updateNotificationMutation,
    }
}
