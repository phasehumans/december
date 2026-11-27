import { describe, it, expect } from 'bun:test'

import { sessionCache } from '../../src/modules/auth/auth.cache'
import { authRepository } from '../../src/modules/auth/auth.repository'
import { authService } from '../../src/modules/auth/auth.service'
import { notificationService } from '../../src/modules/notification/notification.service'
import { AppError } from '../../src/shared/appError'

describe('Auth Service - Unit Tests', () => {
    describe('startEmailAuth', () => {
        it('should throw AppError 403 if the account was deleted', async () => {
            const originalFind = authRepository.findUserByEmail
            authRepository.findUserByEmail = (async () => ({
                id: 'user-1',
                email: 'deleted@example.com',
                isDeleted: true,
            })) as any

            try {
                await expect(
                    authService.startEmailAuth({ email: 'deleted@example.com' })
                ).rejects.toThrow(new AppError('account has been deleted', 403))
            } finally {
                authRepository.findUserByEmail = originalFind
            }
        })

        it('should throw AppError 429 if a code was sent less than 30 seconds ago', async () => {
            const originalFind = authRepository.findUserByEmail
            authRepository.findUserByEmail = (async () => ({
                id: 'user-2',
                email: 'recent@example.com',
                otpExpiresAt: new Date(Date.now() + 10 * 60 * 1000 - 5 * 1000),
            })) as any

            try {
                await expect(
                    authService.startEmailAuth({ email: 'recent@example.com' })
                ).rejects.toThrow(
                    new AppError('please wait a few seconds before requesting a new code', 429)
                )
            } finally {
                authRepository.findUserByEmail = originalFind
            }
        })
    })

    describe('verifyEmailAuth', () => {
        it('should throw AppError 401 if no user or code exists', async () => {
            const originalFind = authRepository.findUserByEmail
            authRepository.findUserByEmail = (async () => null) as any

            try {
                await expect(
                    authService.verifyEmailAuth({ email: 'unknown@example.com', otp: '123456' })
                ).rejects.toThrow(new AppError('invalid or expired code, request a new one', 401))
            } finally {
                authRepository.findUserByEmail = originalFind
            }
        })

        it('should throw AppError 403 if the account was deleted', async () => {
            const originalFind = authRepository.findUserByEmail
            authRepository.findUserByEmail = (async () => ({
                id: 'user-3',
                email: 'deleted@example.com',
                deletedAt: new Date(),
                otpHash: 'hash',
                otpExpiresAt: new Date(Date.now() + 60 * 1000),
            })) as any

            try {
                await expect(
                    authService.verifyEmailAuth({ email: 'deleted@example.com', otp: '123456' })
                ).rejects.toThrow(new AppError('account has been deleted', 403))
            } finally {
                authRepository.findUserByEmail = originalFind
            }
        })
    })

    describe('verifyEmailAuth attempt limit', () => {
        const otpHash = '$2b$04$abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ01'

        const withUser = async (
            overrides: Partial<typeof authRepository>,
            run: () => Promise<void>
        ) => {
            const originals = {
                findUserByEmail: authRepository.findUserByEmail,
                claimOtpAttempt: authRepository.claimOtpAttempt,
                clearExhaustedOtp: authRepository.clearExhaustedOtp,
                consumeOtp: authRepository.consumeOtp,
            }
            authRepository.findUserByEmail = (async () => ({
                id: 'user-otp',
                email: 'otp@example.com',
                otpHash,
                otpExpiresAt: new Date(Date.now() + 5 * 60 * 1000),
                emailVerified: true,
            })) as any
            Object.assign(authRepository, overrides)
            try {
                await run()
            } finally {
                Object.assign(authRepository, originals)
            }
        }

        it('refuses a guess when the code has no tries left, without comparing it', async () => {
            let compared = false
            await withUser(
                {
                    claimOtpAttempt: (async () => false) as any,
                    clearExhaustedOtp: (async () => {
                        compared = true
                        return false
                    }) as any,
                },
                async () => {
                    await expect(
                        authService.verifyEmailAuth({ email: 'otp@example.com', otp: '123456' })
                    ).rejects.toThrow(new AppError('too many attempts, request a new code', 429))
                    expect(compared).toBe(false)
                }
            )
        })

        it('returns 429 when a wrong guess uses the last try', async () => {
            await withUser(
                {
                    claimOtpAttempt: (async () => true) as any,
                    clearExhaustedOtp: (async () => true) as any,
                },
                async () => {
                    await expect(
                        authService.verifyEmailAuth({ email: 'otp@example.com', otp: '123456' })
                    ).rejects.toThrow(new AppError('too many attempts, request a new code', 429))
                }
            )
        })

        it('returns 401 for a wrong guess with tries left', async () => {
            await withUser(
                {
                    claimOtpAttempt: (async () => true) as any,
                    clearExhaustedOtp: (async () => false) as any,
                },
                async () => {
                    await expect(
                        authService.verifyEmailAuth({ email: 'otp@example.com', otp: '123456' })
                    ).rejects.toThrow(new AppError('invalid code', 401))
                }
            )
        })
    })

    describe('startEmailAuth race', () => {
        it('returns 429, not 500, when another start created the user first', async () => {
            const originalFind = authRepository.findUserByEmail
            const originalCreate = authRepository.createUser
            authRepository.findUserByEmail = (async () => null) as any
            authRepository.createUser = (async () => {
                throw Object.assign(new Error('Unique constraint failed'), { code: 'P2002' })
            }) as any

            try {
                await expect(
                    authService.startEmailAuth({ email: 'race@example.com' })
                ).rejects.toThrow(
                    new AppError('please wait a few seconds before requesting a new code', 429)
                )
            } finally {
                authRepository.findUserByEmail = originalFind
                authRepository.createUser = originalCreate
            }
        })
    })

    describe('social account linking', () => {
        // stubs every repository and cache call the social login path makes
        const withSocialStubs = async (
            users: { byGithubId?: any; byEmail?: any },
            run: (calls: { updates: any[]; creates: any[] }) => Promise<void>
        ) => {
            const calls = { updates: [] as any[], creates: [] as any[] }
            const original = {
                findUserByGithubId: authRepository.findUserByGithubId,
                findUserByEmail: authRepository.findUserByEmail,
                updateUser: authRepository.updateUser,
                createUser: authRepository.createUser,
                createSession: authRepository.createSession,
                cacheSet: sessionCache.set,
                notify: notificationService.sendNotificationToUser,
            }

            authRepository.findUserByGithubId = (async () => users.byGithubId ?? null) as any
            authRepository.findUserByEmail = (async () => users.byEmail ?? null) as any
            authRepository.updateUser = (async (id: string, data: any) => {
                calls.updates.push(data)
                return { ...(users.byGithubId ?? users.byEmail), id, ...data }
            }) as any
            authRepository.createUser = (async (data: any) => {
                calls.creates.push(data)
                return { id: 'new-user', ...data }
            }) as any
            authRepository.createSession = (async () => ({})) as any
            sessionCache.set = (async () => {}) as any
            notificationService.sendNotificationToUser = (async () => ({})) as any

            try {
                await run(calls)
            } finally {
                authRepository.findUserByGithubId = original.findUserByGithubId
                authRepository.findUserByEmail = original.findUserByEmail
                authRepository.updateUser = original.updateUser
                authRepository.createUser = original.createUser
                authRepository.createSession = original.createSession
                sessionCache.set = original.cacheSet
                notificationService.sendNotificationToUser = original.notify
            }
        }

        const githubLogin = {
            name: 'Victim',
            email: 'victim@example.com',
            sub: '42',
            username: 'victim',
        }

        it('github links an unverified account, verifies it and clears its pending code', async () => {
            await withSocialStubs(
                {
                    byEmail: {
                        id: 'pending',
                        email: 'victim@example.com',
                        emailVerified: false,
                        otpHash: 'pending-code',
                        githubId: null,
                    },
                },
                async ({ updates }) => {
                    await authService.github(githubLogin)
                    expect(updates).toHaveLength(1)
                    expect(updates[0].githubId).toBe('42')
                    expect(updates[0].emailVerified).toBe(true)
                    expect(updates[0].otpHash).toBeNull()
                    expect(updates[0].otpAttempts).toBe(0)
                }
            )
        })

        it('github finds the account by github id after the primary email changed', async () => {
            await withSocialStubs(
                {
                    byGithubId: {
                        id: 'existing',
                        email: 'old@example.com',
                        emailVerified: true,
                        githubId: '42',
                        githubUsername: 'victim',
                    },
                },
                async ({ creates, updates }) => {
                    const result = await authService.github({
                        ...githubLogin,
                        email: 'new@example.com',
                    })
                    expect(result.accessToken).toBeString()
                    expect(result.isNewUser).toBe(false)
                    expect('user' in result).toBe(false)
                    expect(creates).toHaveLength(0)
                    expect(updates).toHaveLength(0)
                }
            )
        })

        it('github creates a new user with the username in one write', async () => {
            await withSocialStubs({}, async ({ creates, updates }) => {
                const result = await authService.github(githubLogin)
                expect(result.isNewUser).toBe(true)
                expect(creates).toHaveLength(1)
                expect(creates[0].githubUsername).toBe('victim')
                expect(updates).toHaveLength(0)
            })
        })

        it('google links an unverified account, verifies it and clears its pending code', async () => {
            await withSocialStubs(
                {
                    byEmail: {
                        id: 'pending',
                        email: 'victim@example.com',
                        emailVerified: false,
                        otpHash: 'pending-code',
                        googleId: null,
                    },
                },
                async ({ updates }) => {
                    await authService.google({
                        name: 'Victim',
                        email: 'victim@example.com',
                        sub: 'g-1',
                    })
                    expect(updates).toHaveLength(1)
                    expect(updates[0].googleId).toBe('g-1')
                    expect(updates[0].emailVerified).toBe(true)
                    expect(updates[0].otpHash).toBeNull()
                }
            )
        })
    })

    describe('refreshSession', () => {
        it('should throw AppError 401 if token is missing', async () => {
            await expect(authService.refreshSession({})).rejects.toThrow(
                new AppError('token is required', 401)
            )
        })

        it('should throw AppError 401 if token is invalid JWT', async () => {
            await expect(
                authService.refreshSession({ refreshToken: 'invalid-jwt' })
            ).rejects.toThrow(new AppError('invalid or expired token', 401))
        })
    })

    describe('deleteAccount', () => {
        it('should throw AppError 404 if user to delete is not found', async () => {
            const originalFind = authRepository.findUserByIdForDeleteCheck
            authRepository.findUserByIdForDeleteCheck = (async () => null) as any

            try {
                await expect(authService.deleteAccount({ userId: 'non-existent' })).rejects.toThrow(
                    new AppError('user not found', 404)
                )
            } finally {
                authRepository.findUserByIdForDeleteCheck = originalFind
            }
        })

        it('should throw AppError 409 if user account is already deleted', async () => {
            const originalFind = authRepository.findUserByIdForDeleteCheck
            authRepository.findUserByIdForDeleteCheck = (async () => ({
                id: 'deleted-id',
                isDeleted: true,
            })) as any

            try {
                await expect(authService.deleteAccount({ userId: 'deleted-id' })).rejects.toThrow(
                    new AppError('user account is already deleted', 409)
                )
            } finally {
                authRepository.findUserByIdForDeleteCheck = originalFind
            }
        })
    })

    describe('pollDeviceToken & verifyUserCode', () => {
        it('pollDeviceToken throws AppError invalid_client if device code not found', async () => {
            const originalFind = authRepository.findDeviceCodeByDeviceCode
            authRepository.findDeviceCodeByDeviceCode = (async () => null) as any

            try {
                await expect(
                    authService.pollDeviceToken({ deviceCode: 'invalid' })
                ).rejects.toThrow(new AppError('invalid_client', 400))
            } finally {
                authRepository.findDeviceCodeByDeviceCode = originalFind
            }
        })

        it('verifyUserCode throws AppError Invalid code if user code not found', async () => {
            const originalFind = authRepository.findDeviceCodeByUserCode
            authRepository.findDeviceCodeByUserCode = (async () => null) as any

            try {
                await expect(
                    authService.verifyUserCode({ userCode: 'INVALID', userId: 'u-1' })
                ).rejects.toThrow(new AppError('Invalid code', 404))
            } finally {
                authRepository.findDeviceCodeByUserCode = originalFind
            }
        })
    })
})
