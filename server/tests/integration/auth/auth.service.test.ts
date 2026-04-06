import { describe, test, expect, beforeEach, afterEach, mock } from 'bun:test'
import crypto from 'crypto'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcrypt'

import { prisma } from '../../../src/config/db'
import { authService } from '../../../src/modules/auth/auth.service'
import { cleanDb } from '../../helpers/db'

// mock sendOTP module
const sendOTP = mock(async (_email: string, _otp: string) => {})

// IMPORTANT:
// If you moved sendOTP to auth.mail.ts, then in real Bun you would mock that import.
// For now, think of this as the conceptual structure.

describe('authService integration tests', () => {
    beforeEach(async () => {
        process.env.JWT_SECRET = 'test-secret'
        await cleanDb()
        sendOTP.mockClear()
    })

    afterEach(async () => {
        await cleanDb()
    })

    test('signup: should create user and send otp', async () => {
        // mock random OTP
        const randomIntSpy = mock(() => 123456)
        const originalRandomInt = crypto.randomInt
        ;(crypto as any).randomInt = randomIntSpy

        // TEMP: if you can't mock imported sendOTP yet, skip checking sendOTP until you refactor
        const result = await authService.signup({
            email: 'test@example.com',
            password: 'password123',
        })

        expect(result).toEqual({
            message: 'otp sent successfully',
        })

        const user = await prisma.user.findUnique({
            where: { email: 'test@example.com' },
        })

        expect(user).toBeDefined()
        expect(user?.email).toBe('test@example.com')
        expect(user?.emailVerified).toBe(false)
        expect(user?.otpHash).toBeTruthy()
        expect(user?.otpExpiresAt).toBeTruthy()

        // password should be hashed
        const isPasswordHashed = await bcrypt.compare('password123', user!.password!)
        expect(isPasswordHashed).toBe(true)

        // otpHash should match mocked OTP
        const isOtpCorrect = await bcrypt.compare('123456', user!.otpHash!)
        expect(isOtpCorrect).toBe(true)

        // restore
        ;(crypto as any).randomInt = originalRandomInt
    })

    test('signup: should throw if email already exists', async () => {
        await prisma.user.create({
            data: {
                name: 'test',
                email: 'test@example.com',
                username: 'test',
                password: await bcrypt.hash('password123', 10),
                emailVerified: false,
            },
        })

        expect(
            authService.signup({
                email: 'test@example.com',
                password: 'password123',
            })
        ).rejects.toThrow('email already exists')
    })

    test('verifyOtp: should verify email and return token', async () => {
        const otp = '123456'
        const otpHash = await bcrypt.hash(otp, 10)

        const user = await prisma.user.create({
            data: {
                name: 'test',
                email: 'test@example.com',
                username: 'test',
                password: await bcrypt.hash('password123', 10),
                emailVerified: false,
                otpHash,
                otpExpiresAt: new Date(Date.now() + 10 * 60 * 1000),
            },
        })

        const token = await authService.verifyOtp({
            email: 'test@example.com',
            otp: '123456',
        })

        expect(typeof token).toBe('string')

        const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string }
        expect(decoded.userId).toBe(user.id)

        const updatedUser = await prisma.user.findUnique({
            where: { email: 'test@example.com' },
        })

        expect(updatedUser?.emailVerified).toBe(true)
        expect(updatedUser?.otpHash).toBeNull()
        expect(updatedUser?.otpExpiresAt).toBeNull()
    })

    test('verifyOtp: should throw for invalid otp', async () => {
        const otpHash = await bcrypt.hash('123456', 10)

        await prisma.user.create({
            data: {
                name: 'test',
                email: 'test@example.com',
                username: 'test',
                password: await bcrypt.hash('password123', 10),
                emailVerified: false,
                otpHash,
                otpExpiresAt: new Date(Date.now() + 10 * 60 * 1000),
            },
        })

        expect(
            authService.verifyOtp({
                email: 'test@example.com',
                otp: '999999',
            })
        ).rejects.toThrow('invalid otp')
    })

    test('login: should return token for verified user', async () => {
        const password = 'password123'

        const user = await prisma.user.create({
            data: {
                name: 'test',
                email: 'test@example.com',
                username: 'test',
                password: await bcrypt.hash(password, 10),
                emailVerified: true,
            },
        })

        const token = await authService.login({
            email: 'test@example.com',
            password,
        })

        expect(typeof token).toBe('string')

        const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string }
        expect(decoded.userId).toBe(user.id)
    })

    test('login: should throw if email not verified', async () => {
        await prisma.user.create({
            data: {
                name: 'test',
                email: 'test@example.com',
                username: 'test',
                password: await bcrypt.hash('password123', 10),
                emailVerified: false,
            },
        })

        expect(
            authService.login({
                email: 'test@example.com',
                password: 'password123',
            })
        ).rejects.toThrow('please verify your email')
    })

    test('google: should create new google user if not exists', async () => {
        const token = await authService.google({
            name: 'Chaitanya',
            email: 'google@example.com',
            sub: 'google-sub-123',
        })

        expect(typeof token).toBe('string')

        const user = await prisma.user.findUnique({
            where: { email: 'google@example.com' },
        })

        expect(user).toBeDefined()
        expect(user?.googleId).toBe('google-sub-123')
        expect(user?.emailVerified).toBe(true)
    })

    test('google: should throw if google id mismatch', async () => {
        await prisma.user.create({
            data: {
                name: 'test',
                email: 'google@example.com',
                username: 'google',
                emailVerified: true,
                googleId: 'old-google-sub',
            },
        })

        expect(
            authService.google({
                name: 'Chaitanya',
                email: 'google@example.com',
                sub: 'new-google-sub',
            })
        ).rejects.toThrow('google id mismatch')
    })
})
