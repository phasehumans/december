import { describe, it, expect, beforeEach, afterAll } from 'bun:test'
import bcrypt from 'bcrypt'

import { prisma } from '../../../src/config/db'
import { profileService } from '../../../src/modules/profile/profile.service'
import { GenerationSound } from '../../../src/modules/profile/profile.schema'

const createUser = async (overrides: Record<string, unknown> = {}) => {
    return prisma.user.create({
        data: {
            name: 'Chaitanya Sonawane',
            email: `test-${crypto.randomUUID()}@example.com`,
            username: `user_${crypto.randomUUID().slice(0, 12)}`,
            password: await bcrypt.hash('Password123', 10),
            emailVerified: true,
            notifyProductUpdates: false,
            notifyProjectActivity: false,
            notifySecurityAlerts: false,
            chatSuggestions: false,
            generationSound: GenerationSound.NEVER,
            githubConnected: false,
            isDeleted: false,
            ...overrides,
        },
    })
}

const createSession = async (userId: string, overrides: Record<string, unknown> = {}) => {
    return prisma.session.create({
        data: {
            userId,
            refreshTokenHash: `hash-${crypto.randomUUID()}`,
            expiresAt: new Date(Date.now() + 1000 * 60 * 60),
            isRevoked: false,
            ...overrides,
        },
    })
}

const createSoftDeletedUser = () => createUser({ isDeleted: true })

describe('profile.service.integration', () => {
    let userId: string

    beforeEach(async () => {
        await prisma.session.deleteMany()
        await prisma.user.deleteMany()

        const user = await createUser()
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

        it('should throw for soft-deleted user', async () => {
            const deleted = await createSoftDeletedUser()

            await expect(profileService.getInfo(deleted.id)).rejects.toThrow('user not found')
        })

        it('should return correct firstName for single-word name', async () => {
            const user = await createUser({ name: 'Solo' })
            const result = await profileService.getInfo(user.id)

            expect(result.firstName).toBe('Solo')
        })
    })

    describe('getProfileCard', () => {
        it('should return profile card data', async () => {
            const result = await profileService.getProfileCard(userId)

            expect(result.id).toBe(userId)
            expect(result.name).toBe('Chaitanya Sonawane')
        })

        it('should throw for non-existent user', async () => {
            await expect(profileService.getProfileCard('bad-id')).rejects.toThrow('user not found')
        })

        it('should throw for soft-deleted user', async () => {
            const deleted = await createSoftDeletedUser()

            await expect(profileService.getProfileCard(deleted.id)).rejects.toThrow(
                'user not found'
            )
        })
    })

    describe('getProfile', () => {
        it('should return full profile', async () => {
            const result = await profileService.getProfile(userId)

            expect(result.id).toBe(userId)
            expect(result.name).toBe('Chaitanya Sonawane')
        })

        it('should fail for soft-deleted user', async () => {
            const deleted = await createSoftDeletedUser()

            await expect(profileService.getProfile(deleted.id)).rejects.toThrow('user not found')
        })

        it('should fail for non-existent user', async () => {
            await expect(profileService.getProfile('bad-id')).rejects.toThrow('user not found')
        })

        it('should include all expected fields', async () => {
            const result = await profileService.getProfile(userId)

            expect(result.email).toBeDefined()
            expect(result.username).toBeDefined()
            expect(result.name).toBeDefined()
            expect(result.isDeleted).toBe(false)
        })
    })

    describe('updateName', () => {
        it('should update name successfully', async () => {
            const result = await profileService.updateName({ userId, name: 'New Name' })

            expect(result.name).toBe('New Name')

            const db = await prisma.user.findUnique({ where: { id: userId } })
            expect(db!.name).toBe('New Name')
        })

        it('should fail if user not found', async () => {
            await expect(
                profileService.updateName({ userId: 'invalid', name: 'test' })
            ).rejects.toThrow('user not found')
        })

        it('should fail for soft-deleted user', async () => {
            const deleted = await createSoftDeletedUser()

            await expect(
                profileService.updateName({ userId: deleted.id, name: 'Ghost' })
            ).rejects.toThrow('user not found')
        })

        it('should persist updated name in database', async () => {
            await profileService.updateName({ userId, name: 'Persisted' })

            const db = await prisma.user.findUnique({ where: { id: userId } })
            expect(db!.name).toBe('Persisted')
        })
    })

    describe('updateUsername', () => {
        it('should update username successfully', async () => {
            const result = await profileService.updateUsername({ userId, username: 'new_username' })

            expect(result.username).toBe('new_username')
        })

        it('should fail if same username', async () => {
            const user = await prisma.user.findUnique({ where: { id: userId } })

            await expect(
                profileService.updateUsername({ userId, username: user!.username })
            ).rejects.toThrow('new username must be different')
        })

        it('should fail if username taken', async () => {
            await createUser({ username: 'taken_username' })

            await expect(
                profileService.updateUsername({ userId, username: 'taken_username' })
            ).rejects.toThrow('already taken')
        })

        it('should fail for non-existent user', async () => {
            await expect(
                profileService.updateUsername({ userId: 'bad', username: 'anything' })
            ).rejects.toThrow('user not found')
        })

        it('should fail for soft-deleted user', async () => {
            const deleted = await createSoftDeletedUser()

            await expect(
                profileService.updateUsername({ userId: deleted.id, username: 'newname' })
            ).rejects.toThrow('user not found')
        })

        it('should persist updated username in database', async () => {
            await profileService.updateUsername({ userId, username: 'persisted_user' })

            const db = await prisma.user.findUnique({ where: { id: userId } })
            expect(db!.username).toBe('persisted_user')
        })
    })

    describe('changePassword', () => {
        it('should hash and update password', async () => {
            const result = await profileService.changePassword({ userId, password: 'NewPass123' })

            const isValid = await bcrypt.compare('NewPass123', result.password!)
            expect(isValid).toBe(true)
        })

        it('should fail if user not found', async () => {
            await expect(
                profileService.changePassword({ userId: 'invalid', password: 'test123' })
            ).rejects.toThrow('user not found')
        })

        it('should fail for soft-deleted user', async () => {
            const deleted = await createSoftDeletedUser()

            await expect(
                profileService.changePassword({ userId: deleted.id, password: 'NewPass1' })
            ).rejects.toThrow('user not found')
        })

        it('should store a bcrypt hash, not plaintext', async () => {
            await profileService.changePassword({ userId, password: 'Secret99' })

            const db = await prisma.user.findUnique({ where: { id: userId } })
            expect(db!.password).not.toBe('Secret99')
            expect(db!.password!.startsWith('$2')).toBe(true)
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

        it('should update all three fields', async () => {
            const result = await profileService.updateNotifications({
                userId,
                notifyProductUpdates: true,
                notifyProjectActivity: true,
                notifySecurityAlerts: true,
            })

            expect(result.notifyProductUpdates).toBe(true)
            expect(result.notifyProjectActivity).toBe(true)
            expect(result.notifySecurityAlerts).toBe(true)
        })

        it('should fail if no fields provided', async () => {
            await expect(profileService.updateNotifications({ userId })).rejects.toThrow(
                'at least one notification setting must be provided'
            )
        })

        it('should fail for non-existent user', async () => {
            await expect(
                profileService.updateNotifications({ userId: 'bad', notifyProductUpdates: true })
            ).rejects.toThrow('user not found')
        })

        it('should fail for soft-deleted user', async () => {
            const deleted = await createSoftDeletedUser()

            await expect(
                profileService.updateNotifications({
                    userId: deleted.id,
                    notifyProductUpdates: true,
                })
            ).rejects.toThrow('user not found')
        })

        it('should persist notification changes in database', async () => {
            await profileService.updateNotifications({ userId, notifySecurityAlerts: true })

            const db = await prisma.user.findUnique({ where: { id: userId } })
            expect(db!.notifySecurityAlerts).toBe(true)
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
                profileService.connectGithub({ userId: 'invalid', username: 'x', accessToken: 'y' })
            ).rejects.toThrow('user not found')
        })

        it('should fail for soft-deleted user', async () => {
            const deleted = await createSoftDeletedUser()

            await expect(
                profileService.connectGithub({
                    userId: deleted.id,
                    username: 'x',
                    accessToken: 'y',
                })
            ).rejects.toThrow('user not found')
        })

        it('should persist github connection in database', async () => {
            await profileService.connectGithub({ userId, username: 'ghuser', accessToken: 'tok' })

            const db = await prisma.user.findUnique({ where: { id: userId } })
            expect(db!.githubConnected).toBe(true)
            expect(db!.githubUsername).toBe('ghuser')
            expect(db!.githubToken).toBe('tok')
        })
    })

    describe('signout', () => {
        it('should revoke session', async () => {
            const session = await createSession(userId)

            await profileService.signout({ userId, sessionId: session.id })

            const updated = await prisma.session.findUnique({ where: { id: session.id } })
            expect(updated!.isRevoked).toBe(true)
            expect(updated!.revokedAt).toBeTruthy()
        })

        it('should silently pass if session not found', async () => {
            await profileService.signout({ userId, sessionId: 'invalid' })
        })

        it('should not revoke other users sessions', async () => {
            const otherUser = await createUser()
            const otherSession = await createSession(otherUser.id)

            await profileService.signout({ userId, sessionId: otherSession.id })

            const check = await prisma.session.findUnique({ where: { id: otherSession.id } })
            expect(check!.isRevoked).toBe(false)
        })

        it('should not revoke already-revoked session', async () => {
            const session = await createSession(userId, { isRevoked: true, revokedAt: new Date() })

            await profileService.signout({ userId, sessionId: session.id })

            const check = await prisma.session.findUnique({ where: { id: session.id } })
            expect(check!.isRevoked).toBe(true)
        })
    })

    describe('signoutAll', () => {
        it('should revoke all sessions', async () => {
            await createSession(userId)
            await createSession(userId)

            await profileService.signoutAll({ userId })

            const sessions = await prisma.session.findMany({ where: { userId } })
            expect(sessions.length).toBe(2)
            expect(sessions.every((s) => s.isRevoked)).toBe(true)
            expect(sessions.every((s) => s.revokedAt !== null)).toBe(true)
        })

        it('should handle user with no sessions', async () => {
            await profileService.signoutAll({ userId })

            const sessions = await prisma.session.findMany({ where: { userId } })
            expect(sessions.length).toBe(0)
        })

        it('should only revoke non-revoked sessions', async () => {
            await createSession(userId)
            await createSession(userId, { isRevoked: true, revokedAt: new Date() })

            await profileService.signoutAll({ userId })

            const sessions = await prisma.session.findMany({ where: { userId } })
            expect(sessions.every((s) => s.isRevoked)).toBe(true)
        })
    })

    describe('deleteAccount', () => {
        it('should soft delete user and revoke sessions', async () => {
            await createSession(userId)

            await profileService.deleteAccount({ userId })

            const user = await prisma.user.findUnique({ where: { id: userId } })
            expect(user).not.toBeNull()
            expect(user!.isDeleted).toBe(true)
            expect(user!.deletedAt).toBeTruthy()

            const sessions = await prisma.session.findMany({ where: { userId } })
            expect(sessions.every((s) => s.isRevoked)).toBe(true)
            expect(sessions.every((s) => s.revokedAt !== null)).toBe(true)
        })

        it('should fail if already deleted', async () => {
            const deleted = await createSoftDeletedUser()

            await expect(profileService.deleteAccount({ userId: deleted.id })).rejects.toThrow(
                'user account is already deleted'
            )
        })

        it('should fail for non-existent user', async () => {
            await expect(profileService.deleteAccount({ userId: 'ghost' })).rejects.toThrow(
                'user not found'
            )
        })

        it('should set deletedAt timestamp', async () => {
            const before = new Date()
            await profileService.deleteAccount({ userId })

            const db = await prisma.user.findUnique({ where: { id: userId } })
            expect(db!.deletedAt).toBeTruthy()
            expect(db!.deletedAt!.getTime()).toBeGreaterThanOrEqual(before.getTime())
        })

        it('should revoke all sessions in a transaction', async () => {
            await createSession(userId)
            await createSession(userId)
            await createSession(userId)

            await profileService.deleteAccount({ userId })

            const sessions = await prisma.session.findMany({ where: { userId } })
            expect(sessions.length).toBe(3)
            expect(sessions.every((s) => s.isRevoked)).toBe(true)
        })
    })

    describe('chatSuggestions', () => {
        it('should update preference to true', async () => {
            const result = await profileService.chatSuggestions({ userId, chatSuggestions: true })

            expect(result.chatSuggestions).toBe(true)
        })

        it('should fail if same value', async () => {
            await expect(
                profileService.chatSuggestions({ userId, chatSuggestions: false })
            ).rejects.toThrow('must be different')
        })

        it('should fail for non-existent user', async () => {
            await expect(
                profileService.chatSuggestions({ userId: 'bad', chatSuggestions: true })
            ).rejects.toThrow('user not found')
        })

        it('should fail for soft-deleted user', async () => {
            const deleted = await createSoftDeletedUser()

            await expect(
                profileService.chatSuggestions({ userId: deleted.id, chatSuggestions: true })
            ).rejects.toThrow('user not found')
        })

        it('should persist chatSuggestions in database', async () => {
            await profileService.chatSuggestions({ userId, chatSuggestions: true })

            const db = await prisma.user.findUnique({ where: { id: userId } })
            expect(db!.chatSuggestions).toBe(true)
        })

        it('should allow toggling back to false', async () => {
            await profileService.chatSuggestions({ userId, chatSuggestions: true })
            const result = await profileService.chatSuggestions({ userId, chatSuggestions: false })

            expect(result.chatSuggestions).toBe(false)
        })
    })

    describe('generationSound', () => {
        it('should update generation sound to ALWAYS', async () => {
            const result = await profileService.generationSound({
                userId,
                generationSound: GenerationSound.ALWAYS,
            })

            expect(result.generationSound).toBe(GenerationSound.ALWAYS)
        })

        it('should update generation sound to FIRST_GENERATION', async () => {
            const result = await profileService.generationSound({
                userId,
                generationSound: GenerationSound.FIRST_GENERATION,
            })

            expect(result.generationSound).toBe(GenerationSound.FIRST_GENERATION)
        })

        it('should fail if same value', async () => {
            await expect(
                profileService.generationSound({ userId, generationSound: GenerationSound.NEVER })
            ).rejects.toThrow('must be different')
        })

        it('should fail for non-existent user', async () => {
            await expect(
                profileService.generationSound({
                    userId: 'bad',
                    generationSound: GenerationSound.ALWAYS,
                })
            ).rejects.toThrow('user not found')
        })

        it('should fail for soft-deleted user', async () => {
            const deleted = await createSoftDeletedUser()

            await expect(
                profileService.generationSound({
                    userId: deleted.id,
                    generationSound: GenerationSound.ALWAYS,
                })
            ).rejects.toThrow('user not found')
        })

        it('should persist generationSound in database', async () => {
            await profileService.generationSound({
                userId,
                generationSound: GenerationSound.ALWAYS,
            })

            const db = await prisma.user.findUnique({ where: { id: userId } })
            expect(db!.generationSound).toBe(GenerationSound.ALWAYS)
        })

        it('should allow cycling through all values', async () => {
            await profileService.generationSound({
                userId,
                generationSound: GenerationSound.ALWAYS,
            })
            await profileService.generationSound({
                userId,
                generationSound: GenerationSound.FIRST_GENERATION,
            })
            const result = await profileService.generationSound({
                userId,
                generationSound: GenerationSound.NEVER,
            })

            expect(result.generationSound).toBe(GenerationSound.NEVER)
        })
    })
})
