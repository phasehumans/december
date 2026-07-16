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

async function revokeSession(sessionId: string) {
    return prisma.authSession.update({
        where: { id: sessionId },
        data: {
            isRevoked: true,
            revokedAt: new Date(),
        },
    })
}

async function revokeAllSessions(userId: string) {
    return prisma.authSession.updateMany({
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

async function findUserByIdForDeleteCheck(id: string) {
    return prisma.user.findUnique({
        where: { id },
        select: {
            id: true,
            isDeleted: true,
        },
    })
}

async function deleteAccount(userId: string) {
    return prisma.$transaction([
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
        prisma.user.update({
            where: { id: userId },
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

async function createDeviceCode(data: Prisma.DeviceCodeUncheckedCreateInput) {
    return prisma.deviceCode.create({ data })
}

async function findDeviceCodeByDeviceCode(deviceCode: string) {
    return prisma.deviceCode.findUnique({
        where: { deviceCode },
    })
}

async function findDeviceCodeByUserCode(userCode: string) {
    return prisma.deviceCode.findUnique({
        where: { userCode },
    })
}

async function updateDeviceCode(id: string, data: Prisma.DeviceCodeUpdateInput) {
    return prisma.deviceCode.update({
        where: { id },
        data,
    })
}

async function deleteDeviceCode(id: string) {
    return prisma.deviceCode.delete({
        where: { id },
    })
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
    revokeSession,
    revokeAllSessions,
    findUserByIdForDeleteCheck,
    deleteAccount,
    createDeviceCode,
    findDeviceCodeByDeviceCode,
    findDeviceCodeByUserCode,
    updateDeviceCode,
    deleteDeviceCode,
}
