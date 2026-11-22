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

        it('should return the profile row', async () => {
            const original = settingRepository.findUserByIdForProfile
            settingRepository.findUserByIdForProfile = (async () => ({
                id: 'u1',
                email: 'alice@example.com',
                name: 'Alice',
            })) as any

            try {
                const res = await settingService.getProfile({ userId: 'u1' })
                expect(res.id).toBe('u1')
                expect(res.email).toBe('alice@example.com')
                expect(res).not.toHaveProperty('hasPassword')
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
        const baseSource = {
            onboardingCompletedAt: null,
            onboardingStep: null,
            creditBalance: 0,
            githubInstallations: [],
            providerCredentials: [],
        }

        it('getOnboarding should report every step as open for a new user', async () => {
            const originalFind = settingRepository.findOnboardingSource
            settingRepository.findOnboardingSource = (async () => baseSource) as any

            try {
                const state = await settingService.getOnboarding({ userId: 'u1' })
                expect(state.completedAt).toBeNull()
                expect(state.step).toBeNull()
                expect(state.steps).toEqual({ models: false, github: false })
            } finally {
                settingRepository.findOnboardingSource = originalFind
            }
        })

        it('getOnboarding should mark steps done from real data', async () => {
            const originalFind = settingRepository.findOnboardingSource
            settingRepository.findOnboardingSource = (async () => ({
                ...baseSource,
                onboardingStep: 'models',
                githubInstallations: [{ accountLogin: 'octo' }],
                providerCredentials: [{ provider: 'anthropic', keyHint: 'a9F2' }],
            })) as any

            try {
                const state = await settingService.getOnboarding({ userId: 'u1' })
                expect(state.step).toBe('models')
                expect(state.steps).toEqual({ models: true, github: true })
                expect(state.github).toEqual({ accountLogin: 'octo' })
                expect(state.ownKey).toEqual({ provider: 'anthropic', keyHint: 'a9F2' })
            } finally {
                settingRepository.findOnboardingSource = originalFind
            }
        })

        it('getOnboarding should count a positive balance as paying for models', async () => {
            const originalFind = settingRepository.findOnboardingSource
            settingRepository.findOnboardingSource = (async () => ({
                ...baseSource,
                creditBalance: 500,
            })) as any

            try {
                const state = await settingService.getOnboarding({ userId: 'u1' })
                expect(state.steps.models).toBe(true)
                expect(state.wallet.balanceInCents).toBe(500)
                expect(state.ownKey).toBeNull()
            } finally {
                settingRepository.findOnboardingSource = originalFind
            }
        })

        it('getOnboarding should ignore an unknown saved step', async () => {
            const originalFind = settingRepository.findOnboardingSource
            settingRepository.findOnboardingSource = (async () => ({
                ...baseSource,
                onboardingStep: 'welcome',
            })) as any

            try {
                const state = await settingService.getOnboarding({ userId: 'u1' })
                expect(state.step).toBeNull()
            } finally {
                settingRepository.findOnboardingSource = originalFind
            }
        })

        it('completeOnboarding should mark the user done and return the state', async () => {
            const originalExist = settingRepository.findUserByIdForExistCheck
            const originalMark = settingRepository.markOnboardingCompleted
            const originalFind = settingRepository.findOnboardingSource
            const completedAt = new Date()
            let marked = false

            settingRepository.findUserByIdForExistCheck = (async () => ({ id: 'u1' })) as any
            settingRepository.markOnboardingCompleted = (async () => {
                marked = true
                return { count: 1 }
            }) as any
            settingRepository.findOnboardingSource = (async () => ({
                ...baseSource,
                onboardingCompletedAt: completedAt,
            })) as any

            try {
                const state = await settingService.completeOnboarding({ userId: 'u1' })
                expect(marked).toBe(true)
                expect(state.completedAt).toEqual(completedAt)
            } finally {
                settingRepository.findUserByIdForExistCheck = originalExist
                settingRepository.markOnboardingCompleted = originalMark
                settingRepository.findOnboardingSource = originalFind
            }
        })

        it('completeOnboarding should throw 404 for a missing user', async () => {
            const originalExist = settingRepository.findUserByIdForExistCheck
            settingRepository.findUserByIdForExistCheck = (async () => null) as any

            try {
                await expect(settingService.completeOnboarding({ userId: 'nope' })).rejects.toThrow(
                    'user not found'
                )
            } finally {
                settingRepository.findUserByIdForExistCheck = originalExist
            }
        })

        it('submitFeedback should store feedback', async () => {
            const originalExist = settingRepository.findUserByIdForExistCheck
            const originalCreateFb = settingRepository.createFeedback

            let fbCreated = false
            settingRepository.findUserByIdForExistCheck = (async () => ({ id: 'u1' })) as any
            settingRepository.createFeedback = (async () => {
                fbCreated = true
                return { id: 'f1' } as any
            }) as any

            try {
                const res = await settingService.submitFeedback({
                    userId: 'u1',
                    rating: 'happy',
                    feedback: 'Loving the app!',
                })
                expect(fbCreated).toBe(true)
                expect(res).toEqual({ id: 'f1' })
            } finally {
                settingRepository.findUserByIdForExistCheck = originalExist
                settingRepository.createFeedback = originalCreateFb
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
