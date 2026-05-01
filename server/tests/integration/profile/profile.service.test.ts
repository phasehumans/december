import { describe, it, expect, beforeEach, afterAll } from 'bun:test'
import bcrypt from 'bcrypt'

import { prisma } from '../../../src/config/db'
import { profileService } from '../../../src/modules/profile/profile.service'
import { GenerationSound } from '../../../src/modules/profile/profile.schema'

const createSession = async (userId: string, overrides = {}) => {
    return prisma.session.create({
        data: {
            userId,
            refreshTokenHash: 'test-hash',
            expiresAt: new Date(Date.now() + 1000 * 60 * 60), // 1 hour
            isRevoked: false,
            ...overrides,
        },
    })
}

describe('profile.service.integration', () => {
    let userId: string

    beforeEach(async () => {
        await prisma.session.deleteMany()
        await prisma.user.deleteMany()

        const user = await prisma.user.create({
            data: {
                name: 'Chaitanya Sonawane',
                email: 'test@example.com',
                username: 'chaitanya',
                password: await bcrypt.hash('Password123', 10),
                emailVerified: true,
                notifyProductUpdates: false,
                notifyProjectActivity: false,
                notifySecurityAlerts: false,
                chatSuggestions: false,
                generationSound: GenerationSound.NEVER,
                githubConnected: false,
                isDeleted: false,
            },
        })

        userId = user.id
    })

    afterAll(async () => {
        await prisma.$disconnect()
    })

    describe('getInfo', () => {
        it('should return firstName and github status', async () => {
            const result = await profileService.getInfo(userId)

            expect(result.firstName).toBe('Chaitanya')
            expect(result.isGithubConnected).toBe(false)
        })

        it('should throw if user not found', async () => {
            await expect(profileService.getInfo('invalid-id')).rejects.toThrow('user not found')
        })
    })

    describe('getProfile', () => {
        it('should return full profile', async () => {
            const result = await profileService.getProfile(userId)

            expect(result.id).toBe(userId)
            expect(result.email).toBe('test@example.com')
        })

        it('should fail if deleted user', async () => {
            await prisma.user.update({
                where: { id: userId },
                data: { isDeleted: true },
            })

            await expect(profileService.getProfile(userId)).rejects.toThrow('user not found')
        })
    })

    describe('updateName', () => {
        it('should update name successfully', async () => {
            const result = await profileService.updateName({
                userId,
                name: 'New Name',
            })

            expect(result.name).toBe('New Name')

            const db = await prisma.user.findUnique({ where: { id: userId } })
            expect(db!.name).toBe('New Name')
        })

        it('should fail if user not found', async () => {
            await expect(
                profileService.updateName({
                    userId: 'invalid',
                    name: 'test',
                })
            ).rejects.toThrow('user not found')
        })
    })

    describe('updateUsername', () => {
        it('should update username successfully', async () => {
            const result = await profileService.updateUsername({
                userId,
                username: 'new_username',
            })

            expect(result.username).toBe('new_username')
        })

        it('should fail if same username', async () => {
            await expect(
                profileService.updateUsername({
                    userId,
                    username: 'chaitanya',
                })
            ).rejects.toThrow('new username must be different')
        })

        it('should fail if username taken', async () => {
            await prisma.user.create({
                data: {
                    name: 'other',
                    email: 'other@example.com',
                    username: 'taken_username',
                    password: 'test',
                },
            })

            await expect(
                profileService.updateUsername({
                    userId,
                    username: 'taken_username',
                })
            ).rejects.toThrow('already taken')
        })
    })

    describe('changePassword', () => {
        it('should hash and update password', async () => {
            const result = await profileService.changePassword({
                userId,
                password: 'NewPass123',
            })

            const isValid = await bcrypt.compare('NewPass123', result.password!)

            expect(isValid).toBe(true)
        })

        it('should fail if user not found', async () => {
            await expect(
                profileService.changePassword({
                    userId: 'invalid',
                    password: 'test123',
                })
            ).rejects.toThrow('user not found')
        })
    })

    describe('updateNotifications', () => {
        it('should update single field', async () => {
            const result = await profileService.updateNotifications({
                userId,
                notifyProductUpdates: true,
            })

            expect(result.notifyProductUpdates).toBe(true)
        })

        it('should update multiple fields', async () => {
            const result = await profileService.updateNotifications({
                userId,
                notifyProductUpdates: true,
                notifySecurityAlerts: true,
            })

            expect(result.notifyProductUpdates).toBe(true)
            expect(result.notifySecurityAlerts).toBe(true)
        })

        it('should fail if no fields provided', async () => {
            await expect(profileService.updateNotifications({ userId })).rejects.toThrow(
                'at least one notification setting must be provided'
            )
        })
    })

    describe('connectGithub', () => {
        it('should connect github successfully', async () => {
            const result = await profileService.connectGithub({
                userId,
                username: 'githubUser',
                accessToken: 'token123',
            })

            expect(result.githubConnected).toBe(true)
            expect(result.githubUsername).toBe('githubUser')
        })

        it('should fail if user not found', async () => {
            await expect(
                profileService.connectGithub({
                    userId: 'invalid',
                    username: 'x',
                    accessToken: 'y',
                })
            ).rejects.toThrow('user not found')
        })
    })

    describe('signout', () => {
        it('should revoke session', async () => {
            const session = await createSession(userId)

            await profileService.signout({
                userId,
                sessionId: session.id,
            })

            const updated = await prisma.session.findUnique({
                where: { id: session.id },
            })

            expect(updated!.isRevoked).toBe(true)
        })

        it('should silently pass if session not found', async () => {
            await profileService.signout({
                userId,
                sessionId: 'invalid',
            })
        })
    })

    describe('signoutAll', () => {
        it('should revoke all sessions', async () => {
            await prisma.session.createMany({
                data: [
                    {
                        userId,
                        refreshTokenHash: 'hash1',
                        expiresAt: new Date(Date.now() + 10000),
                        isRevoked: false,
                    },
                    {
                        userId,
                        refreshTokenHash: 'hash2',
                        expiresAt: new Date(Date.now() + 10000),
                        isRevoked: false,
                    },
                ],
            })

            await profileService.signoutAll({ userId })

            const sessions = await prisma.session.findMany({
                where: { userId },
            })

            expect(sessions.length).toBe(2)
            expect(sessions.every((s) => s.isRevoked)).toBe(true)
        })
    })

    describe('deleteAccount', () => {
        it('should soft delete user and revoke sessions', async () => {
            await prisma.session.create({
                data: {
                    userId,
                    refreshTokenHash: 'hash1',
                    expiresAt: new Date(Date.now() + 10000),
                    isRevoked: false,
                },
            })

            await profileService.deleteAccount({ userId })

            const user = await prisma.user.findUnique({
                where: { id: userId },
            })

            const sessions = await prisma.session.findMany({
                where: { userId },
            })

            expect(user).not.toBeNull()
            expect(user!.isDeleted).toBe(true)
            expect(user!.deletedAt).toBeTruthy()

            expect(sessions.length).toBe(1)
            expect(sessions.every((s) => s.isRevoked)).toBe(true)
            expect(sessions.every((s) => s.revokedAt !== null)).toBe(true)
        })

        it('should fail if already deleted', async () => {
            await prisma.user.update({
                where: { id: userId },
                data: {
                    isDeleted: true,
                    deletedAt: new Date(),
                },
            })

            await expect(profileService.deleteAccount({ userId })).rejects.toThrow(
                'user account is already deleted'
            )
        })
    })

    describe('chatSuggestions', () => {
        it('should update preference', async () => {
            const result = await profileService.chatSuggestions({
                userId,
                chatSuggestions: true,
            })

            expect(result.chatSuggestions).toBe(true)
        })

        it('should fail if same value', async () => {
            await expect(
                profileService.chatSuggestions({
                    userId,
                    chatSuggestions: false,
                })
            ).rejects.toThrow('must be different')
        })
    })

    describe('generationSound', () => {
        it('should update generation sound', async () => {
            const result = await profileService.generationSound({
                userId,
                generationSound: GenerationSound.ALWAYS,
            })

            expect(result.generationSound).toBe(GenerationSound.ALWAYS)
        })

        it('should fail if same value', async () => {
            await expect(
                profileService.generationSound({
                    userId,
                    generationSound: GenerationSound.NEVER,
                })
            ).rejects.toThrow('must be different')
        })
    })
})
