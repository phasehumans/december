import { prisma } from '@december/database'

import type { Prisma } from '@december/database'

async function findUserByEmail(email: string) {
    return prisma.user.findUnique({
        where: { email },
    })
}

async function findUserById(id: string) {
    return prisma.user.findUnique({
        where: { id },
    })
}

async function createUser(data: Prisma.UserUncheckedCreateInput) {
    return prisma.user.create({ data })
}

async function updateUser(id: string, data: Prisma.UserUpdateInput) {
    return prisma.user.update({
        where: { id },
        data,
    })
}

async function createSession(data: Prisma.AuthSessionUncheckedCreateInput) {
    return prisma.authSession.create({ data })
}

async function findSessionById(id: string) {
    return prisma.authSession.findUnique({
        where: { id },
    })
}

async function deleteSessionsBySessionId(sessionId: string) {
    return prisma.authSession.deleteMany({
        where: { id: sessionId },
    })
}

async function updateSession(id: string, data: Prisma.AuthSessionUpdateInput) {
    return prisma.authSession.update({
        where: { id },
        data,
    })
}

async function resetPasswordAndRevokeSessions(userId: string, passwordHash: string) {
    return prisma.$transaction([
        prisma.user.update({
            where: { id: userId },
            data: {
                password: passwordHash,
                otpHash: null,
                otpExpiresAt: null,
            },
        }),
        prisma.authSession.updateMany({
            where: {
                userId,
                isRevoked: false,
            },
            data: {
                isRevoked: true,
                revokedAt: new Date(),
            },
        }),
    ])
}

export const authRepository = {
    findUserByEmail,
    findUserById,
    createUser,
    updateUser,
    createSession,
    findSessionById,
    deleteSessionsBySessionId,
    updateSession,
    resetPasswordAndRevokeSessions,
}
