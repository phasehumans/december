import crypto from 'crypto'

import { prisma } from '../../config/db'

export const isSessionExpired = (expiresAt: Date) => {
    return expiresAt.getTime() <= Date.now()
}

export const deleteSessionById = async (sessionId: string) => {
    await prisma.session.deleteMany({
        where: {
            id: sessionId,
        },
    })
}

export const deleteAllUserSessions = async (userId: string) => {
    await prisma.session.deleteMany({
        where: {
            userId,
        },
    })
}

const hashRefreshToken = (refreshToken: string) => {
    return crypto.createHash('sha256').update(refreshToken).digest('hex')
}

const getRefreshTokenExpiryDate = () => {
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 7) // matches 7d refresh token expiry
    return expiresAt
}

export const authSession = {
    hashRefreshToken,
    getRefreshTokenExpiryDate,
}
