import { describe, it, expect, beforeEach, afterAll, mock } from 'bun:test'
import bcrypt from 'bcrypt'

import { prisma } from '../../../src/config/db'

const sendOTPMock = mock(async () => {})

mock.module('../../../src/modules/auth/auth.utils', () => ({
    sendOTP: sendOTPMock,
}))

import { authService } from '../../../src/modules/auth/auth.service'

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

            await prisma.user.create({
                data: {
                    name: 'dup',
                    email,
                    username: 'dup',
                    password: await bcrypt.hash('Password123', 10),
                    emailVerified: false,
                },
            })

            await expect(authService.signup({ email, password: 'Password123' })).rejects.toThrow(
                'email already exists'
            )
        })
    })

    describe('verifyOtp', () => {
        it('should verify user and create session', async () => {
            const otp = '123456'

            const user = await prisma.user.create({
                data: {
                    name: 'verify',
                    email: 'verify@example.com',
                    username: 'verify',
                    password: await bcrypt.hash('Password123', 10),
                    emailVerified: false,
                    otpHash: await bcrypt.hash(otp, 10),
                    otpExpiresAt: new Date(Date.now() + 10000),
                },
            })

            const result = await authService.verifyOtp({
                email: user.email,
                otp,
            })

            expect(result.accessToken).toBeString()
            expect(result.refreshToken).toBeString()

            const updatedUser = await prisma.user.findUnique({
                where: { id: user.id },
            })

            expect(updatedUser!.emailVerified).toBe(true)
            expect(updatedUser!.otpHash).toBeNull()

            const session = await prisma.session.findFirst({
                where: { userId: user.id },
            })

            expect(session).not.toBeNull()
        })

        it('should fail if otp invalid', async () => {
            await prisma.user.create({
                data: {
                    name: 'test',
                    email: 'invalid@example.com',
                    username: 'test',
                    password: await bcrypt.hash('Password123', 10),
                    emailVerified: false,
                    otpHash: await bcrypt.hash('123456', 10),
                    otpExpiresAt: new Date(Date.now() + 10000),
                },
            })

            await expect(
                authService.verifyOtp({
                    email: 'invalid@example.com',
                    otp: '000000',
                })
            ).rejects.toThrow('invalid otp')
        })

        it('should fail if otp expired and clear fields', async () => {
            const otp = '123456'

            const user = await prisma.user.create({
                data: {
                    name: 'expired',
                    email: 'expired@example.com',
                    username: 'expired',
                    password: await bcrypt.hash('Password123', 10),
                    emailVerified: false,
                    otpHash: await bcrypt.hash(otp, 10),
                    otpExpiresAt: new Date(Date.now() - 1000),
                },
            })

            await expect(
                authService.verifyOtp({
                    email: user.email,
                    otp,
                })
            ).rejects.toThrow('otp expired')

            const updated = await prisma.user.findUnique({
                where: { id: user.id },
            })

            expect(updated!.otpHash).toBeNull()
        })
    })

    describe('login', () => {
        it('should login user and create session', async () => {
            const password = 'Password123'

            const user = await prisma.user.create({
                data: {
                    name: 'login',
                    email: 'login@example.com',
                    username: 'login',
                    password: await bcrypt.hash(password, 10),
                    emailVerified: true,
                },
            })

            const result = await authService.login({
                email: user.email,
                password,
            })

            expect(result.accessToken).toBeString()
            expect(result.refreshToken).toBeString()

            const session = await prisma.session.findFirst({
                where: { userId: user.id },
            })

            expect(session).not.toBeNull()
        })

        it('should fail if password wrong', async () => {
            await prisma.user.create({
                data: {
                    name: 'wrong',
                    email: 'wrong@example.com',
                    username: 'wrong',
                    password: await bcrypt.hash('Correct123', 10),
                    emailVerified: true,
                },
            })

            await expect(
                authService.login({
                    email: 'wrong@example.com',
                    password: 'Wrong123',
                })
            ).rejects.toThrow('invalid email or password')
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

            const user = await prisma.user.findUnique({
                where: { email: 'google@example.com' },
            })

            expect(user).not.toBeNull()
            expect(user!.googleId).toBe('google-sub')
        })

        it('should throw on google id mismatch', async () => {
            await prisma.user.create({
                data: {
                    name: 'Mismatch',
                    email: 'google@example.com',
                    username: 'test',
                    emailVerified: true,
                    googleId: 'old-sub',
                },
            })

            await expect(
                authService.google({
                    email: 'google@example.com',
                    name: 'Mismatch',
                    sub: 'new-sub',
                })
            ).rejects.toThrow('google id mismatch')
        })
    })

    describe('refreshSession', () => {
        it('should rotate refresh token', async () => {
            const password = 'Password123'

            const user = await prisma.user.create({
                data: {
                    name: 'refresh',
                    email: 'refresh@example.com',
                    username: 'refresh',
                    password: await bcrypt.hash(password, 10),
                    emailVerified: true,
                },
            })

            const login = await authService.login({
                email: user.email,
                password,
            })

            const refreshed = await authService.refreshSession({
                refreshToken: login.refreshToken,
            })

            expect(refreshed.refreshToken).not.toBe(login.refreshToken)

            // 🔥 extra safety check
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
                authService.refreshSession({
                    refreshToken: 'invalid-token',
                })
            ).rejects.toThrow('invalid or expired refresh token')
        })
    })
})
