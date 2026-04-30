import bcrypt from 'bcrypt'

import { prisma } from '../../config/db'
import { extractFirstName } from './profile.utils'
import { AppError } from '../../utils/appError'

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

const getProfile = async (data: string) => {
    const profile = await prisma.user.findUnique({
        where: {
            id: data,
        },
        // select: {
        //     id: true,
        //     name: true,
        //     email: true,
        //     username: true,
        //     emailVerified: true,
        //     receiveNotification: true,
        //     githubUsername: true,
        //     githubConnected: true,
        //     createdAt: true,
        //     updatedAt: true,
        // },
    })

    // change object in service itself not in controller

    if (!profile) {
        throw new Error('user not found')
    }

    return profile
}

const updateName = async (data: UpdateName) => {
    const { name, userId } = data

    const existingUser = await prisma.user.findUnique({
        where: {
            id: userId,
        },
    })

    if (!existingUser) {
        throw new Error('user not found')
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
        },
    })

    if (!existingUser) {
        throw new AppError('user not found')
    }

    if (username === existingUser.username) {
        throw new AppError('username is same')
    }

    const existingUsername = await prisma.user.findUnique({
        where: {
            username: username,
        },
    })

    if (existingUsername) {
        throw new AppError(`${username} is already taken, try another one`)
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
            throw new AppError(`${username} is already taken, try another one`)
        }

        throw error
    }
}

const changePassword = async (data: ChangePassword) => {
    const { password, userId } = data

    const existingUser = await prisma.user.findUnique({
        where: {
            id: userId,
        },
    })

    if (!existingUser) {
        throw new Error('user not found')
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
        },
    })

    if (!existingUser) {
        throw new AppError('user not found')
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
        throw new AppError('at least one notification setting must be provided')
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
        },
    })

    if (!existingUser) {
        throw new Error('user not found')
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

const getQuickInfo = async (data: string) => {
    const profile = await prisma.user.findUnique({
        where: {
            id: data,
        },
    })

    if (!profile) {
        throw new Error('user not found')
    }

    const firstName = extractFirstName(profile.name)
    const isGithubConnected = profile.githubConnected

    return { firstName, isGithubConnected }
}

const signout = async () => {}

const signoutAll = async () => {}

const deleteAccount = async () => {}

export const profileService = {
    getProfile,
    updateName,
    updateUsername,
    changePassword,
    updateNotifications,
    connectGithub,
    getQuickInfo,
    signout,
    signoutAll,
    deleteAccount,
}
