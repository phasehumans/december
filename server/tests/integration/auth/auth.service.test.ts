import bcrypt from 'bcrypt'
import { describe, it, expect, beforeEach, afterAll, mock } from 'bun:test'

import { prisma } from '../../../src/config/db'

const sendOTPMock = mock(async () => {})

mock.module('../../../src/modules/auth/auth.utils', () => ({
    sendOTP: sendOTPMock,
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
    beforeEach(async () => {
        sendOTPMock.mockClear()
        await prisma.session.deleteMany()
        await prisma.user.deleteMany()
        process.env.ACCESS_TOKEN_SECRET = 'test-access'
        process.env.REFRESH_TOKEN_SECRET = 'test-refresh'
    })

    afterAll(async () => {
        await prisma.$disconnect()
    })

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

            await expect(authService.signup({ email, password: 'Password123' })).rejects.toThrow(
                'email already exists'
            )
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

            const session = await prisma.session.findFirst({ where: { userId: user.id } })
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

            await expect(
                authService.verifyOtp({ email: 'invalid@example.com', otp: '000000' })
            ).rejects.toThrow('invalid otp')
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

            await expect(authService.verifyOtp({ email: user.email, otp })).rejects.toThrow(
                'otp expired'
            )

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

            const sessions = await prisma.session.findMany({ where: { userId: user.id } })
            expect(sessions.length).toBe(1)
            expect(sessions![0]!.isRevoked).toBe(false)
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

            const session = await prisma.session.findFirst({ where: { userId: user.id } })
            expect(session).not.toBeNull()
        })

        it('should fail if password is wrong', async () => {
            await createUser({
                email: 'wrong@example.com',
                username: 'wrong',
            })

            await expect(
                authService.login({ email: 'wrong@example.com', password: 'Wrong123' })
            ).rejects.toThrow('invalid email or password')
        })

        it('should fail if user does not exist', async () => {
            await expect(
                authService.login({ email: 'ghost@example.com', password: 'Pass1234' })
            ).rejects.toThrow('invalid email or password')
        })

        it('should fail if user is soft-deleted', async () => {
            await createUser({
                email: 'deleted@example.com',
                username: 'deleted_login',
                isDeleted: true,
            })

            await expect(
                authService.login({ email: 'deleted@example.com', password: 'Password123' })
            ).rejects.toThrow('account has been deleted')
        })

        it('should fail if user is not email-verified', async () => {
            await createUser({
                email: 'notverfied@example.com',
                username: 'notverified',
                emailVerified: false,
            })

            await expect(
                authService.login({ email: 'notverfied@example.com', password: 'Password123' })
            ).rejects.toThrow()
        })

        it('should create a non-revoked session on login', async () => {
            const password = 'Password123'
            const user = await createUser({
                email: 'sessioncheck@example.com',
                username: 'sessioncheck',
            })

            await authService.login({ email: user.email, password })

            const session = await prisma.session.findFirst({ where: { userId: user.id } })
            expect(session).not.toBeNull()
            expect(session!.isRevoked).toBe(false)
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

            await expect(
                authService.google({
                    email: 'google@example.com',
                    name: 'Mismatch',
                    sub: 'new-sub',
                })
            ).rejects.toThrow('google id mismatch')
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
            await expect(authService.refreshSession({})).rejects.toThrow(
                'refresh token is required'
            )
        })

        it('should fail if refresh token invalid', async () => {
            await expect(
                authService.refreshSession({ refreshToken: 'invalid-token' })
            ).rejects.toThrow('invalid or expired refresh token')
        })

        it('should fail if refresh token is empty string', async () => {
            await expect(authService.refreshSession({ refreshToken: '' })).rejects.toThrow()
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
    })
})
