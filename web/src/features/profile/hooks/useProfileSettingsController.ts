import React from 'react'

import { useProfileSettingsData } from './useProfileSettingsData'

export const useProfileSettingsController = () => {
    const [nameModalOpen, setNameModalOpen] = React.useState(false)
    const [tempName, setTempName] = React.useState('')
    const [passwordModalOpen, setPasswordModalOpen] = React.useState(false)
    const [showCurrentPass, setShowCurrentPass] = React.useState(false)
    const [showNewPass, setShowNewPass] = React.useState(false)
    const [currentPassword, setCurrentPassword] = React.useState('')
    const [newPassword, setNewPassword] = React.useState('')
    const [confirmPassword, setConfirmPassword] = React.useState('')
    const [profileActionError, setProfileActionError] = React.useState<string | null>(null)

    const {
        profile,
        profileQuery: {
            isLoading: isProfileLoading,
            isFetching: isProfileFetching,
            error: profileError,
        },
        updateNameMutation,
        updateUsernameMutation,
        updatePasswordMutation,
        updateNotificationMutation,
    } = useProfileSettingsData({
        setProfileActionError,
        onNameMutate: () => {
            setNameModalOpen(false)
        },
        onUsernameMutate: () => {},
        onPasswordSuccess: () => {
            setPasswordModalOpen(false)
            setCurrentPassword('')
            setNewPassword('')
            setConfirmPassword('')
        },
    })

    const isGithubConnected = profile?.githubConnected ?? false
    const emailNotifications = profile?.receiveNotification ?? true
    const resolvedName = profile?.name ?? 'User'

    const openNameModal = () => {
        setProfileActionError(null)
        setTempName(profile?.name ?? '')
        setNameModalOpen(true)
    }

    const openPasswordModal = () => {
        setProfileActionError(null)
        setPasswordModalOpen(true)
    }

    const handleSaveName = () => {
        if (!tempName.trim()) {
            return
        }

        updateNameMutation.mutate({ name: tempName.trim() })
    }

    const handleUpdatePassword = () => {
        if (!newPassword.trim()) {
            setProfileActionError('Please enter a new password')
            return
        }

        if (newPassword !== confirmPassword) {
            setProfileActionError('New password and confirm password do not match')
            return
        }

        setProfileActionError(null)
        updatePasswordMutation.mutate({ password: newPassword })
    }

    const handleNotificationToggle = (value: boolean) => {
        updateNotificationMutation.mutate({
            receiveNotification: value,
        })
    }

    const connectGithub = () => {
        const url =
            `https://github.com/login/oauth/authorize` +
            `?client_id=Ov23liFGkTAwCW7E8gtk` +
            `&scope=repo` +
            `&state=${profile?.id}`

        window.location.href = url
    }

    return {
        profile,
        isProfileLoading,
        isProfileFetching,
        profileError,
        profileActionError,
        nameModalOpen,
        tempName,
        passwordModalOpen,
        showCurrentPass,
        showNewPass,
        currentPassword,
        newPassword,
        confirmPassword,
        setNameModalOpen,
        setTempName,
        setPasswordModalOpen,
        setShowCurrentPass,
        setShowNewPass,
        setCurrentPassword,
        setNewPassword,
        setConfirmPassword,
        updateNameMutation,
        updateUsernameMutation,
        updatePasswordMutation,
        updateNotificationMutation,
        isGithubConnected,
        emailNotifications,
        resolvedName,
        openNameModal,
        openPasswordModal,
        handleSaveName,
        handleUpdatePassword,
        handleNotificationToggle,
        connectGithub,
    }
}
