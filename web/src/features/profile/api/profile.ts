import { apiRequest } from '@/shared/api/client'

export type Profile = {
    id: string
    name: string
    email: string
    createdAt: string
    updatedAt: string
    emailVerified: boolean
    receiveNotification: boolean
    googleId: string | null
    githubConnected: boolean
    githubUsername?: string
    notifyProjectActivity?: boolean
    notifyProductUpdates?: boolean
    notifySecurityAlerts?: boolean
    chatSuggestions?: boolean
    generationSound?: 'FIRST_GENERATION' | 'ALWAYS' | 'NEVER'
}

type BackendProfile = Profile

export type QuickInfo = {
    firstName: string
    githubConnected: boolean
}

type BackendQuickInfo = {
    firstName: string
    isGithubConnected: boolean
}

type UpdateNameInput = {
    name: string
}

type UpdateUsernameInput = {
    username: string
}

type ChangePasswordInput = {
    password: string
}

type UpdateNotificationInput = {
    notifyProjectActivity?: boolean
    notifyProductUpdates?: boolean
    notifySecurityAlerts?: boolean
}

type UpdateChatSuggestionsInput = {
    chatSuggestions: boolean
}

type UpdateGenerationSoundInput = {
    generationSound: 'FIRST_GENERATION' | 'ALWAYS' | 'NEVER'
}

const getProfile = () => {
    return apiRequest<BackendProfile>('/profile')
}

const updateName = (data: UpdateNameInput) => {
    return apiRequest<BackendProfile>('/profile/name', {
        method: 'PATCH',
        body: JSON.stringify(data),
    })
}

const updateUsername = (data: UpdateUsernameInput) => {
    return apiRequest<BackendProfile>('/profile/username', {
        method: 'PATCH',
        body: JSON.stringify(data),
    })
}

const changePassword = (data: ChangePasswordInput) => {
    return apiRequest<BackendProfile>('/profile/password', {
        method: 'PATCH',
        body: JSON.stringify(data),
    })
}

const updateNotifications = (data: UpdateNotificationInput) => {
    return apiRequest<BackendProfile>('/profile/notifications', {
        method: 'PATCH',
        body: JSON.stringify(data),
    })
}

const updateChatSuggestions = (data: UpdateChatSuggestionsInput) => {
    return apiRequest<BackendProfile>('/profile/suggestions', {
        method: 'POST',
        body: JSON.stringify(data),
    })
}

const updateGenerationSound = (data: UpdateGenerationSoundInput) => {
    return apiRequest<BackendProfile>('/profile/sound', {
        method: 'POST',
        body: JSON.stringify(data),
    })
}

const getQuickInfo = () => {
    return apiRequest<BackendQuickInfo>('/profile/info').then((info) => ({
        firstName: info.firstName,
        githubConnected: info.isGithubConnected,
    }))
}

const signout = () => {
    return apiRequest<void>('/profile/signout', {
        method: 'POST',
    })
}

const signoutAll = () => {
    return apiRequest<void>('/profile/signout/all', {
        method: 'POST',
    })
}

const deleteAccount = () => {
    return apiRequest<void>('/profile', {
        method: 'DELETE',
    })
}

export const profileAPI = {
    getProfile,
    updateName,
    updateUsername,
    changePassword,
    updateNotifications,
    updateChatSuggestions,
    updateGenerationSound,
    getQuickInfo,
    signout,
    signoutAll,
    deleteAccount,
}
