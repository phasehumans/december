import bcrypt from 'bcrypt'

import { prisma } from '../../config/db'
import { AppError } from '../../shared/appError'

import type { GenerationSound } from './profile.schema'

export const profileSelect = {
    id: true,
    name: true,
    username: true,
    email: true,
    createdAt: true,
    updatedAt: true,
    emailVerified: true,
    googleId: true,
    githubConnected: true,
    githubUsername: true,
    vercelConnected: true,
    vercelTeamId: true,
    vercelConfigurationId: true,
    supabaseConnected: true,
    supabaseUserId: true,
    supabaseConnectedAt: true,
    notionWorkspaceId: true,
    notionWorkspaceName: true,
    figmaConnected: true,
    notifyProjectActivity: true,
    notifyProductUpdates: true,
    notifySecurityAlerts: true,
    chatSuggestions: true,
    generationSound: true,
    skills: true,
    avatarUrl: true,
    subscriptionPlan: true,
    subscriptionStatus: true,
    isDeleted: true,
}

type UpdateName = {
    userId: string
    name: string
}

type UpdateUsername = {
    userId: string
    username: string
}

type UpdateAvatarUrl = {
    userId: string
    avatarUrl: string
}

type ChangePassword = {
    userId: string
    currentPassword: string
    newPassword: string
}

type UpdateNotification = {
    userId: string
    notifyProjectActivity?: boolean
    notifyProductUpdates?: boolean
    notifySecurityAlerts?: boolean
}

type Signout = {
    userId: string
    sessionId: string
}

type SignoutAll = {
    userId: string
}

type DeleteAccount = {
    userId: string
}

type ChatSuggestions = {
    userId: string
    chatSuggestions: boolean
}

type GenerationSoundType = {
    userId: string
    generationSound: GenerationSound
}

type UpdateSkills = {
    userId: string
    skills: string
}

const getInfo = async (data: string) => {
    const profile = await prisma.user.findUnique({
        where: {
            id: data,
        },
        select: {
            name: true,
            githubConnected: true,
            isDeleted: true,
        },
    })

    if (!profile || profile.isDeleted === true) {
        throw new AppError('user not found', 404)
    }

    const firstName = profile.name || 'Profile'
    const isGithubConnected = profile.githubConnected

    return { firstName, isGithubConnected }
}

const getProfileCard = async (data: string) => {
    const profile = await prisma.user.findUnique({
        where: {
            id: data,
        },
        select: {
            id: true,
            name: true,
            username: true,
            email: true,
            avatarUrl: true,
            createdAt: true,
            isDeleted: true,
        },
    })

    if (!profile || profile.isDeleted === true) {
        throw new AppError('user not found', 404)
    }

    const { isDeleted, ...rest } = profile
    return rest
}

const getProfile = async (data: string) => {
    const profile = await prisma.user.findUnique({
        where: {
            id: data,
        },
        select: profileSelect,
    })

    if (!profile || profile.isDeleted === true) {
        throw new AppError('user not found', 404)
    }

    return profile
}

const updateName = async (data: UpdateName) => {
    const { name, userId } = data

    const existingUser = await prisma.user.findUnique({
        where: {
            id: userId,
        },
        select: {
            id: true,
            isDeleted: true,
        },
    })

    if (!existingUser || existingUser.isDeleted === true) {
        throw new AppError('user not found', 404)
    }

    const updatedUser = await prisma.user.update({
        where: {
            id: userId,
        },
        data: {
            name: name,
        },
        select: {
            name: true,
        },
    })

    return updatedUser
}

const updateUsername = async (data: UpdateUsername) => {
    const { userId, username } = data

    const existingUser = await prisma.user.findUnique({
        where: {
            id: userId,
        },
        select: {
            id: true,
            username: true,
            isDeleted: true,
        },
    })

    if (!existingUser || existingUser.isDeleted === true) {
        throw new AppError('user not found', 404)
    }

    if (username === existingUser.username) {
        throw new AppError('new username must be different from the current one', 400)
    }

    const existingUsername = await prisma.user.findUnique({
        where: {
            username: username,
        },
        select: {
            id: true,
        },
    })

    if (existingUsername) {
        throw new AppError(`${username} is already taken, try another one`, 409)
    }

    try {
        const updatedUser = await prisma.user.update({
            where: {
                id: userId,
            },
            data: {
                username: username,
            },
            select: {
                username: true,
            },
        })

        return updatedUser
    } catch (error: any) {
        // race condition safety
        if (error.code === 'P2002') {
            throw new AppError(`${username} is already taken, try another one`, 409)
        }

        throw error
    }
}

const updateAvatarUrl = async (data: UpdateAvatarUrl) => {
    const { userId, avatarUrl } = data

    const existingUser = await prisma.user.findUnique({
        where: {
            id: userId,
        },
        select: {
            id: true,
            isDeleted: true,
        },
    })

    if (!existingUser || existingUser.isDeleted === true) {
        throw new AppError('user not found', 404)
    }

    const updatedUser = await prisma.user.update({
        where: {
            id: userId,
        },
        data: {
            avatarUrl: avatarUrl,
        },
        select: {
            avatarUrl: true,
        },
    })

    return updatedUser
}

const changePassword = async (data: ChangePassword) => {
    const { currentPassword, newPassword, userId } = data

    const existingUser = await prisma.user.findUnique({
        where: {
            id: userId,
        },
        select: {
            id: true,
            password: true,
            isDeleted: true,
        },
    })

    if (!existingUser || existingUser.isDeleted === true) {
        throw new AppError('user not found', 404)
    }

    if (!existingUser.password) {
        throw new AppError('password is not set for this account', 400)
    }

    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, existingUser.password)

    if (!isCurrentPasswordValid) {
        throw new AppError('current password is incorrect', 401)
    }

    const isSamePassword = await bcrypt.compare(newPassword, existingUser.password)

    if (isSamePassword) {
        throw new AppError('new password must be different from current password', 400)
    }

    const hashPassword = await bcrypt.hash(newPassword, 10)

    await prisma.user.update({
        where: {
            id: userId,
        },
        data: {
            password: hashPassword,
        },
        select: {
            id: true,
        },
    })

    return { success: true }
}

const updateNotifications = async (data: UpdateNotification) => {
    const { userId, notifyProductUpdates, notifyProjectActivity, notifySecurityAlerts } = data

    const existingUser = await prisma.user.findUnique({
        where: {
            id: userId,
        },
        select: {
            id: true,
            isDeleted: true,
        },
    })

    if (!existingUser || existingUser.isDeleted === true) {
        throw new AppError('user not found', 404)
    }

    const updateData: {
        notifyProjectActivity?: boolean
        notifyProductUpdates?: boolean
        notifySecurityAlerts?: boolean
    } = {}

    if (notifyProjectActivity !== undefined) {
        updateData.notifyProjectActivity = notifyProjectActivity
    }

    if (notifyProductUpdates !== undefined) {
        updateData.notifyProductUpdates = notifyProductUpdates
    }

    if (notifySecurityAlerts !== undefined) {
        updateData.notifySecurityAlerts = notifySecurityAlerts
    }

    if (Object.keys(updateData).length === 0) {
        throw new AppError('at least one notification setting must be provided', 400)
    }

    const updatedUser = await prisma.user.update({
        where: {
            id: userId,
        },
        data: updateData,
        select: {
            notifyProjectActivity: true,
            notifyProductUpdates: true,
            notifySecurityAlerts: true,
        },
    })

    return updatedUser
}

const signout = async (data: Signout) => {
    const { userId, sessionId } = data

    const existingSession = await prisma.session.findFirst({
        where: {
            id: sessionId,
            userId,
            isRevoked: false,
        },
    })

    if (!existingSession) {
        // optional: don't throw, just silently succeed
        return
    }

    await prisma.session.update({
        where: {
            id: sessionId,
        },
        data: {
            isRevoked: true,
            revokedAt: new Date(),
        },
    })
}

const signoutAll = async (data: SignoutAll) => {
    const { userId } = data

    await prisma.session.updateMany({
        where: {
            userId,
            isRevoked: false,
        },
        data: {
            isRevoked: true,
            revokedAt: new Date(),
        },
    })
}

const deleteAccount = async (data: DeleteAccount) => {
    const { userId } = data

    const existingUser = await prisma.user.findUnique({
        where: {
            id: userId,
        },
        select: {
            id: true,
            isDeleted: true,
        },
    })

    if (!existingUser) {
        throw new AppError('user not found', 404)
    }

    if (existingUser.isDeleted) {
        throw new AppError('user account is already deleted', 409)
    }

    await prisma.$transaction([
        prisma.session.updateMany({
            where: {
                userId,
                isRevoked: false,
            },
            data: {
                isRevoked: true,
                revokedAt: new Date(),
            },
        }),

        prisma.user.update({
            where: {
                id: userId,
            },
            data: {
                isDeleted: true,
                deletedAt: new Date(),
            },
            select: {
                id: true,
            },
        }),
    ])
}

const chatSuggestions = async (data: ChatSuggestions) => {
    const { userId, chatSuggestions } = data

    const existingUser = await prisma.user.findUnique({
        where: {
            id: userId,
        },
        select: {
            id: true,
            chatSuggestions: true,
            isDeleted: true,
        },
    })

    if (!existingUser || existingUser.isDeleted === true) {
        throw new AppError('user not found', 404)
    }

    if (existingUser.chatSuggestions === chatSuggestions) {
        throw new AppError(
            'new input must be different from the current chat suggestion state',
            400
        )
    }

    const updatedUser = await prisma.user.update({
        where: {
            id: userId,
        },
        data: {
            chatSuggestions: chatSuggestions,
        },
        select: {
            chatSuggestions: true,
        },
    })

    return updatedUser
}

const generationSound = async (data: GenerationSoundType) => {
    const { userId, generationSound } = data

    const existingUser = await prisma.user.findUnique({
        where: {
            id: userId,
        },
        select: {
            id: true,
            generationSound: true,
            isDeleted: true,
        },
    })

    if (!existingUser || existingUser.isDeleted === true) {
        throw new AppError('user not found', 404)
    }

    if (existingUser.generationSound === generationSound) {
        throw new AppError(
            'new input must be different from the current generation sound state',
            400
        )
    }

    const updatedUser = await prisma.user.update({
        where: {
            id: userId,
        },
        data: {
            generationSound: generationSound,
        },
        select: {
            generationSound: true,
        },
    })

    return updatedUser
}

const getSkills = async (userId: string) => {
    const user = await prisma.user.findUnique({
        where: {
            id: userId,
        },
        select: {
            skills: true,
            isDeleted: true,
        },
    })

    if (!user || user.isDeleted === true) {
        throw new AppError('user not found', 404)
    }

    return { skills: user.skills }
}

const updateSkills = async (data: UpdateSkills) => {
    const { userId, skills } = data

    const existingUser = await prisma.user.findUnique({
        where: {
            id: userId,
        },
        select: {
            id: true,
            isDeleted: true,
        },
    })

    if (!existingUser || existingUser.isDeleted === true) {
        throw new AppError('user not found', 404)
    }

    const updatedUser = await prisma.user.update({
        where: {
            id: userId,
        },
        data: {
            skills,
        },
        select: {
            skills: true,
        },
    })

    return { skills: updatedUser.skills }
}

const deleteSkills = async (userId: string) => {
    const existingUser = await prisma.user.findUnique({
        where: {
            id: userId,
        },
        select: {
            id: true,
            isDeleted: true,
        },
    })

    if (!existingUser || existingUser.isDeleted === true) {
        throw new AppError('user not found', 404)
    }

    await prisma.user.update({
        where: {
            id: userId,
        },
        data: {
            skills: null,
        },
        select: {
            id: true,
        },
    })
}

export const profileService = {
    getInfo,
    getProfileCard,
    getProfile,
    updateName,
    updateUsername,
    updateAvatarUrl,
    changePassword,
    updateNotifications,
    signout,
    signoutAll,
    deleteAccount,
    chatSuggestions,
    generationSound,
    getSkills,
    updateSkills,
    deleteSkills,
}
