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
}

export type QuickInfo = {
    firstName: string
    githubConnected: boolean
}

type UpdateNameInput = {
    name: string
}

type ChangePasswordInput = {
    password: string
}

type updateNotificationInput = {
    receiveNotification: boolean
}

const getProfile = () => {
    return apiRequest<Profile>('/profile')
}

const updateName = (data: UpdateNameInput) => {
    return apiRequest<Profile>('/profile/update-name', {
        method: 'PATCH',
        body: JSON.stringify(data),
    })
}

const changePassword = (data: ChangePasswordInput) => {
    return apiRequest<Profile>('/profile/change-password', {
        method: 'PATCH',
        body: JSON.stringify(data),
    })
}

const updateNotification = (data: updateNotificationInput) => {
    return apiRequest<Profile>('/profile/notification', {
        method: 'PATCH',
        body: JSON.stringify(data),
    })
}

//     updateNotification,
// }

const getQuickInfo = () => {
    return apiRequest<QuickInfo>('/profile/quickinfo')
}

export const profileAPI = {
    getProfile,
    updateName,
    changePassword,
    updateNotification,
    getQuickInfo,
}
