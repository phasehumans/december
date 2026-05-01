import bcrypt from 'bcrypt'
import { prisma } from '../../config/db'
import { extractFirstName } from './profile.utils'
import { AppError } from '../../utils/appError'
import type { GenerationSound } from './profile.schema'

type UpdateName = {
    userId: string
    name: string
}

type UpdateUsername = {
    userId: string
    username: string
}

type ChangePassword = {
    userId: string
    password: string
}

type UpdateNotification = {
    userId: string
    notifyProjectActivity?: boolean
    notifyProductUpdates?: boolean
    notifySecurityAlerts?: boolean
}

type ConnectGithub = {
    userId: string
    accessToken: string
    username: string
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

const getInfo = async (data: string) => {
    const profile = await prisma.user.findUnique({
        where: {
            id: data,
            isDeleted: false,
        },
    })

    if (!profile) {
        throw new AppError('user not found', 404)
    }

    const firstName = extractFirstName(profile.name)
    const isGithubConnected = profile.githubConnected

    return { firstName, isGithubConnected }
}

const getProfileCard = async (data: string) => {
    const profile = await prisma.user.findUnique({
        where: {
            id: data,
            isDeleted: false,
        },
    })

    // change object in service itself not in controller

    if (!profile) {
        throw new AppError('user not found', 404)
    }

    return profile
}

const getProfile = async (data: string) => {
    const profile = await prisma.user.findUnique({
        where: {
            id: data,
            isDeleted: false,
        },
    })

    // change object in service itself not in controller

    if (!profile) {
        throw new AppError('user not found', 404)
    }

    return profile
}

const updateName = async (data: UpdateName) => {
    const { name, userId } = data

    const existingUser = await prisma.user.findUnique({
        where: {
            id: userId,
            isDeleted: false,
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
    })

    return updatedUser
}

const updateUsername = async (data: UpdateUsername) => {
    const { userId, username } = data

    const existingUser = await prisma.user.findUnique({
        where: {
            id: userId,
            isDeleted: false,
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
    })

    if (existingUsername) {
        throw new AppError(`${username} is already taken, try another one`, 409)
    }

    try {
        const updatedUser = await prisma.user.update({
            where: { id: userId },
            data: {
                username: username,
            },
        })

        return updatedUser
    } catch (error: any) {
        // Race condition safety
        if (error.code === 'P2002') {
            throw new AppError(`${username} is already taken, try another one`, 409)
        }

        throw error
    }
}

const changePassword = async (data: ChangePassword) => {
    const { password, userId } = data

    const existingUser = await prisma.user.findUnique({
        where: {
            id: userId,
            isDeleted: false,
        },
    })

    if (!existingUser) {
        throw new AppError('user not found', 404)
    }

    const hashPassword = await bcrypt.hash(password, 10)

    const updatedUser = await prisma.user.update({
        where: {
            id: userId,
        },
        data: {
            password: hashPassword,
        },
    })

    return updatedUser
}

const updateNotifications = async (data: UpdateNotification) => {
    const { userId, notifyProductUpdates, notifyProjectActivity, notifySecurityAlerts } = data

    const existingUser = await prisma.user.findUnique({
        where: {
            id: userId,
            isDeleted: false,
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
    })

    return updatedUser
}

const connectGithub = async (data: ConnectGithub) => {
    const { username, accessToken, userId } = data

    // console.log("inside service: ", username, accessToken)

    const existingUser = await prisma.user.findUnique({
        where: {
            id: userId,
            isDeleted: false,
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
            githubUsername: username,
            githubToken: accessToken,
            githubConnected: true,
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
        }),
    ])
}

const chatSuggestions = async (data: ChatSuggestions) => {
    const { userId, chatSuggestions } = data

    const existingUser = await prisma.user.findUnique({
        where: {
            id: userId,
            isDeleted: false,
        },
    })

    if (!existingUser) {
        throw new AppError('user not found', 404)
    }

    if (existingUser.chatSuggestions == chatSuggestions) {
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
    })

    return updatedUser
}

const generationSound = async (data: GenerationSoundType) => {
    const { userId, generationSound } = data

    const existingUser = await prisma.user.findUnique({
        where: {
            id: userId,
            isDeleted: false,
        },
    })

    if (!existingUser) {
        throw new AppError('user not found', 404)
    }

    if (existingUser.generationSound == generationSound) {
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
    })

    return updatedUser
}

export const profileService = {
    getInfo,
    getProfileCard,
    getProfile,
    updateName,
    updateUsername,
    changePassword,
    updateNotifications,
    connectGithub,
    signout,
    signoutAll,
    deleteAccount,
    chatSuggestions,
    generationSound,
}
