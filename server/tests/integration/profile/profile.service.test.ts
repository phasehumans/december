import { describe, it, expect, beforeEach, afterAll } from 'bun:test'
import bcrypt from 'bcrypt'

import { prisma } from '../../.././src/config/db'
import { profileService } from '../../../src/modules/profile/profile.service'

describe('Profile Service Integration Tests', () => {
    let testUserId: string

    beforeEach(async () => {
        await prisma.user.deleteMany()

        const hashedPassword = await bcrypt.hash('oldpassword123', 10)

        const user = await prisma.user.create({
            data: {
                email: 'profiletest@example.com',
                password: hashedPassword,
                name: 'Old Name',
                username: 'profiletest',
                emailVerified: true,
                receiveNotification: true,
                githubConnected: false,
            },
        })

        testUserId = user.id
    })

    afterAll(async () => {
        await prisma.user.deleteMany()
        await prisma.$disconnect()
    })

    describe('getProfile', () => {
        it('should return user profile when user exists', async () => {
            const profile = await profileService.getProfile(testUserId)

            expect(profile).toBeDefined()
            expect(profile.id).toBe(testUserId)
            expect(profile.email).toBe('profiletest@example.com')
            expect(profile.name).toBe('Old Name')
            expect(profile.username).toBe('profiletest')
        })

        it('should throw error if user does not exist', async () => {
            await expect(profileService.getProfile('non-existent-id')).rejects.toThrow(
                'user not found'
            )
        })
    })

    describe('updateName', () => {
        it('should update user name successfully', async () => {
            const updatedUser = await profileService.updateName({
                userId: testUserId,
                name: 'New Name',
            })

            expect(updatedUser.name).toBe('New Name')

            const dbUser = await prisma.user.findUnique({
                where: { id: testUserId },
            })

            expect(dbUser?.name).toBe('New Name')
        })

        it('should throw error if user does not exist', async () => {
            await expect(
                profileService.updateName({
                    userId: 'non-existent-id',
                    name: 'New Name',
                })
            ).rejects.toThrow('user not found')
        })
    })

    describe('changePassword', () => {
        it('should change password successfully and hash it', async () => {
            const updatedUser = await profileService.changePassword({
                userId: testUserId,
                password: 'newpassword123',
            })

            expect(updatedUser.password).toBeDefined()
            expect(updatedUser.password).not.toBe('newpassword123')

            const isMatch = await bcrypt.compare('newpassword123', updatedUser!.password!)

            expect(isMatch).toBe(true)

            const dbUser = await prisma.user.findUnique({
                where: { id: testUserId },
            })

            expect(dbUser).toBeDefined()

            const isDbMatch = await bcrypt.compare('newpassword123', dbUser!.password!)

            expect(isDbMatch).toBe(true)
        })

        it('should throw error if user does not exist', async () => {
            await expect(
                profileService.changePassword({
                    userId: 'non-existent-id',
                    password: 'newpassword123',
                })
            ).rejects.toThrow('user not found')
        })
    })

    describe('updateNotification', () => {
        it('should update receiveNotification to false', async () => {
            const updatedUser = await profileService.updateNotification({
                userId: testUserId,
                receiveNotification: false,
            })

            expect(updatedUser.receiveNotification).toBe(false)

            const dbUser = await prisma.user.findUnique({
                where: { id: testUserId },
            })

            expect(dbUser?.receiveNotification).toBe(false)
        })

        it('should update receiveNotification to true', async () => {
            await prisma.user.update({
                where: { id: testUserId },
                data: { receiveNotification: false },
            })

            const updatedUser = await profileService.updateNotification({
                userId: testUserId,
                receiveNotification: true,
            })

            expect(updatedUser.receiveNotification).toBe(true)

            const dbUser = await prisma.user.findUnique({
                where: { id: testUserId },
            })

            expect(dbUser?.receiveNotification).toBe(true)
        })

        it('should throw error if user does not exist', async () => {
            await expect(
                profileService.updateNotification({
                    userId: 'non-existent-id',
                    receiveNotification: false,
                })
            ).rejects.toThrow('user not found')
        })
    })

    describe('connectGithub', () => {
        it('should connect github successfully', async () => {
            const updatedUser = await profileService.connectGithub({
                userId: testUserId,
                username: 'chaitanya-github',
                accessToken: 'github-access-token-123',
            })

            expect(updatedUser.githubUsername).toBe('chaitanya-github')
            expect(updatedUser.githubToken).toBe('github-access-token-123')
            expect(updatedUser.githubConnected).toBe(true)

            const dbUser = await prisma.user.findUnique({
                where: { id: testUserId },
            })

            expect(dbUser?.githubUsername).toBe('chaitanya-github')
            expect(dbUser?.githubToken).toBe('github-access-token-123')
            expect(dbUser?.githubConnected).toBe(true)
        })

        it('should throw error if user does not exist', async () => {
            await expect(
                profileService.connectGithub({
                    userId: 'non-existent-id',
                    username: 'chaitanya-github',
                    accessToken: 'github-access-token-123',
                })
            ).rejects.toThrow('user not found')
        })
    })
})
