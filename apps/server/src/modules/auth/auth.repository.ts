import { prisma } from '@december/database'

import type { Prisma } from '@december/database'

async function findUserByEmail(email: string) {
    return prisma.user.findUnique({
        where: { email },
    })
}

async function findUserByGithubId(githubId: string) {
    return prisma.user.findUnique({
        where: { githubId },
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

// Counts one guess against the code the caller read. It only succeeds while that same code
// is still stored and has tries left, so parallel guesses cannot outrun the limit.
async function claimOtpAttempt(id: string, otpHash: string, maxAttempts: number) {
    const { count } = await prisma.user.updateMany({
        where: { id, otpHash, otpAttempts: { lt: maxAttempts } },
        data: { otpAttempts: { increment: 1 } },
    })
    return count === 1
}

// Clears a code that has used all its tries. The try count stays, so late guesses stay refused.
async function clearExhaustedOtp(id: string, otpHash: string, maxAttempts: number) {
    const { count } = await prisma.user.updateMany({
        where: { id, otpHash, otpAttempts: { gte: maxAttempts } },
        data: { otpHash: null, otpExpiresAt: null },
    })
    return count === 1
}

// Uses up a correct code. Only one request can do this, and only while the code is still stored.
async function consumeOtp(id: string, otpHash: string) {
    const { count } = await prisma.user.updateMany({
        where: { id, otpHash },
        data: { otpHash: null, otpExpiresAt: null, otpAttempts: 0, emailVerified: true },
    })
    return count === 1
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

/**
 * Replaces the token of a session only if no other refresh did since the session was read.
 * Two refreshes with the same token at once: one replaces it, the other gets false.
 */
async function rotateSessionToken(data: {
    id: string
    lastRotatedAt: Date | null
    previousHash: string
    newHash: string
    rotatedAt: Date
    expiresAt: Date
}) {
    const { id, lastRotatedAt, previousHash, newHash, rotatedAt, expiresAt } = data
    const result = await prisma.authSession.updateMany({
        where: { id, rotatedAt: lastRotatedAt, isRevoked: false },
        data: {
            previousRefreshTokenHash: previousHash,
            refreshTokenHash: newHash,
            rotatedAt,
            expiresAt,
        },
    })
    return result.count === 1
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
        // deletion is a soft delete, but saved api keys are always removed for real
        prisma.providerCredential.deleteMany({ where: { userId } }),
        // git hosts are let go, so a new account can connect the same github or gitlab
        prisma.gitConnection.deleteMany({ where: { userId } }),
        prisma.githubAppInstallation.updateMany({ where: { userId }, data: { userId: null } }),
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
                githubAppInstall: false,
                githubUsername: null,
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

async function purgeExpiredAndRevokedSessions() {
    return prisma.authSession.deleteMany({
        where: {
            OR: [{ expiresAt: { lt: new Date() } }, { isRevoked: true }],
        },
    })
}

async function findActiveDeviceSession(userId: string) {
    return prisma.authSession.findFirst({
        where: {
            userId,
            userAgent: { contains: 'cli', mode: 'insensitive' },
            isRevoked: false,
            expiresAt: { gt: new Date() },
        },
    })
}

// every sign-in row the user still has (signed out ones too, until the daily purge), for
// the new sign-in notice
async function findSessionUserAgents(userId: string) {
    return prisma.authSession.findMany({
        where: { userId },
        select: { userAgent: true },
        take: 200,
        orderBy: { createdAt: 'desc' },
    })
}

// the devices list: sessions that still work, most recently used first
async function findActiveSessionsByUser(userId: string) {
    return prisma.authSession.findMany({
        where: {
            userId,
            isRevoked: false,
            expiresAt: { gt: new Date() },
        },
        select: {
            id: true,
            userAgent: true,
            createdAt: true,
            updatedAt: true,
            rotatedAt: true,
        },
        orderBy: { updatedAt: 'desc' },
    })
}

export const authRepository = {
    findActiveSessionsByUser,
    findSessionUserAgents,
    claimOtpAttempt,
    clearExhaustedOtp,
    consumeOtp,
    findUserByEmail,
    findUserByGithubId,
    findUserById,
    createUser,
    updateUser,
    createSession,
    findSessionById,
    deleteSessionsBySessionId,
    rotateSessionToken,
    revokeSession,
    revokeAllSessions,
    findUserByIdForDeleteCheck,
    deleteAccount,
    createDeviceCode,
    findDeviceCodeByDeviceCode,
    findDeviceCodeByUserCode,
    updateDeviceCode,
    deleteDeviceCode,
    findActiveDeviceSession,
    purgeExpiredAndRevokedSessions,
}
