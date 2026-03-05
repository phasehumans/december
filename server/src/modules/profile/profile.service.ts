import { prisma } from '../../utils/db'
import bcrypt from 'bcrypt'

type UpdateName = {
    userId: string
    name: string
}

type ChangePassword = {
    userId: string
    password: string
}

type ConnectGithub = {
    userId: string,
    accessToken: string,
    username: string
}

const getProfile = async (data: string) => {
    const profile = await prisma.user.findUnique({
        where: {
            id: data,
        },
    })

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

const connectGithub = async (data: ConnectGithub) => {
    const {username, accessToken, userId} = data

    const updatedUser = await prisma.user.update({
        where: {
            id: userId
        },
        data: {
            githubUsername: username,
            githubToken: accessToken,
            githubConnected: true
        }
    }) 

    if(!updatedUser){
        throw new Error("user not found")
    }

    return updatedUser




}

export const profileService = {
    getProfile,
    updateName,
    changePassword,
    connectGithub,
}
