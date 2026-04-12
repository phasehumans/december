import { describe, it, expect, beforeEach, afterAll, mock } from 'bun:test'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'

import { prisma } from '../../src/config/db'

const sendOTPMock = mock(async (_email: string, _otp: string) => {})

mock.module('../../src/modules/auth/auth.utils', () => ({
    sendOTP: sendOTPMock,
    getUsernameFromEmail: (email: string) => email.split('@')[0]?.replace(/\d+/g, ''),
}))

import { authService } from '../../src/modules/auth/auth.service'

describe('auth.service', () => {
    beforeEach(async () => {
        sendOTPMock.mockClear()
        await prisma.user.deleteMany()
    })

    afterAll(async () => {
        await prisma.$disconnect()
    })

    // signup
    it('should create a new unverified user with hashed password and otp on signup', async () => {
        const email = 'test@example.com'
        const password = 'Password123'

        const result = await authService.signup({ email, password })

        expect(result).toEqual({
            message: 'otp sent successfully',
        })

        const user = await prisma.user.findUnique({
            where: {
                email: email,
            },
        })

        expect(user).not.toBeNull()
        expect(user!.email).toBe(email)
        expect(user!.name).toBe('test')
        expect(user!.username).toBe('test')
        expect(user!.emailVerified).toBe(false)
        expect(user!.otpHash).toBeTruthy()
        expect(user!.otpExpiresAt).toBeTruthy()

        expect(user!.password).not.toBe(password)
        const isPasswordValid = await bcrypt.compare(password, user!.password!)

        expect(isPasswordValid).toBe(true)

        expect(sendOTPMock).toHaveBeenCalledTimes(1)

        const firstCallArgs = sendOTPMock.mock.calls[0]
        expect(firstCallArgs![0]).toBe(email)
        expect(firstCallArgs![1]).toBeString()
        expect(firstCallArgs![1]).toHaveLength(6)
    })

    it('should throw error if email already exists on signup', async () => {
        const email = 'test@example.com'
        const password = 'Password123'

        await prisma.user.create({
            data: {
                name: 'test',
                email,
                username: 'test',
                password: await bcrypt.hash(password, 10),
                emailVerified: false,
            },
        })

        expect(authService.signup({ email, password })).rejects.toThrow('email already exists')

        expect(sendOTPMock).not.toHaveBeenCalled()
    })

    // verify OTP
    it('should verify otp, clear otp fields, and return jwt token', async () => {
        const email = 'verify@example.com'
        const rawOtp = '123456'
        const otpHash = await bcrypt.hash(rawOtp, 10)

        const user = await prisma.user.create({
            data: {
                name: 'verify',
                email,
                username: 'verify',
                password: await bcrypt.hash('Password123', 10),
                emailVerified: false,
                otpHash,
                otpExpiresAt: new Date(Date.now() + 10 * 60 * 1000),
            },
        })

        const token = await authService.verifyOtp({
            email,
            otp: rawOtp,
        })

        expect(token).toBeString()

        const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string }
        expect(decoded.userId).toBe(user.id)

        const updatedUser = await prisma.user.findUnique({
            where: {
                email,
            },
        })

        expect(updatedUser).not.toBeNull()
        expect(updatedUser!.emailVerified).toBe(true)
        expect(updatedUser!.otpHash).toBeNull()
        expect(updatedUser!.otpExpiresAt).toBeNull()
    })

    it('should throw error if user not found on verifyOtp', async () => {
        expect(
            authService.verifyOtp({
                email: 'nouser@example.com',
                otp: '123456',
            })
        ).rejects.toThrow('user not found')
    })

    it('should throw error if email already verified on verifyOtp', async () => {
        const email = 'verified@example.com'

        await prisma.user.create({
            data: {
                name: 'verified',
                email,
                username: 'verified',
                password: await bcrypt.hash('Password123', 10),
                emailVerified: true,
            },
        })

        expect(
            authService.verifyOtp({
                email,
                otp: '123456',
            })
        ).rejects.toThrow('email already verified')
    })

    it('should throw error if otp not found on verifyOtp', async () => {
        const email = 'nootp@example.com'

        await prisma.user.create({
            data: {
                name: 'nootp',
                email,
                username: 'nootp',
                password: await bcrypt.hash('Password123', 10),
                emailVerified: false,
                otpHash: null,
                otpExpiresAt: null,
            },
        })

        expect(
            authService.verifyOtp({
                email,
                otp: '123456',
            })
        ).rejects.toThrow('otp not found, request new one')
    })

    it('should clear otp fields and throw error if otp expired', async () => {
        const email = 'expired@example.com'
        const rawOtp = '123456'
        const otpHash = await bcrypt.hash(rawOtp, 10)

        const user = await prisma.user.create({
            data: {
                name: 'expired',
                email,
                username: 'expired',
                password: await bcrypt.hash('Password123', 10),
                emailVerified: false,
                otpHash,
                otpExpiresAt: new Date(Date.now() - 60 * 1000),
            },
        })

        expect(
            authService.verifyOtp({
                email,
                otp: rawOtp,
            })
        ).rejects.toThrow('otp expired')

        const updatedUser = await prisma.user.findUnique({
            where: {
                id: user.id,
            },
        })

        expect(updatedUser).not.toBeNull()
        expect(updatedUser!.otpHash).toBeNull()
        expect(updatedUser!.otpExpiresAt).toBeNull()
        expect(updatedUser!.emailVerified).toBe(false)
    })

    it('should throw error if otp is invalid', async () => {
        const email = 'invalidotp@example.com'
        const otpHash = await bcrypt.hash('123456', 10)

        await prisma.user.create({
            data: {
                name: 'invalidotp',
                email,
                username: 'invalidotp',
                password: await bcrypt.hash('Password123', 10),
                emailVerified: false,
                otpHash,
                otpExpiresAt: new Date(Date.now() + 10 * 60 * 1000),
            },
        })

        expect(
            authService.verifyOtp({
                email,
                otp: '654321',
            })
        ).rejects.toThrow('invalid otp')
    })

    // login
    it('should login verified user and return jwt token', async () => {
        const email = 'login@example.com'
        const password = 'Password123'
        const hashedPassword = await bcrypt.hash(password, 10)

        const user = await prisma.user.create({
            data: {
                name: 'login',
                email,
                username: 'login',
                password: hashedPassword,
                emailVerified: true,
            },
        })

        const token = await authService.login({
            email,
            password,
        })

        expect(token).toBeString()

        const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string }
        expect(decoded.userId).toBe(user.id)
    })

    it('should throw error if user does not exist on login', async () => {
        expect(
            authService.login({
                email: 'nouser@example.com',
                password: 'Password123',
            })
        ).rejects.toThrow('invalid email or password')
    })

    it('should throw error if email is not verified on login', async () => {
        const email = 'notverified@example.com'
        const password = 'Password123'

        await prisma.user.create({
            data: {
                name: 'notverified',
                email,
                username: 'notverified',
                password: await bcrypt.hash(password, 10),
                emailVerified: false,
            },
        })

        expect(
            authService.login({
                email,
                password,
            })
        ).rejects.toThrow('please verify your email')
    })

    it('should throw error if password is wrong on login', async () => {
        const email = 'wrongpass@example.com'

        await prisma.user.create({
            data: {
                name: 'wrongpass',
                email,
                username: 'wrongpass',
                password: await bcrypt.hash('CorrectPassword123', 10),
                emailVerified: true,
            },
        })

        expect(
            authService.login({
                email,
                password: 'WrongPassword123',
            })
        ).rejects.toThrow('invalid email or password')
    })

    // google
    it('should create a new google user if user does not exist and return jwt token', async () => {
        const name = 'Google User'
        const email = 'google@example.com'
        const sub = 'google-sub-123'

        const token = await authService.google({
            name,
            email,
            sub,
        })

        expect(token).toBeString()

        const user = await prisma.user.findUnique({
            where: {
                email,
            },
        })

        expect(user).not.toBeNull()
        expect(user!.name).toBe(name)
        expect(user!.email).toBe(email)
        expect(user!.username).toBe('google')
        expect(user!.emailVerified).toBe(true)
        expect(user!.googleId).toBe(sub)

        const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string }
        expect(decoded.userId).toBe(user!.id)
    })

    it('should attach googleId to existing user without googleId and return jwt token', async () => {
        const email = 'existing@example.com'
        const sub = 'google-sub-456'

        const existingUser = await prisma.user.create({
            data: {
                name: 'Existing User',
                email,
                username: 'existing',
                password: await bcrypt.hash('Password123', 10),
                emailVerified: true,
                googleId: null,
            },
        })

        const token = await authService.google({
            name: 'Existing User',
            email,
            sub,
        })

        expect(token).toBeString()

        const updatedUser = await prisma.user.findUnique({
            where: {
                email,
            },
        })

        expect(updatedUser).not.toBeNull()
        expect(updatedUser!.id).toBe(existingUser.id)
        expect(updatedUser!.googleId).toBe(sub)

        const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string }
        expect(decoded.userId).toBe(existingUser.id)
    })

    it('should return jwt token if existing user already has same googleId', async () => {
        const email = 'samegoogle@example.com'
        const sub = 'google-sub-same'

        const existingUser = await prisma.user.create({
            data: {
                name: 'Same Google',
                email,
                username: 'samegoogle',
                emailVerified: true,
                googleId: sub,
            },
        })

        const token = await authService.google({
            name: 'Same Google',
            email,
            sub,
        })

        expect(token).toBeString()

        const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string }
        expect(decoded.userId).toBe(existingUser.id)
    })

    it('should throw error if existing user has different googleId', async () => {
        const email = 'mismatch@example.com'

        await prisma.user.create({
            data: {
                name: 'Mismatch User',
                email,
                username: 'mismatch',
                emailVerified: true,
                googleId: 'old-google-sub',
            },
        })

        expect(
            authService.google({
                name: 'Mismatch User',
                email,
                sub: 'new-google-sub',
            })
        ).rejects.toThrow('google id mismatch')
    })
})
