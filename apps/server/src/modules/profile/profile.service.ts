import bcrypt from 'bcrypt'

import { prisma } from '@december/database'
import { AppError } from '../../shared/appError'

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
    notifyProjectActivity: true,
    notifyProductUpdates: true,
    notifySecurityAlerts: true,
    chatSuggestions: true,
    generationSound: true,
    design: true,
    avatarUrl: true,
    subscriptionPlan: true,
    subscriptionStatus: true,
    isDeleted: true,
    hasCompletedOnboarding: true,
}

import type {
    GetInfo,
    GetProfileCard,
    GetProfile,
    UpdateName,
    UpdateUsername,
    UpdateAvatarUrl,
    ChangePassword,
    UpdateNotifications,
    Signout,
    SignoutAll,
    DeleteAccount,
    ChatSuggestions,
    UpdateGenerationSoundPayload,
    Getdesign,
    Updatedesign,
    Deletedesign,
    CreateFeedback,
    CompleteOnboarding,
} from '@december/shared'

const getInfo = async (data: GetInfo) => {
    const { userId } = data
    const profile = await prisma.user.findUnique({
        where: {
            id: userId,
        },
        select: {
            name: true,
            githubConnected: true,
        },
    })

    if (!profile) {
        throw new AppError('user not found', 404)
    }

    const fullName = profile.name || 'Profile'
    const isGithubConnected = profile.githubConnected

    return { fullName, isGithubConnected }
}

const getProfileCard = async (data: GetProfileCard) => {
    const { userId } = data
    const profile = await prisma.user.findUnique({
        where: {
            id: userId,
        },
        select: {
            id: true,
            name: true,
            username: true,
            email: true,
            avatarUrl: true,
            createdAt: true,
        },
    })

    if (!profile) {
        throw new AppError('user not found', 404)
    }

    return profile
}

const getProfile = async (data: GetProfile) => {
    const { userId } = data
    const profile = await prisma.user.findUnique({
        where: {
            id: userId,
        },
        select: {
            ...profileSelect,
            password: true,
        },
    })

    if (!profile) {
        throw new AppError('user not found', 404)
    }

    const { password, ...rest } = profile
    return {
        ...rest,
        hasPassword: password !== null,
    }
}

const updateName = async (data: UpdateName) => {
    const { name, userId } = data

    const existingUser = await prisma.user.findUnique({
        where: {
            id: userId,
        },
        select: {
            id: true,
        },
    })

    if (!existingUser) {
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
        },
    })

    if (!existingUser) {
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
        },
    })

    if (!existingUser) {
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
        },
    })

    if (!existingUser) {
        throw new AppError('user not found', 404)
    }

    if (!existingUser.password) {
        // OAuth only user setting password for the first time
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

    if (!currentPassword) {
        throw new AppError('current password is required', 400)
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

const updateNotifications = async (data: UpdateNotifications) => {
    const { userId, notifyProductUpdates, notifyProjectActivity, notifySecurityAlerts } = data

    const existingUser = await prisma.user.findUnique({
        where: {
            id: userId,
        },
        select: {
            id: true,
        },
    })

    if (!existingUser) {
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
                githubToken: null,
                githubConnected: false,
                githubUsername: null,
                vercelAccessToken: null,
                vercelConnected: false,
                vercelTeamId: null,
                vercelConfigurationId: null,
                supabaseConnected: false,
                supabaseAccessToken: null,
                supabaseRefreshToken: null,
                supabaseTokenExpiresAt: null,
                supabaseTokenScope: null,
                supabaseUserId: null,
                supabaseConnectedAt: null,
                notionAccessToken: null,
                notionWorkspaceId: null,
                notionWorkspaceName: null,
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
        },
    })

    if (!existingUser) {
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

const generationSound = async (data: UpdateGenerationSoundPayload) => {
    const { userId, generationSound } = data

    const existingUser = await prisma.user.findUnique({
        where: {
            id: userId,
        },
        select: {
            id: true,
            generationSound: true,
        },
    })

    if (!existingUser) {
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

const getdesign = async (data: Getdesign) => {
    const { userId } = data
    const user = await prisma.user.findUnique({
        where: {
            id: userId,
        },
        select: {
            design: true,
        },
    })

    if (!user) {
        throw new AppError('user not found', 404)
    }

    return { design: user.design }
}

const updatedesign = async (data: Updatedesign) => {
    const { userId, design } = data

    const existingUser = await prisma.user.findUnique({
        where: {
            id: userId,
        },
        select: {
            id: true,
        },
    })

    if (!existingUser) {
        throw new AppError('user not found', 404)
    }

    const updatedUser = await prisma.user.update({
        where: {
            id: userId,
        },
        data: {
            design,
        },
        select: {
            design: true,
        },
    })

    return { design: updatedUser.design }
}

const deletedesign = async (data: Deletedesign) => {
    const { userId } = data
    const existingUser = await prisma.user.findUnique({
        where: {
            id: userId,
        },
        select: {
            id: true,
        },
    })

    if (!existingUser) {
        throw new AppError('user not found', 404)
    }

    await prisma.user.update({
        where: {
            id: userId,
        },
        data: {
            design: null,
        },
        select: {
            id: true,
        },
    })
}

const completeOnboarding = async (data: CompleteOnboarding) => {
    const { userId } = data
    const existingUser = await prisma.user.findUnique({
        where: {
            id: userId,
        },
        select: {
            id: true,
        },
    })

    if (!existingUser) {
        throw new AppError('user not found', 404)
    }

    const updatedUser = await prisma.user.update({
        where: {
            id: userId,
        },
        data: {
            hasCompletedOnboarding: true,
        },
        select: {
            id: true,
            hasCompletedOnboarding: true,
        },
    })

    return updatedUser
}

const createFeedback = async (data: CreateFeedback) => {
    const { userId, rating, feedback } = data
    return prisma.feedback.create({
        data: {
            userId: userId,
            rating: rating ?? null,
            feedback: feedback,
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
    getdesign,
    updatedesign,
    deletedesign,
    completeOnboarding,
    createFeedback,
}
