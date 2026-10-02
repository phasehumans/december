import bcrypt from 'bcrypt'
import { describe, it, expect, beforeEach } from 'bun:test'

import { settingRepository } from '../../src/modules/setting/setting.repository'
import { settingService } from '../../src/modules/setting/setting.service'
import { AppError } from '../../src/shared/appError'
import { appCache } from '../../src/shared/cache'

describe('Setting Service - Unit Tests', () => {
    beforeEach(async () => {
        await appCache.clearAll()
    })
    describe('getMe', () => {
        it('should throw AppError 404 if user not found', async () => {
            const original = settingRepository.findUserByIdForInfo
            settingRepository.findUserByIdForInfo = (async () => null) as any

            try {
                await expect(settingService.getMe({ userId: 'u1' })).rejects.toThrow(
                    new AppError('user not found', 404)
                )
            } finally {
                settingRepository.findUserByIdForInfo = original
            }
        })

        it('should return fullName and isGithubConnected', async () => {
            const original = settingRepository.findUserByIdForInfo
            settingRepository.findUserByIdForInfo = (async () => ({
                name: 'Alice Wonder',
                githubConnected: true,
            })) as any

            try {
                const res = await settingService.getMe({ userId: 'u1' })
                expect(res).toEqual({
                    fullName: 'Alice Wonder',
                    isGithubConnected: true,
                })
            } finally {
                settingRepository.findUserByIdForInfo = original
            }
        })

        it('should fallback fullName to "Profile" if name is null', async () => {
            const original = settingRepository.findUserByIdForInfo
            settingRepository.findUserByIdForInfo = (async () => ({
                name: null,
                githubConnected: false,
            })) as any

            try {
                const res = await settingService.getMe({ userId: 'u1' })
                expect(res).toEqual({
                    fullName: 'Profile',
                    isGithubConnected: false,
                })
            } finally {
                settingRepository.findUserByIdForInfo = original
            }
        })
    })

    describe('getProfile', () => {
        it('should throw AppError 404 if profile not found', async () => {
            const original = settingRepository.findUserByIdForProfile
            settingRepository.findUserByIdForProfile = (async () => null) as any

            try {
                await expect(settingService.getProfile({ userId: 'u1' })).rejects.toThrow(
                    new AppError('user not found', 404)
                )
            } finally {
                settingRepository.findUserByIdForProfile = original
            }
        })

        it('should return profile without password and with hasPassword boolean', async () => {
            const original = settingRepository.findUserByIdForProfile
            settingRepository.findUserByIdForProfile = (async () => ({
                id: 'u1',
                email: 'alice@example.com',
                password: 'hashed-password-123',
                name: 'Alice',
            })) as any

            try {
                const res = await settingService.getProfile({ userId: 'u1' })
                expect(res.id).toBe('u1')
                expect(res.email).toBe('alice@example.com')
                expect((res as any).password).toBeUndefined()
                expect(res.hasPassword).toBe(true)
            } finally {
                settingRepository.findUserByIdForProfile = original
            }
        })
    })

    describe('updateName', () => {
        it('should throw AppError 404 if user not found', async () => {
            const original = settingRepository.findUserByIdForExistCheck
            settingRepository.findUserByIdForExistCheck = (async () => null) as any

            try {
                await expect(
                    settingService.updateName({ userId: 'u1', name: 'New Name' })
                ).rejects.toThrow(new AppError('user not found', 404))
            } finally {
                settingRepository.findUserByIdForExistCheck = original
            }
        })

        it('should update and return updated user name', async () => {
            const originalExist = settingRepository.findUserByIdForExistCheck
            const originalUpdate = settingRepository.updateUserName

            settingRepository.findUserByIdForExistCheck = (async () => ({ id: 'u1' })) as any
            settingRepository.updateUserName = (async (userId, name) => ({
                id: userId,
                name,
            })) as any

            try {
                const res = await settingService.updateName({ userId: 'u1', name: 'Alice Smith' })
                expect(res).toEqual({ id: 'u1', name: 'Alice Smith' } as any)
            } finally {
                settingRepository.findUserByIdForExistCheck = originalExist
                settingRepository.updateUserName = originalUpdate
            }
        })
    })

    describe('updateUsername', () => {
        it('should throw AppError 404 if user does not exist', async () => {
            const original = settingRepository.findUserByIdForUsernameCheck
            settingRepository.findUserByIdForUsernameCheck = (async () => null) as any

            try {
                await expect(
                    settingService.updateUsername({ userId: 'u1', username: 'new_username' })
                ).rejects.toThrow(new AppError('user not found', 404))
            } finally {
                settingRepository.findUserByIdForUsernameCheck = original
            }
        })

        it('should throw AppError 400 if new username is identical to current username', async () => {
            const original = settingRepository.findUserByIdForUsernameCheck
            settingRepository.findUserByIdForUsernameCheck = (async () => ({
                username: 'alice_smith',
            })) as any

            try {
                await expect(
                    settingService.updateUsername({ userId: 'u1', username: 'alice_smith' })
                ).rejects.toThrow(
                    new AppError('new username must be different from the current one', 400)
                )
            } finally {
                settingRepository.findUserByIdForUsernameCheck = original
            }
        })

        it('should throw AppError 409 if username is already taken', async () => {
            const originalCheck = settingRepository.findUserByIdForUsernameCheck
            const originalFind = settingRepository.findUserByUsername

            settingRepository.findUserByIdForUsernameCheck = (async () => ({
                username: 'old_username',
            })) as any
            settingRepository.findUserByUsername = (async () => ({
                id: 'other-user',
                username: 'taken_user',
            })) as any

            try {
                await expect(
                    settingService.updateUsername({ userId: 'u1', username: 'taken_user' })
                ).rejects.toThrow(new AppError('taken_user is already taken, try another one', 409))
            } finally {
                settingRepository.findUserByIdForUsernameCheck = originalCheck
                settingRepository.findUserByUsername = originalFind
            }
        })

        it('should handle Prisma P2002 race condition gracefully', async () => {
            const originalCheck = settingRepository.findUserByIdForUsernameCheck
            const originalFind = settingRepository.findUserByUsername
            const originalUpdate = settingRepository.updateUsername

            settingRepository.findUserByIdForUsernameCheck = (async () => ({
                username: 'old_username',
            })) as any
            settingRepository.findUserByUsername = (async () => null) as any
            settingRepository.updateUsername = (async () => {
                const err: any = new Error('Unique constraint failed')
                err.code = 'P2002'
                throw err
            }) as any

            try {
                await expect(
                    settingService.updateUsername({ userId: 'u1', username: 'new_unique_name' })
                ).rejects.toThrow(
                    new AppError('new_unique_name is already taken, try another one', 409)
                )
            } finally {
                settingRepository.findUserByIdForUsernameCheck = originalCheck
                settingRepository.findUserByUsername = originalFind
                settingRepository.updateUsername = originalUpdate
            }
        })
    })

    describe('changePassword', () => {
        it('should allow OAuth user without password to set new password without currentPassword', async () => {
            const originalFind = settingRepository.findUserPasswordById
            const originalUpdate = settingRepository.updatePassword

            let updatedHash = ''
            settingRepository.findUserPasswordById = (async () => ({
                id: 'u1',
                password: null,
            })) as any
            settingRepository.updatePassword = (async (_userId, hash) => {
                updatedHash = hash
                return {} as any
            }) as any

            try {
                const res = await settingService.changePassword({
                    userId: 'u1',
                    newPassword: 'MyNewPassword123!',
                })
                expect(res).toEqual({ success: true })
                expect(await bcrypt.compare('MyNewPassword123!', updatedHash)).toBe(true)
            } finally {
                settingRepository.findUserPasswordById = originalFind
                settingRepository.updatePassword = originalUpdate
            }
        })

        it('should throw AppError 400 if currentPassword is missing for user with existing password', async () => {
            const originalFind = settingRepository.findUserPasswordById
            const hashed = await bcrypt.hash('ExistingPass123!', 10)
            settingRepository.findUserPasswordById = (async () => ({
                id: 'u1',
                password: hashed,
            })) as any

            try {
                await expect(
                    settingService.changePassword({
                        userId: 'u1',
                        newPassword: 'NewPass123!',
                    })
                ).rejects.toThrow(new AppError('current password is required', 400))
            } finally {
                settingRepository.findUserPasswordById = originalFind
            }
        })

        it('should throw AppError 401 if currentPassword is wrong', async () => {
            const originalFind = settingRepository.findUserPasswordById
            const hashed = await bcrypt.hash('ExistingPass123!', 10)
            settingRepository.findUserPasswordById = (async () => ({
                id: 'u1',
                password: hashed,
            })) as any

            try {
                await expect(
                    settingService.changePassword({
                        userId: 'u1',
                        currentPassword: 'WrongPassword!',
                        newPassword: 'NewPass123!',
                    })
                ).rejects.toThrow(new AppError('current password is incorrect', 401))
            } finally {
                settingRepository.findUserPasswordById = originalFind
            }
        })

        it('should throw AppError 400 if new password is same as current password', async () => {
            const originalFind = settingRepository.findUserPasswordById
            const hashed = await bcrypt.hash('SamePassword123!', 10)
            settingRepository.findUserPasswordById = (async () => ({
                id: 'u1',
                password: hashed,
            })) as any

            try {
                await expect(
                    settingService.changePassword({
                        userId: 'u1',
                        currentPassword: 'SamePassword123!',
                        newPassword: 'SamePassword123!',
                    })
                ).rejects.toThrow(
                    new AppError('new password must be different from current password', 400)
                )
            } finally {
                settingRepository.findUserPasswordById = originalFind
            }
        })

        it('should update password successfully with valid current and new password', async () => {
            const originalFind = settingRepository.findUserPasswordById
            const originalUpdate = settingRepository.updatePassword
            const hashed = await bcrypt.hash('OldPassword123!', 10)

            let newHash = ''
            settingRepository.findUserPasswordById = (async () => ({
                id: 'u1',
                password: hashed,
            })) as any
            settingRepository.updatePassword = (async (_userId, hash) => {
                newHash = hash
                return {} as any
            }) as any

            try {
                const res = await settingService.changePassword({
                    userId: 'u1',
                    currentPassword: 'OldPassword123!',
                    newPassword: 'NewPassword123!',
                })
                expect(res).toEqual({ success: true })
                expect(await bcrypt.compare('NewPassword123!', newHash)).toBe(true)
            } finally {
                settingRepository.findUserPasswordById = originalFind
                settingRepository.updatePassword = originalUpdate
            }
        })
    })

    describe('updateNotifications', () => {
        it('should throw AppError 400 if no notification fields provided', async () => {
            const originalExist = settingRepository.findUserByIdForExistCheck
            settingRepository.findUserByIdForExistCheck = (async () => ({ id: 'u1' })) as any

            try {
                await expect(
                    settingService.updateNotifications({
                        userId: 'u1',
                    })
                ).rejects.toThrow(
                    new AppError('at least one notification setting must be provided', 400)
                )
            } finally {
                settingRepository.findUserByIdForExistCheck = originalExist
            }
        })

        it('should update notification flags when provided', async () => {
            const originalExist = settingRepository.findUserByIdForExistCheck
            const originalUpdate = settingRepository.updateNotifications

            let updatePayload: any = null
            settingRepository.findUserByIdForExistCheck = (async () => ({ id: 'u1' })) as any
            settingRepository.updateNotifications = (async (_userId, data) => {
                updatePayload = data
                return { id: 'u1', ...data } as any
            }) as any

            try {
                const res = await settingService.updateNotifications({
                    userId: 'u1',
                    notifyProjectActivity: true,
                    notifyProductUpdates: false,
                })
                expect(updatePayload).toEqual({
                    notifyProjectActivity: true,
                    notifyProductUpdates: false,
                })
                expect(res.id).toBe('u1')
            } finally {
                settingRepository.findUserByIdForExistCheck = originalExist
                settingRepository.updateNotifications = originalUpdate
            }
        })
    })

    describe('onboarding and feedback', () => {
        it('completeOnboarding should update onboarding status', async () => {
            const originalExist = settingRepository.findUserByIdForExistCheck
            const originalUpdate = settingRepository.updateCompleteOnboarding

            settingRepository.findUserByIdForExistCheck = (async () => ({ id: 'u1' })) as any
            settingRepository.updateCompleteOnboarding = (async () => ({
                id: 'u1',
                hasCompletedOnboarding: true,
            })) as any

            try {
                const res = await settingService.completeOnboarding({ userId: 'u1' })
                expect(res.hasCompletedOnboarding).toBe(true)
            } finally {
                settingRepository.findUserByIdForExistCheck = originalExist
                settingRepository.updateCompleteOnboarding = originalUpdate
            }
        })

        it('dismissOnboardingCard should update appropriate card done flag', async () => {
            const originalExist = settingRepository.findUserByIdForExistCheck
            const originalWelcome = settingRepository.updateWelcomeCardDone
            const originalGithub = settingRepository.updateGithubCardDone
            const originalFeedback = settingRepository.updateFeedbackCardDone

            settingRepository.findUserByIdForExistCheck = (async () => ({ id: 'u1' })) as any
            settingRepository.updateWelcomeCardDone = (async () => ({
                welcomeCardDone: true,
            })) as any
            settingRepository.updateGithubCardDone = (async () => ({ githubCardDone: true })) as any
            settingRepository.updateFeedbackCardDone = (async () => ({
                feedbackCardDone: true,
            })) as any

            try {
                const r1 = await settingService.dismissOnboardingCard({
                    userId: 'u1',
                    card: 'welcome',
                })
                expect((r1 as any).welcomeCardDone).toBe(true)

                const r2 = await settingService.dismissOnboardingCard({
                    userId: 'u1',
                    card: 'github',
                })
                expect((r2 as any).githubCardDone).toBe(true)

                const r3 = await settingService.dismissOnboardingCard({
                    userId: 'u1',
                    card: 'feedback',
                })
                expect((r3 as any).feedbackCardDone).toBe(true)
            } finally {
                settingRepository.findUserByIdForExistCheck = originalExist
                settingRepository.updateWelcomeCardDone = originalWelcome
                settingRepository.updateGithubCardDone = originalGithub
                settingRepository.updateFeedbackCardDone = originalFeedback
            }
        })

        it('submitFeedback should store feedback and mark card done', async () => {
            const originalExist = settingRepository.findUserByIdForExistCheck
            const originalCreateFb = settingRepository.createFeedback
            const originalFeedbackDone = settingRepository.updateFeedbackCardDone

            let fbCreated = false
            settingRepository.findUserByIdForExistCheck = (async () => ({ id: 'u1' })) as any
            settingRepository.createFeedback = (async () => {
                fbCreated = true
                return {} as any
            }) as any
            settingRepository.updateFeedbackCardDone = (async () => ({
                feedbackCardDone: true,
            })) as any

            try {
                const res = await settingService.submitFeedback({
                    userId: 'u1',
                    rating: 'happy',
                    feedback: 'Loving the app!',
                })
                expect(fbCreated).toBe(true)
                expect((res as any).feedbackCardDone).toBe(true)
            } finally {
                settingRepository.findUserByIdForExistCheck = originalExist
                settingRepository.createFeedback = originalCreateFb
                settingRepository.updateFeedbackCardDone = originalFeedbackDone
            }
        })
    })

    describe('caching behavior', () => {
        it('should return cached profile without querying repository on second call, and bust cache on update', async () => {
            let repositoryCallCount = 0
            const originalFind = settingRepository.findUserByIdForProfile
            const originalExist = settingRepository.findUserByIdForExistCheck
            const originalUpdateName = settingRepository.updateUserName

            settingRepository.findUserByIdForProfile = (async () => {
                repositoryCallCount++
                return {
                    id: 'u1',
                    name: 'Initial Name',
                    password: null,
                }
            }) as any
            settingRepository.findUserByIdForExistCheck = (async () => ({ id: 'u1' })) as any
            settingRepository.updateUserName = (async (_id, name) => ({ id: 'u1', name })) as any

            try {
                // First call: repository is called
                const p1 = await settingService.getProfile({ userId: 'u1' })
                expect(p1.name).toBe('Initial Name')
                expect(repositoryCallCount).toBe(1)

                // Second call: served from cache, repository not called
                const p2 = await settingService.getProfile({ userId: 'u1' })
                expect(p2.name).toBe('Initial Name')
                expect(repositoryCallCount).toBe(1)

                // Update name: busts user setting cache
                await settingService.updateName({ userId: 'u1', name: 'Updated Name' })

                // Change repository return value to simulate DB change
                settingRepository.findUserByIdForProfile = (async () => {
                    repositoryCallCount++
                    return {
                        id: 'u1',
                        name: 'Updated Name',
                        password: null,
                    }
                }) as any

                // Third call: cache was invalidated, so repository is called again
                const p3 = await settingService.getProfile({ userId: 'u1' })
                expect(p3.name).toBe('Updated Name')
                expect(repositoryCallCount).toBe(2)
            } finally {
                settingRepository.findUserByIdForProfile = originalFind
                settingRepository.findUserByIdForExistCheck = originalExist
                settingRepository.updateUserName = originalUpdateName
            }
        })
    })
})
