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

type BackendProfile = Omit<Profile, 'receiveNotification'> & {
    notifyProjectActivity?: boolean
    notifyProductUpdates?: boolean
    notifySecurityAlerts?: boolean
}

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

type ChangePasswordInput = {
    password: string
}

type updateNotificationInput = {
    receiveNotification: boolean
}

const getProfile = () => {
    return apiRequest<BackendProfile>('/profile').then((profile) => ({
        ...profile,
        receiveNotification: profile.notifySecurityAlerts ?? true,
    }))
}

const updateName = (data: UpdateNameInput) => {
    return apiRequest<BackendProfile>('/profile/name', {
        method: 'PATCH',
        body: JSON.stringify(data),
    }).then((profile) => ({
        ...profile,
        receiveNotification: profile.notifySecurityAlerts ?? true,
    }))
}

const changePassword = (data: ChangePasswordInput) => {
    return apiRequest<BackendProfile>('/profile/password', {
        method: 'PATCH',
        body: JSON.stringify(data),
    }).then((profile) => ({
        ...profile,
        receiveNotification: profile.notifySecurityAlerts ?? true,
    }))
}

const updateNotification = (data: updateNotificationInput) => {
    return apiRequest<BackendProfile>('/profile/notifications', {
        method: 'PATCH',
        body: JSON.stringify({
            notifyProjectActivity: data.receiveNotification,
            notifyProductUpdates: data.receiveNotification,
            notifySecurityAlerts: data.receiveNotification,
        }),
    }).then((profile) => ({
        ...profile,
        receiveNotification: profile.notifySecurityAlerts ?? true,
    }))
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

export const profileAPI = {
    getProfile,
    updateName,
    changePassword,
    updateNotification,
    getQuickInfo,
    signout,
}
