import { apiRequest } from './client'

export type Profile = {
    id: string
    name: string
    email: string
    createdAt: string
    updatedAt: string
    emailVerified: boolean
    googleId: string | null
}

type UpdateNameInput = {
    name: string
}

type ChangePasswordInput = {
    password: string
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

export const profileAPI = {
    getProfile,
    updateName,
    changePassword,
}
