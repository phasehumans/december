import { prisma } from '@december/database'

import type { Prisma } from '@december/database'

export const authRepository = {
    async findUserByEmail(email: string) {
        return prisma.user.findUnique({
            where: { email },
        })
    },

    async findUserById(id: string) {
        return prisma.user.findUnique({
            where: { id },
        })
    },

    async createUser(data: Prisma.UserUncheckedCreateInput) {
        return prisma.user.create({ data })
    },

    async updateUser(id: string, data: Prisma.UserUpdateInput) {
        return prisma.user.update({
            where: { id },
            data,
        })
    },

    async createSession(data: Prisma.SessionUncheckedCreateInput) {
        return prisma.session.create({ data })
    },

    async findSessionById(id: string) {
        return prisma.session.findUnique({
            where: { id },
        })
    },

    async deleteSessionsBySessionId(sessionId: string) {
        return prisma.session.deleteMany({
            where: { id: sessionId },
        })
    },

    async updateSession(id: string, data: Prisma.SessionUpdateInput) {
        return prisma.session.update({
            where: { id },
            data,
        })
    },

    async resetPasswordAndRevokeSessions(userId: string, passwordHash: string) {
        return prisma.$transaction([
            prisma.user.update({
                where: { id: userId },
                data: {
                    password: passwordHash,
                    otpHash: null,
                    otpExpiresAt: null,
                },
            }),
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
        ])
    },
}
