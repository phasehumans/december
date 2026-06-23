import { GenerationSound as GenerationSoundEnum } from './profile.schema'

export type GetInfo = {
    userId: string
}

export type GetProfileCard = {
    userId: string
}

export type GetProfile = {
    userId: string
}

export type UpdateName = {
    userId: string
    name: string
}

export type UpdateUsername = {
    userId: string
    username: string
}

export type UpdateAvatarUrl = {
    userId: string
    avatarUrl: string
}

export type ChangePassword = {
    userId: string
    currentPassword?: string
    newPassword: string
}

export type UpdateNotifications = {
    userId: string
    notifyProjectActivity?: boolean
    notifyProductUpdates?: boolean
    notifySecurityAlerts?: boolean
}

export type Signout = {
    userId: string
    sessionId: string
}

export type SignoutAll = {
    userId: string
}

export type DeleteAccount = {
    userId: string
}

export type ChatSuggestions = {
    userId: string
    chatSuggestions: boolean
}

export type UpdateGenerationSoundPayload = {
    userId: string
    generationSound: GenerationSoundEnum
}

export type Getdesign = {
    userId: string
}

export type Updatedesign = {
    userId: string
    design: string
}

export type Deletedesign = {
    userId: string
}

export type CreateFeedback = {
    userId: string
    rating?: string | null
    feedback: string
}

export type CompleteOnboarding = {
    userId: string
}
