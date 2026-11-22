import { describe, it, expect } from 'bun:test'

import { sessionCache } from '../../src/modules/auth/auth.cache'
import { authRepository } from '../../src/modules/auth/auth.repository'
import { authService } from '../../src/modules/auth/auth.service'
import { emailService } from '../../src/modules/email/email.service'
import { notificationService } from '../../src/modules/notification/notification.service'
import { AppError } from '../../src/shared/appError'

describe('Auth Service - Unit Tests', () => {
    describe('signup', () => {
        it('should throw AppError 400 if user exists with social login (no password)', async () => {
            const originalFind = authRepository.findUserByEmail
            authRepository.findUserByEmail = (async () => ({
                id: 'user-1',
                email: 'social@example.com',
                password: null,
                emailVerified: true,
            })) as any

            try {
                await expect(
                    authService.signup({ email: 'social@example.com', password: 'Password123!' })
                ).rejects.toThrow(new AppError('account exists with social login', 400))
            } finally {
                authRepository.findUserByEmail = originalFind
            }
        })

        it('should throw AppError 409 if user exists and email is already verified', async () => {
            const originalFind = authRepository.findUserByEmail
            authRepository.findUserByEmail = (async () => ({
                id: 'user-2',
                email: 'verified@example.com',
                password: 'hashed-password',
                emailVerified: true,
            })) as any

            try {
                await expect(
                    authService.signup({ email: 'verified@example.com', password: 'Password123!' })
                ).rejects.toThrow(new AppError('email already exists', 409))
            } finally {
                authRepository.findUserByEmail = originalFind
            }
        })
    })

    describe('verifyOtp', () => {
        it('should throw AppError 404 if user not found', async () => {
            const originalFind = authRepository.findUserByEmail
            authRepository.findUserByEmail = (async () => null) as any

            try {
                await expect(
                    authService.verifyOtp({ email: 'unknown@example.com', otp: '123456' })
                ).rejects.toThrow(new AppError('user not found', 404))
            } finally {
                authRepository.findUserByEmail = originalFind
            }
        })

        it('should throw AppError 403 if user is marked as deleted', async () => {
            const originalFind = authRepository.findUserByEmail
            authRepository.findUserByEmail = (async () => ({
                id: 'deleted-user',
                email: 'deleted@example.com',
                isDeleted: true,
            })) as any

            try {
                await expect(
                    authService.verifyOtp({ email: 'deleted@example.com', otp: '123456' })
                ).rejects.toThrow(new AppError('account has been deleted', 403))
            } finally {
                authRepository.findUserByEmail = originalFind
            }
        })

        it('should throw AppError 400 if user email is already verified', async () => {
            const originalFind = authRepository.findUserByEmail
            authRepository.findUserByEmail = (async () => ({
                id: 'verified-user',
                email: 'verified@example.com',
                isDeleted: false,
                emailVerified: true,
            })) as any

            try {
                await expect(
                    authService.verifyOtp({ email: 'verified@example.com', otp: '123456' })
                ).rejects.toThrow(new AppError('email already verified', 400))
            } finally {
                authRepository.findUserByEmail = originalFind
            }
        })

        it('should throw AppError 400 if OTP is not found', async () => {
            const originalFind = authRepository.findUserByEmail
            authRepository.findUserByEmail = (async () => ({
                id: 'no-otp-user',
                email: 'nootp@example.com',
                isDeleted: false,
                emailVerified: false,
                otpHash: null,
                otpExpiresAt: null,
            })) as any

            try {
                await expect(
                    authService.verifyOtp({ email: 'nootp@example.com', otp: '123456' })
                ).rejects.toThrow(new AppError('otp not found, request new one', 400))
            } finally {
                authRepository.findUserByEmail = originalFind
            }
        })
    })

    describe('login', () => {
        it('should throw AppError 401 for non-existent user email', async () => {
            const originalFind = authRepository.findUserByEmail
            authRepository.findUserByEmail = (async () => null) as any

            try {
                await expect(
                    authService.login({
                        email: 'nonexistent@example.com',
                        password: 'Password123!',
                    })
                ).rejects.toThrow(new AppError('invalid email or password', 401))
            } finally {
                authRepository.findUserByEmail = originalFind
            }
        })

        it('should throw AppError 401 if email is unverified', async () => {
            const originalFind = authRepository.findUserByEmail
            authRepository.findUserByEmail = (async () => ({
                id: 'unverified-user',
                email: 'unverified@example.com',
                emailVerified: false,
            })) as any

            try {
                await expect(
                    authService.login({ email: 'unverified@example.com', password: 'Password123!' })
                ).rejects.toThrow(new AppError('please verify your email', 401))
            } finally {
                authRepository.findUserByEmail = originalFind
            }
        })

        it('should tell a github-only user to continue with github', async () => {
            const originalFind = authRepository.findUserByEmail
            authRepository.findUserByEmail = (async () => ({
                id: 'gh-user',
                email: 'gh@example.com',
                emailVerified: true,
                password: null,
                githubId: '42',
                googleId: null,
            })) as any

            try {
                await expect(
                    authService.login({ email: 'gh@example.com', password: 'Password123!' })
                ).rejects.toThrow(new AppError('please continue with github login', 401))
            } finally {
                authRepository.findUserByEmail = originalFind
            }
        })

        it('should tell a google-only user to continue with google', async () => {
            const originalFind = authRepository.findUserByEmail
            authRepository.findUserByEmail = (async () => ({
                id: 'google-user',
                email: 'google@example.com',
                emailVerified: true,
                password: null,
                githubId: null,
                googleId: 'g-1',
            })) as any

            try {
                await expect(
                    authService.login({ email: 'google@example.com', password: 'Password123!' })
                ).rejects.toThrow(new AppError('please continue with google login', 401))
            } finally {
                authRepository.findUserByEmail = originalFind
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
                welcome: emailService.sendWelcomeEmail,
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
            emailService.sendWelcomeEmail = (async () => ({})) as any

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
                emailService.sendWelcomeEmail = original.welcome
            }
        }

        const githubLogin = {
            name: 'Victim',
            email: 'victim@example.com',
            sub: '42',
            username: 'victim',
        }

        it('github clears a password set on an unverified account before linking', async () => {
            await withSocialStubs(
                {
                    byEmail: {
                        id: 'squatted',
                        email: 'victim@example.com',
                        emailVerified: false,
                        password: 'attacker-hash',
                        githubId: null,
                    },
                },
                async ({ updates }) => {
                    await authService.github(githubLogin)
                    expect(updates).toHaveLength(1)
                    expect(updates[0].password).toBeNull()
                    expect(updates[0].githubId).toBe('42')
                }
            )
        })

        it('github keeps the password of a verified account when linking', async () => {
            await withSocialStubs(
                {
                    byEmail: {
                        id: 'owner',
                        email: 'victim@example.com',
                        emailVerified: true,
                        password: 'owner-hash',
                        githubId: null,
                    },
                },
                async ({ updates }) => {
                    await authService.github(githubLogin)
                    expect(updates).toHaveLength(1)
                    expect('password' in updates[0]).toBe(false)
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

        it('google clears a password set on an unverified account before linking', async () => {
            await withSocialStubs(
                {
                    byEmail: {
                        id: 'squatted',
                        email: 'victim@example.com',
                        emailVerified: false,
                        password: 'attacker-hash',
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
                    expect(updates[0].password).toBeNull()
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
