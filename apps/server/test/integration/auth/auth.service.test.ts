import { prisma } from '@december/database'
import bcrypt from 'bcrypt'
import { describe, it, expect, beforeEach, afterAll, mock } from 'bun:test'

import * as actualUtils from '../../../src/modules/auth/auth.utils'

const sendOTPMock = mock(async () => {})
const sendWelcomeEmailMock = mock(async () => {})
const sendNotificationMock = mock(async () => ({}))

mock.module('../../../src/modules/auth/auth.utils', () => {
    return {
        ...actualUtils,
        sendOTP: sendOTPMock,
        sendWelcomeEmail: sendWelcomeEmailMock,
    }
})

mock.module('../../../src/modules/notification/notification.service', () => ({
    sendNotificationToUser: sendNotificationMock,
}))

import { authService } from '../../../src/modules/auth/auth.service'

const createUser = async (overrides: Record<string, unknown> = {}) => {
    return prisma.user.create({
        data: {
            name: 'Test User',
            email: `test-${crypto.randomUUID()}@example.com`,
            username: `user-${crypto.randomUUID()}`,
            password: await bcrypt.hash('Password123', 10),
            emailVerified: true,
            isDeleted: false,
            ...overrides,
        },
    })
}

describe('auth.service.integration', () => {
    let isCleaningUp = false

    beforeEach(async () => {
        if (isCleaningUp) return
        sendOTPMock.mockClear()
        sendWelcomeEmailMock.mockClear()
        sendNotificationMock.mockClear()
        await prisma.authSession.deleteMany()
        await prisma.user.deleteMany()
        process.env.ACCESS_TOKEN_SECRET = 'test-access'
        process.env.REFRESH_TOKEN_SECRET = 'test-refresh'
    })

    afterAll(async () => {
        isCleaningUp = true
        await prisma.$disconnect()
    }, 15000)

    describe('signup', () => {
        it('should create unverified user with hashed password and otp', async () => {
            const email = 'test@example.com'
            const password = 'Password123'

            const result = await authService.signup({ email, password })

            expect(result).toEqual({ message: 'otp sent successfully' })

            const user = await prisma.user.findUnique({ where: { email } })
            expect(user).not.toBeNull()
            expect(user!.emailVerified).toBe(false)
            expect(user!.otpHash).toBeTruthy()
            expect(user!.otpExpiresAt).toBeTruthy()

            const isPasswordValid = await bcrypt.compare(password, user!.password!)
            expect(isPasswordValid).toBe(true)

            expect(sendOTPMock).toHaveBeenCalledTimes(1)
        })

        it('should throw if email already exists', async () => {
            const email = 'duplicate@example.com'

            await createUser({ email, username: 'dup' })

            let error: any = null
            try {
                await authService.signup({ email, password: 'Password123' })
            } catch (e) {
                error = e
            }

            expect(error).not.toBeNull()
            expect(error.message).toBe('email already exists')
        })

        it('should allow signup and resend OTP if email already exists but is unverified', async () => {
            const email = 're-signup@example.com'
            await createUser({ email, username: 're-signup', emailVerified: false })

            sendOTPMock.mockClear()
            const result = await authService.signup({ email, password: 'NewPassword123' })

            expect(result).toEqual({ message: 'otp sent successfully' })

            const user = await prisma.user.findUnique({ where: { email } })
            expect(user).not.toBeNull()
            expect(user!.emailVerified).toBe(false)
            expect(user!.otpHash).toBeTruthy()
            expect(user!.otpExpiresAt).toBeTruthy()

            const isNewPasswordValid = await bcrypt.compare('NewPassword123', user!.password!)
            expect(isNewPasswordValid).toBe(true)

            expect(sendOTPMock).toHaveBeenCalledTimes(1)
        })

        it('should set isDeleted to false on new user', async () => {
            await authService.signup({ email: 'new@example.com', password: 'Password123' })

            const user = await prisma.user.findUnique({ where: { email: 'new@example.com' } })
            expect(user!.isDeleted).toBe(false)
        })

        it('should set emailVerified to false on new user', async () => {
            await authService.signup({ email: 'unverified@example.com', password: 'Pass1234' })

            const user = await prisma.user.findUnique({
                where: { email: 'unverified@example.com' },
            })
            expect(user!.emailVerified).toBe(false)
        })

        it('should generate a username for the new user', async () => {
            await authService.signup({ email: 'username@example.com', password: 'Pass1234' })

            const user = await prisma.user.findUnique({ where: { email: 'username@example.com' } })
            expect(user!.username).toBeTruthy()
            expect(user!.username.length).toBeGreaterThan(0)
        })

        it('should call sendOTP exactly once', async () => {
            await authService.signup({ email: 'otp@example.com', password: 'Pass1234' })
            expect(sendOTPMock).toHaveBeenCalledTimes(1)
        })

        it('should throw if google account exists but no password set', async () => {
            await createUser({
                email: 'google_only@example.com',
                username: 'google_only',
                password: '',
                googleId: 'some-sub',
            })
            let error: any = null
            try {
                await authService.signup({
                    email: 'google_only@example.com',
                    password: 'Password123',
                })
            } catch (e) {
                error = e
            }
            expect(error).not.toBeNull()
            expect(error.message).toBe('google_account_exists')
        })
    })

    describe('verifyOtp', () => {
        it('should verify user and create session', async () => {
            const otp = '123456'

            const user = await createUser({
                email: 'verify@example.com',
                username: 'verify',
                emailVerified: false,
                otpHash: await bcrypt.hash(otp, 10),
                otpExpiresAt: new Date(Date.now() + 10000),
            })

            const result = await authService.verifyOtp({
                email: user.email,
                otp,
            })

            expect(result.accessToken).toBeString()
            expect(result.refreshToken).toBeString()

            const updatedUser = await prisma.user.findUnique({ where: { id: user.id } })
            expect(updatedUser!.emailVerified).toBe(true)
            expect(updatedUser!.otpHash).toBeNull()

            const session = await prisma.authSession.findFirst({ where: { userId: user.id } })
            expect(session).not.toBeNull()
        })

        it('should fail if otp is invalid', async () => {
            await createUser({
                email: 'invalid@example.com',
                username: 'test_invalid',
                emailVerified: false,
                otpHash: await bcrypt.hash('123456', 10),
                otpExpiresAt: new Date(Date.now() + 10000),
            })

            let error: any = null
            try {
                await authService.verifyOtp({ email: 'invalid@example.com', otp: '000000' })
            } catch (e) {
                error = e
            }

            expect(error).not.toBeNull()
            expect(error.message).toBe('invalid otp')
        })

        it('should fail if otp expired and clear otp fields', async () => {
            const otp = '123456'

            const user = await createUser({
                email: 'expired@example.com',
                username: 'expired',
                emailVerified: false,
                otpHash: await bcrypt.hash(otp, 10),
                otpExpiresAt: new Date(Date.now() - 1000),
            })

            let error: any = null
            try {
                await authService.verifyOtp({ email: user.email, otp })
            } catch (e) {
                error = e
            }

            expect(error).not.toBeNull()
            expect(error.message).toBe('otp expired')

            const updated = await prisma.user.findUnique({ where: { id: user.id } })
            expect(updated!.otpHash).toBeNull()
        })

        it('should fail if user does not exist', async () => {
            await expect(
                authService.verifyOtp({ email: 'ghost@example.com', otp: '123456' })
            ).rejects.toThrow()
        })

        it('should create exactly one session after verify', async () => {
            const otp = '654321'
            const user = await createUser({
                email: 'onesession@example.com',
                username: 'onesession',
                emailVerified: false,
                otpHash: await bcrypt.hash(otp, 10),
                otpExpiresAt: new Date(Date.now() + 10000),
            })

            await authService.verifyOtp({ email: user.email, otp })

            const sessions = await prisma.authSession.findMany({ where: { userId: user.id } })
            expect(sessions.length).toBe(1)
            expect(sessions![0]!.isRevoked).toBe(false)
        })

        it('should fail if account is deleted', async () => {
            const user = await createUser({
                email: 'deletedverify@example.com',
                username: 'deletedverify',
                emailVerified: false,
                isDeleted: true,
                otpHash: await bcrypt.hash('123456', 10),
                otpExpiresAt: new Date(Date.now() + 10000),
            })
            await expect(
                authService.verifyOtp({ email: user.email, otp: '123456' })
            ).rejects.toThrow('account has been deleted')
        })

        it('should fail if email is already verified', async () => {
            const user = await createUser({
                email: 'alreadyverified@example.com',
                username: 'alreadyverified',
                emailVerified: true,
                otpHash: await bcrypt.hash('123456', 10),
                otpExpiresAt: new Date(Date.now() + 10000),
            })
            await expect(
                authService.verifyOtp({ email: user.email, otp: '123456' })
            ).rejects.toThrow('email already verified')
        })
    })

    describe('login', () => {
        it('should login user and create session', async () => {
            const password = 'Password123'

            const user = await createUser({
                email: 'login@example.com',
                username: 'login',
            })

            const result = await authService.login({ email: user.email, password })

            expect(result.accessToken).toBeString()
            expect(result.refreshToken).toBeString()

            const session = await prisma.authSession.findFirst({ where: { userId: user.id } })
            expect(session).not.toBeNull()
        })

        it('should fail if password is wrong', async () => {
            await createUser({
                email: 'wrong@example.com',
                username: 'wrong',
            })

            let error: any = null
            try {
                await authService.login({ email: 'wrong@example.com', password: 'Wrong123' })
            } catch (e) {
                error = e
            }

            expect(error).not.toBeNull()
            expect(error.message).toBe('invalid email or password')
        })

        it('should fail if user does not exist', async () => {
            let error: any = null
            try {
                await authService.login({ email: 'ghost@example.com', password: 'Pass1234' })
            } catch (e) {
                error = e
            }

            expect(error).not.toBeNull()
            expect(error.message).toBe('invalid email or password')
        })

        it('should fail if user is soft-deleted', async () => {
            await createUser({
                email: 'deleted@example.com',
                username: 'deleted_login',
                isDeleted: true,
            })

            let error: any = null
            try {
                await authService.login({ email: 'deleted@example.com', password: 'Password123' })
            } catch (e) {
                error = e
            }

            expect(error).not.toBeNull()
            expect(error.message).toBe('account has been deleted')
        })

        it('should fail if user is not email-verified', async () => {
            await createUser({
                email: 'notverfied@example.com',
                username: 'notverified',
                emailVerified: false,
            })

            let error: any = null
            try {
                await authService.login({
                    email: 'notverfied@example.com',
                    password: 'Password123',
                })
            } catch (e) {
                error = e
            }

            expect(error).not.toBeNull()
        })

        it('should create a non-revoked session on login', async () => {
            const password = 'Password123'
            const user = await createUser({
                email: 'sessioncheck@example.com',
                username: 'sessioncheck',
            })

            await authService.login({ email: user.email, password })

            const session = await prisma.authSession.findFirst({ where: { userId: user.id } })
            expect(session).not.toBeNull()
            expect(session!.isRevoked).toBe(false)
        })

        it('should fail if user is a Google account without password', async () => {
            const user = await createUser({
                email: 'googleonlylogin@example.com',
                username: 'googleonlylogin',
                password: '',
                googleId: 'some-sub',
            })
            await expect(
                authService.login({ email: user.email, password: 'Password123' })
            ).rejects.toThrow('please continue with google login')
        })
    })

    describe('forgot password', () => {
        it('should create and send a reset otp for verified users', async () => {
            const user = await createUser({
                email: 'forgot@example.com',
                username: 'forgot',
            })

            await authService.requestPasswordReset({ email: user.email })

            const updatedUser = await prisma.user.findUnique({ where: { id: user.id } })
            expect(updatedUser!.otpHash).toBeTruthy()
            expect(updatedUser!.otpExpiresAt).toBeTruthy()
            expect(sendOTPMock).toHaveBeenCalledTimes(1)
        })

        it('should verify a valid reset otp', async () => {
            const otp = '123456'
            const user = await createUser({
                email: 'verifyreset@example.com',
                username: 'verifyreset',
                otpHash: await bcrypt.hash(otp, 10),
                otpExpiresAt: new Date(Date.now() + 10000),
            })

            const result = await authService.verifyPasswordResetOtp({
                email: user.email,
                otp,
            })

            expect(result).toBeDefined()
            expect(result.id).toBe(user.id)
        })

        it('should reset password, clear otp, and revoke active sessions', async () => {
            const otp = '123456'
            const user = await createUser({
                email: 'reset@example.com',
                username: 'resetuser',
                otpHash: await bcrypt.hash(otp, 10),
                otpExpiresAt: new Date(Date.now() + 10000),
            })

            await prisma.authSession.create({
                data: {
                    userId: user.id,
                    refreshTokenHash: `hash-${crypto.randomUUID()}`,
                    expiresAt: new Date(Date.now() + 1000 * 60 * 60),
                },
            })

            await authService.resetPassword({
                email: user.email,
                otp,
                newPassword: 'NewPass123',
            })

            const updatedUser = await prisma.user.findUnique({ where: { id: user.id } })
            const sessions = await prisma.authSession.findMany({ where: { userId: user.id } })

            expect(await bcrypt.compare('NewPass123', updatedUser!.password!)).toBe(true)
            expect(updatedUser!.otpHash).toBeNull()
            expect(updatedUser!.otpExpiresAt).toBeNull()
            expect(sessions.every((session) => session.isRevoked)).toBe(true)
        })

        it('should reject an invalid reset otp', async () => {
            const user = await createUser({
                email: 'badreset@example.com',
                username: 'badreset',
                otpHash: await bcrypt.hash('123456', 10),
                otpExpiresAt: new Date(Date.now() + 10000),
            })

            let error: any = null
            try {
                await authService.verifyPasswordResetOtp({
                    email: user.email,
                    otp: '000000',
                })
            } catch (e) {
                error = e
            }

            expect(error).not.toBeNull()
            expect(error.message).toBe('invalid or expired reset code')
        })

        it('should do nothing on requestPasswordReset if email does not exist', async () => {
            await authService.requestPasswordReset({ email: 'nonexistent@example.com' })
            expect(sendOTPMock).not.toHaveBeenCalled()
        })

        it('should reject an expired reset otp', async () => {
            const user = await createUser({
                email: 'expiredreset@example.com',
                username: 'expiredreset',
                otpHash: await bcrypt.hash('123456', 10),
                otpExpiresAt: new Date(Date.now() - 1000), // expired 1s ago
            })

            let error: any = null
            try {
                await authService.verifyPasswordResetOtp({
                    email: user.email,
                    otp: '123456',
                })
            } catch (e) {
                error = e
            }

            expect(error).not.toBeNull()
            expect(error.message).toBe('invalid or expired reset code')

            // Verify db was updated to clean up expired otp
            const updatedUser = await prisma.user.findUnique({ where: { id: user.id } })
            expect(updatedUser!.otpHash).toBeNull()
            expect(updatedUser!.otpExpiresAt).toBeNull()
        })

        it('should throw error on resetPassword with incorrect otp', async () => {
            const user = await createUser({
                email: 'resetbadotp@example.com',
                username: 'resetbadotp',
                otpHash: await bcrypt.hash('123456', 10),
                otpExpiresAt: new Date(Date.now() + 10000),
            })

            let error: any = null
            try {
                await authService.resetPassword({
                    email: user.email,
                    otp: 'wrongotp',
                    newPassword: 'NewPassword123',
                })
            } catch (e) {
                error = e
            }

            expect(error).not.toBeNull()
            expect(error.message).toBe('invalid or expired reset code')
        })

        it('should throw error on resetPassword with expired otp', async () => {
            const user = await createUser({
                email: 'resetexpiredotp@example.com',
                username: 'resetexpiredotp',
                otpHash: await bcrypt.hash('123456', 10),
                otpExpiresAt: new Date(Date.now() - 1000),
            })

            let error: any = null
            try {
                await authService.resetPassword({
                    email: user.email,
                    otp: '123456',
                    newPassword: 'NewPassword123',
                })
            } catch (e) {
                error = e
            }

            expect(error).not.toBeNull()
            expect(error.message).toBe('invalid or expired reset code')

            const updatedUser = await prisma.user.findUnique({ where: { id: user.id } })
            expect(updatedUser!.otpHash).toBeNull()
            expect(updatedUser!.otpExpiresAt).toBeNull()
        })
        it('should fail to request password reset for deleted user', async () => {
            const user = await createUser({
                email: 'delreset@example.com',
                username: 'delreset',
                isDeleted: true,
            })
            await authService.requestPasswordReset({ email: user.email })
            expect(sendOTPMock).not.toHaveBeenCalled()
        })

        it('should fail to request password reset for unverified user', async () => {
            const user = await createUser({
                email: 'unverreset@example.com',
                username: 'unverreset',
                emailVerified: false,
            })
            await authService.requestPasswordReset({ email: user.email })
            expect(sendOTPMock).not.toHaveBeenCalled()
        })
    })

    describe('google', () => {
        it('should create new user and session', async () => {
            const result = await authService.google({
                email: 'google@example.com',
                name: 'Google User',
                sub: 'google-sub',
            })

            expect(result.accessToken).toBeString()

            const user = await prisma.user.findUnique({ where: { email: 'google@example.com' } })
            expect(user).not.toBeNull()
            expect(user!.googleId).toBe('google-sub')
            expect(user!.emailVerified).toBe(true)
        })

        it('should throw on google id mismatch', async () => {
            await createUser({
                email: 'google@example.com',
                username: 'test_google',
                googleId: 'old-sub',
            })

            let error: any = null
            try {
                await authService.google({
                    email: 'google@example.com',
                    name: 'Mismatch',
                    sub: 'new-sub',
                })
            } catch (e) {
                error = e
            }

            expect(error).not.toBeNull()
            expect(error.message).toBe('google id mismatch')
        })

        it('should login existing google user with matching sub', async () => {
            await createUser({
                email: 'returning@example.com',
                username: 'returning',
                googleId: 'same-sub',
            })

            const result = await authService.google({
                email: 'returning@example.com',
                name: 'Returning User',
                sub: 'same-sub',
            })

            expect(result.accessToken).toBeString()
            expect(result.refreshToken).toBeString()
        })

        it('should set emailVerified to true for google user', async () => {
            await authService.google({
                email: 'googleverified@example.com',
                name: 'Verified',
                sub: 'verified-sub',
            })

            const user = await prisma.user.findUnique({
                where: { email: 'googleverified@example.com' },
            })
            expect(user!.emailVerified).toBe(true)
        })

        it('should throw if existing user is deleted', async () => {
            await createUser({
                email: 'deletedgoogle@example.com',
                username: 'deletedgoogle',
                googleId: 'del-sub',
                isDeleted: true,
            })
            await expect(
                authService.google({
                    email: 'deletedgoogle@example.com',
                    name: 'Deleted',
                    sub: 'del-sub',
                })
            ).rejects.toThrow('account has been deleted')
        })
    })

    describe('refreshSession', () => {
        it('should rotate refresh token', async () => {
            const password = 'Password123'
            const user = await createUser({
                email: 'refresh@example.com',
                username: 'refresh',
            })

            const login = await authService.login({ email: user.email, password })

            const refreshed = await authService.refreshSession({
                refreshToken: login.refreshToken,
            })

            expect(refreshed.refreshToken).not.toBe(login.refreshToken)

            const second = await authService.refreshSession({
                refreshToken: refreshed.refreshToken,
            })
            expect(second.accessToken).toBeDefined()
        })

        it('should fail if refresh token missing', async () => {
            let error: any = null
            try {
                await authService.refreshSession({})
            } catch (e) {
                error = e
            }

            expect(error).not.toBeNull()
            expect(error.message).toBe('refresh token is required')
        })

        it('should fail if refresh token invalid', async () => {
            let error: any = null
            try {
                await authService.refreshSession({ refreshToken: 'invalid-token' })
            } catch (e) {
                error = e
            }

            expect(error).not.toBeNull()
            expect(error.message).toBe('invalid or expired refresh token')
        })

        it('should fail if refresh token is empty string', async () => {
            let error: any = null
            try {
                await authService.refreshSession({ refreshToken: '' })
            } catch (e) {
                error = e
            }

            expect(error).not.toBeNull()
        })

        it('should return new access and refresh tokens', async () => {
            const user = await createUser({
                email: 'newtokens@example.com',
                username: 'newtokens',
            })

            const login = await authService.login({ email: user.email, password: 'Password123' })
            const refreshed = await authService.refreshSession({ refreshToken: login.refreshToken })

            expect(refreshed.accessToken).toBeString()
            expect(refreshed.refreshToken).toBeString()
            expect(refreshed.accessToken).not.toBe(login.accessToken)
        })

        it('should fail if session not found in DB', async () => {
            const token = actualUtils.generateRefreshToken({
                userId: 'fake-user',
                sessionId: 'fake-session',
            })
            await expect(authService.refreshSession({ refreshToken: token })).rejects.toThrow(
                'session not found'
            )
        })

        it('should fail if session expired in DB', async () => {
            const user = await createUser({
                email: 'expiredsession@example.com',
                username: 'expiredsession',
            })
            const sessionId = crypto.randomUUID()
            const token = actualUtils.generateRefreshToken({ userId: user.id, sessionId })

            await prisma.authSession.create({
                data: {
                    id: sessionId,
                    userId: user.id,
                    refreshTokenHash: await bcrypt.hash(token, 10),
                    expiresAt: new Date(Date.now() - 10000),
                },
            })

            await expect(authService.refreshSession({ refreshToken: token })).rejects.toThrow(
                'session expired'
            )
        })

        it('should fail if user mismatch', async () => {
            const user = await createUser({
                email: 'mismatchuser@example.com',
                username: 'mismatchuser',
            })
            const otherUser = await createUser({
                email: 'otheruser@example.com',
                username: 'otheruser',
            })
            const sessionId = crypto.randomUUID()
            const token = actualUtils.generateRefreshToken({ userId: user.id, sessionId })

            await prisma.authSession.create({
                data: {
                    id: sessionId,
                    userId: otherUser.id, // Mismatch
                    refreshTokenHash: await bcrypt.hash(token, 10),
                    expiresAt: new Date(Date.now() + 100000),
                },
            })

            await expect(authService.refreshSession({ refreshToken: token })).rejects.toThrow(
                'invalid session'
            )
        })
    })
})
