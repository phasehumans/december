import '../../env'

import crypto from 'crypto'
import bcrypt from 'bcrypt'
import { prisma } from '@december/database'
import { afterAll, beforeEach, describe, expect, it } from 'bun:test'
import { profileService } from '../../../src/modules/profile/profile.service'
import { GenerationSound } from '../../../src/modules/profile/profile.schema'

const createUser = async (overrides: Record<string, unknown> = {}) => {
    return prisma.user.create({
        data: {
            name: 'Profile Service User',
            email: `profile-serv-${crypto.randomUUID()}@example.com`,
            username: `profile-serv-${crypto.randomUUID()}`,
            password: await bcrypt.hash('valid_password', 10),
            emailVerified: true,
            isDeleted: false,
            ...overrides,
        },
    })
}

const createSession = async (userId: string) => {
    return prisma.session.create({
        data: {
            userId,
            isRevoked: false,
            refreshTokenHash: crypto.randomUUID(),
            expiresAt: new Date(Date.now() + 1000000),
        },
    })
}

describe('profile.service.integration', () => {
    let isCleaningUp = false

    beforeEach(async () => {
        if (isCleaningUp) return
        await prisma.feedback.deleteMany({
            where: { user: { email: { startsWith: 'profile-serv-' } } },
        })
        await prisma.session.deleteMany({
            where: { user: { email: { startsWith: 'profile-serv-' } } },
        })
        await prisma.user.deleteMany({ where: { email: { startsWith: 'profile-serv-' } } })
    })

    afterAll(async () => {
        isCleaningUp = true
        await prisma.$disconnect()
    }, 15000)

    describe('getInfo', () => {
        it('should return user full name and github connection status', async () => {
            const user = await createUser({ name: 'Alice Info', githubConnected: true })
            const info = await profileService.getInfo({ userId: user.id })
            expect(info.fullName).toBe('Alice Info')
            expect(info.isGithubConnected).toBe(true)
        })

        it('should throw 404 if user not found', async () => {
            expect(profileService.getInfo({ userId: 'fake-id' })).rejects.toThrow('user not found')
        })
    })

    describe('getProfileCard', () => {
        it('should return profile card details', async () => {
            const user = await createUser({ name: 'Bob Card', username: 'bob_card' })
            const card = await profileService.getProfileCard({ userId: user.id })
            expect(card.name).toBe('Bob Card')
            expect(card.username).toBe('bob_card')
        })

        it('should throw 404 if user not found', async () => {
            expect(profileService.getProfileCard({ userId: 'fake-id' })).rejects.toThrow(
                'user not found'
            )
        })
    })

    describe('getProfile', () => {
        it('should return full profile without password but with hasPassword boolean', async () => {
            const user = await createUser({ name: 'Charlie Profile' })
            const profile = await profileService.getProfile({ userId: user.id })
            expect((profile as any).password).toBeUndefined()
            expect(profile.hasPassword).toBe(true)
            expect(profile.name).toBe('Charlie Profile')
        })

        it('should throw 404 if user not found', async () => {
            expect(profileService.getProfile({ userId: 'fake-id' })).rejects.toThrow(
                'user not found'
            )
        })
    })

    describe('updateName', () => {
        it('should update user name successfully', async () => {
            const user = await createUser({ name: 'Old Name' })
            const updated = await profileService.updateName({ userId: user.id, name: 'New Name' })
            expect(updated.name).toBe('New Name')
        })

        it('should throw 404 if user not found', async () => {
            expect(
                profileService.updateName({ userId: 'fake-id', name: 'New Name' })
            ).rejects.toThrow('user not found')
        })
    })

    describe('updateUsername', () => {
        it('should update username successfully', async () => {
            const user = await createUser({ username: 'old_username' })
            const updated = await profileService.updateUsername({
                userId: user.id,
                username: 'new_username',
            })
            expect(updated.username).toBe('new_username')
        })

        it('should throw 404 if user not found', async () => {
            expect(
                profileService.updateUsername({ userId: 'fake-id', username: 'new_username' })
            ).rejects.toThrow('user not found')
        })

        it('should throw 400 if new username is same as current username', async () => {
            const user = await createUser({ username: 'same_username' })
            expect(
                profileService.updateUsername({ userId: user.id, username: 'same_username' })
            ).rejects.toThrow('new username must be different from the current one')
        })

        it('should throw 409 if username is already taken', async () => {
            await createUser({ username: 'taken_username' })
            const user2 = await createUser({ username: 'another_username' })
            expect(
                profileService.updateUsername({ userId: user2.id, username: 'taken_username' })
            ).rejects.toThrow('taken_username is already taken, try another one')
        })
    })

    describe('updateAvatarUrl', () => {
        it('should update avatar URL successfully', async () => {
            const user = await createUser()
            const updated = await profileService.updateAvatarUrl({
                userId: user.id,
                avatarUrl: 'https://example.com/new.png',
            })
            expect(updated.avatarUrl).toBe('https://example.com/new.png')
        })

        it('should throw 404 if user not found', async () => {
            expect(
                profileService.updateAvatarUrl({
                    userId: 'fake-id',
                    avatarUrl: 'https://example.com/new.png',
                })
            ).rejects.toThrow('user not found')
        })
    })

    describe('changePassword', () => {
        it('should throw 404 if user not found', async () => {
            expect(
                profileService.changePassword({
                    userId: 'fake-id',
                    currentPassword: 'old',
                    newPassword: 'new',
                })
            ).rejects.toThrow('user not found')
        })

        it('should set password for first time if user has no password (OAuth)', async () => {
            const user = await createUser({ password: null })
            const res = await profileService.changePassword({
                userId: user.id,
                newPassword: 'new_password',
            })
            expect(res.success).toBe(true)
            const dbUser = await prisma.user.findUnique({ where: { id: user.id } })
            expect(dbUser!.password).not.toBeNull()
        })

        it('should throw 400 if current password is required but missing', async () => {
            const user = await createUser()
            expect(
                profileService.changePassword({
                    userId: user.id,
                    currentPassword: '',
                    newPassword: 'new_password',
                })
            ).rejects.toThrow('current password is required')
        })

        it('should throw 401 if current password is incorrect', async () => {
            const user = await createUser()
            expect(
                profileService.changePassword({
                    userId: user.id,
                    currentPassword: 'wrong_password',
                    newPassword: 'new_password',
                })
            ).rejects.toThrow('current password is incorrect')
        })

        it('should throw 400 if new password is same as current password', async () => {
            const user = await createUser()
            expect(
                profileService.changePassword({
                    userId: user.id,
                    currentPassword: 'valid_password',
                    newPassword: 'valid_password',
                })
            ).rejects.toThrow('new password must be different from current password')
        })

        it('should update password successfully when current password is correct', async () => {
            const user = await createUser()
            const res = await profileService.changePassword({
                userId: user.id,
                currentPassword: 'valid_password',
                newPassword: 'new_valid_password',
            })
            expect(res.success).toBe(true)
        })
    })

    describe('updateNotifications', () => {
        it('should update notification settings successfully', async () => {
            const user = await createUser()
            const updated = await profileService.updateNotifications({
                userId: user.id,
                notifyProjectActivity: true,
                notifyProductUpdates: false,
            })
            expect(updated.notifyProjectActivity).toBe(true)
            expect(updated.notifyProductUpdates).toBe(false)
        })

        it('should throw 404 if user not found', async () => {
            expect(
                profileService.updateNotifications({
                    userId: 'fake-id',
                    notifyProjectActivity: true,
                })
            ).rejects.toThrow('user not found')
        })

        it('should throw 400 if no notification setting is provided', async () => {
            const user = await createUser()
            expect(profileService.updateNotifications({ userId: user.id })).rejects.toThrow(
                'at least one notification setting must be provided'
            )
        })
    })

    describe('signout', () => {
        it('should revoke existing session', async () => {
            const user = await createUser()
            const session = await createSession(user.id)
            await profileService.signout({ userId: user.id, sessionId: session.id })
            const dbSession = await prisma.session.findUnique({ where: { id: session.id } })
            expect(dbSession!.isRevoked).toBe(true)
        })

        it('should silently succeed if session does not exist', async () => {
            const user = await createUser()
            await expect(
                profileService.signout({ userId: user.id, sessionId: 'fake-session' })
            ).resolves.toBeUndefined()
        })
    })

    describe('signoutAll', () => {
        it('should revoke all active sessions for user', async () => {
            const user = await createUser()
            const session1 = await createSession(user.id)
            const session2 = await createSession(user.id)
            await profileService.signoutAll({ userId: user.id })
            const dbSession1 = await prisma.session.findUnique({ where: { id: session1.id } })
            const dbSession2 = await prisma.session.findUnique({ where: { id: session2.id } })
            expect(dbSession1!.isRevoked).toBe(true)
            expect(dbSession2!.isRevoked).toBe(true)
        })
    })

    describe('deleteAccount', () => {
        it('should throw 404 if user not found', async () => {
            expect(profileService.deleteAccount({ userId: 'fake-id' })).rejects.toThrow(
                'user not found'
            )
        })

        it('should throw 409 if user is already deleted', async () => {
            const user = await createUser({ isDeleted: true })
            expect(profileService.deleteAccount({ userId: user.id })).rejects.toThrow(
                'user account is already deleted'
            )
        })

        it('should soft delete user and revoke all sessions', async () => {
            const user = await createUser()
            const session = await createSession(user.id)
            await profileService.deleteAccount({ userId: user.id })
            const dbUser = await prisma.user.findUnique({ where: { id: user.id } })
            const dbSession = await prisma.session.findUnique({ where: { id: session.id } })
            expect(dbUser!.isDeleted).toBe(true)
            expect(dbSession!.isRevoked).toBe(true)
        })
    })

    describe('chatSuggestions', () => {
        it('should update chat suggestions state successfully', async () => {
            const user = await createUser({ chatSuggestions: false })
            const updated = await profileService.chatSuggestions({
                userId: user.id,
                chatSuggestions: true,
            })
            expect(updated.chatSuggestions).toBe(true)
        })

        it('should throw 404 if user not found', async () => {
            expect(
                profileService.chatSuggestions({ userId: 'fake-id', chatSuggestions: true })
            ).rejects.toThrow('user not found')
        })

        it('should throw 400 if new input is same as current state', async () => {
            const user = await createUser({ chatSuggestions: true })
            expect(
                profileService.chatSuggestions({ userId: user.id, chatSuggestions: true })
            ).rejects.toThrow('new input must be different from the current chat suggestion state')
        })
    })

    describe('generationSound', () => {
        it('should update generation sound state successfully', async () => {
            const user = await createUser({ generationSound: 'ALWAYS' })
            const updated = await profileService.generationSound({
                userId: user.id,
                generationSound: GenerationSound.NEVER,
            })
            expect(updated.generationSound).toBe('NEVER')
        })

        it('should throw 404 if user not found', async () => {
            expect(
                profileService.generationSound({
                    userId: 'fake-id',
                    generationSound: GenerationSound.NEVER,
                })
            ).rejects.toThrow('user not found')
        })

        it('should throw 400 if new input is same as current state', async () => {
            const user = await createUser({ generationSound: 'ALWAYS' })
            expect(
                profileService.generationSound({
                    userId: user.id,
                    generationSound: GenerationSound.ALWAYS,
                })
            ).rejects.toThrow('new input must be different from the current generation sound state')
        })
    })

    describe('design', () => {
        it('should fetch user design successfully', async () => {
            const user = await createUser({ design: 'Sleek UI' })
            const res = await profileService.getdesign({ userId: user.id })
            expect(res.design).toBe('Sleek UI')
        })

        it('should throw 404 when fetching design for non-existent user', async () => {
            expect(profileService.getdesign({ userId: 'fake-id' })).rejects.toThrow(
                'user not found'
            )
        })

        it('should update user design successfully', async () => {
            const user = await createUser()
            const res = await profileService.updatedesign({ userId: user.id, design: 'New Design' })
            expect(res.design).toBe('New Design')
        })

        it('should throw 404 when updating design for non-existent user', async () => {
            expect(
                profileService.updatedesign({ userId: 'fake-id', design: 'New Design' })
            ).rejects.toThrow('user not found')
        })

        it('should delete user design successfully', async () => {
            const user = await createUser({ design: 'Sleek UI' })
            await profileService.deletedesign({ userId: user.id })
            const dbUser = await prisma.user.findUnique({ where: { id: user.id } })
            expect(dbUser!.design).toBeNull()
        })

        it('should throw 404 when deleting design for non-existent user', async () => {
            expect(profileService.deletedesign({ userId: 'fake-id' })).rejects.toThrow(
                'user not found'
            )
        })
    })

    describe('completeOnboarding', () => {
        it('should complete onboarding successfully', async () => {
            const user = await createUser({ hasCompletedOnboarding: false })
            const updated = await profileService.completeOnboarding({ userId: user.id })
            expect(updated.hasCompletedOnboarding).toBe(true)
        })

        it('should throw 404 if user not found', async () => {
            expect(profileService.completeOnboarding({ userId: 'fake-id' })).rejects.toThrow(
                'user not found'
            )
        })
    })

    describe('createFeedback', () => {
        it('should create feedback successfully', async () => {
            const user = await createUser()
            const feedback = await profileService.createFeedback({
                userId: user.id,
                rating: 5,
                feedback: 'Great app',
            })
            expect(feedback.feedback).toBe('Great app')
            expect(feedback.rating).toBe('5')
        })
    })
})
