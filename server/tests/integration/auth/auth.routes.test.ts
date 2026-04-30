import { describe, it, expect, beforeEach, afterAll, mock } from 'bun:test'
import express from 'express'
import request from 'supertest'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'

import { prisma } from '../../../src/config/db'

if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is required for auth route integration tests')
}

const sendOTPMock = mock(async (_email: string, _otp: string) => {})
const axiosPostMock = mock()
const verifyIdTokenMock = mock()

mock.module('../../../src/modules/auth/auth.utils', () => ({
    sendOTP: sendOTPMock,
}))

mock.module('axios', () => ({
    default: {
        post: axiosPostMock,
    },
}))

mock.module('google-auth-library', () => ({
    OAuth2Client: class {
        verifyIdToken = verifyIdTokenMock
    },
}))

import authRouter from '../../../src/modules/auth/auth.routes'

const createTestApp = () => {
    const app = express()
    app.use(express.json())
    app.use('/auth', authRouter)
    return app
}

describe('auth routes integration', () => {
    let app: ReturnType<typeof createTestApp>

    beforeEach(async () => {
        app = createTestApp()

        sendOTPMock.mockClear()
        axiosPostMock.mockReset()
        verifyIdTokenMock.mockReset()

        await prisma.user.deleteMany()

        process.env.GOOGLE_CLIENT_ID = 'test-google-client-id'
        process.env.GOOGLE_CLIENT_SECRET = 'test-google-client-secret'
    })

    afterAll(async () => {
        await prisma.$disconnect()
    })

    describe('POST /auth/signup', () => {
        it('should return 201 and create user on valid signup', async () => {
            const response = await request(app).post('/auth/signup').send({
                email: 'signup@example.com',
                password: 'Password123',
            })

            expect(response.status).toBe(201)
            expect(response.body.success).toBe(true)
            expect(response.body.message).toBe('otp sent to email')
            expect(response.body.data).toEqual({
                message: 'otp sent successfully',
            })

            const user = await prisma.user.findUnique({
                where: { email: 'signup@example.com' },
            })

            expect(user).not.toBeNull()
            expect(user!.emailVerified).toBe(false)
            expect(user!.otpHash).toBeTruthy()
            expect(user!.otpExpiresAt).toBeTruthy()

            const isPasswordValid = await bcrypt.compare('Password123', user!.password!)
            expect(isPasswordValid).toBe(true)

            expect(sendOTPMock).toHaveBeenCalledTimes(1)
        })

        it('should return 400 on invalid signup body', async () => {
            const response = await request(app).post('/auth/signup').send({
                email: 'not-an-email',
                password: '123',
            })

            expect(response.status).toBe(400)
            expect(response.body.success).toBe(false)
            expect(response.body.message).toBe('validation failed')
            expect(response.body.errors).toBeTruthy()

            expect(sendOTPMock).not.toHaveBeenCalled()
        })

        it('should return 409 if email already exists', async () => {
            await prisma.user.create({
                data: {
                    name: 'signup',
                    email: 'signup@example.com',
                    username: 'signup',
                    password: await bcrypt.hash('Password123', 10),
                    emailVerified: false,
                },
            })

            const response = await request(app).post('/auth/signup').send({
                email: 'signup@example.com',
                password: 'Password123',
            })

            expect(response.status).toBe(409)
            expect(response.body.success).toBe(false)
            expect(response.body.errors).toBe('email already exists')
        })
    })

    describe('POST /auth/verify-otp', () => {
        it('should return 200 and token on valid otp', async () => {
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

            const response = await request(app).post('/auth/verify-otp').send({
                email,
                otp: rawOtp,
            })

            expect(response.status).toBe(200)
            expect(response.body.success).toBe(true)
            expect(response.body.message).toBe('email verified successfully')
            expect(response.body.data).toBeString()

            const decoded = jwt.verify(response.body.data, process.env.JWT_SECRET!) as {
                userId: string
            }

            expect(decoded.userId).toBe(user.id)

            const updatedUser = await prisma.user.findUnique({
                where: { email },
            })

            expect(updatedUser!.emailVerified).toBe(true)
            expect(updatedUser!.otpHash).toBeNull()
            expect(updatedUser!.otpExpiresAt).toBeNull()
        })

        it('should return 400 if email or otp is missing', async () => {
            const response = await request(app).post('/auth/verify-otp').send({
                email: 'verify@example.com',
            })

            expect(response.status).toBe(400)
            expect(response.body.success).toBe(false)
            expect(response.body.message).toBe('email and otp is required')
        })

        it('should return 404 if user not found', async () => {
            const response = await request(app).post('/auth/verify-otp').send({
                email: 'nouser@example.com',
                otp: '123456',
            })

            expect(response.status).toBe(404)
            expect(response.body.success).toBe(false)
            expect(response.body.errors).toBe('user not found')
        })

        it('should return 400 if email already verified', async () => {
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

            const response = await request(app).post('/auth/verify-otp').send({
                email,
                otp: '123456',
            })

            expect(response.status).toBe(400)
            expect(response.body.success).toBe(false)
            expect(response.body.errors).toBe('email already verified')
        })

        it('should return 400 if otp not found', async () => {
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

            const response = await request(app).post('/auth/verify-otp').send({
                email,
                otp: '123456',
            })

            expect(response.status).toBe(400)
            expect(response.body.success).toBe(false)
            expect(response.body.errors).toBe('otp not found, request new one')
        })

        it('should return 400 if otp expired and clear otp fields', async () => {
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

            const response = await request(app).post('/auth/verify-otp').send({
                email,
                otp: rawOtp,
            })

            expect(response.status).toBe(400)
            expect(response.body.success).toBe(false)
            expect(response.body.errors).toBe('otp expired')

            const updatedUser = await prisma.user.findUnique({
                where: { id: user.id },
            })

            expect(updatedUser!.otpHash).toBeNull()
            expect(updatedUser!.otpExpiresAt).toBeNull()
            expect(updatedUser!.emailVerified).toBe(false)
        })

        it('should return 401 if otp is invalid', async () => {
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

            const response = await request(app).post('/auth/verify-otp').send({
                email,
                otp: '654321',
            })

            expect(response.status).toBe(401)
            expect(response.body.success).toBe(false)
            expect(response.body.errors).toBe('invalid otp')
        })
    })

    // =========================
    // POST /auth/login
    // =========================
    describe('POST /auth/login', () => {
        it('should return 200 and token on valid login', async () => {
            const email = 'login@example.com'
            const password = 'Password123'

            const user = await prisma.user.create({
                data: {
                    name: 'login',
                    email,
                    username: 'login',
                    password: await bcrypt.hash(password, 10),
                    emailVerified: true,
                },
            })

            const response = await request(app).post('/auth/login').send({
                email,
                password,
            })

            expect(response.status).toBe(200)
            expect(response.body.success).toBe(true)
            expect(response.body.message).toBe('login successful')
            expect(response.body.data).toBeString()

            const decoded = jwt.verify(response.body.data, process.env.JWT_SECRET!) as {
                userId: string
            }

            expect(decoded.userId).toBe(user.id)
        })

        it('should return 400 on invalid login body', async () => {
            const response = await request(app).post('/auth/login').send({
                email: 'bad-email',
                password: '',
            })

            expect(response.status).toBe(400)
            expect(response.body.success).toBe(false)
            expect(response.body.message).toBe('validation failed')
            expect(response.body.errors).toBeTruthy()
        })

        it('should return 401 if user does not exist', async () => {
            const response = await request(app).post('/auth/login').send({
                email: 'nouser@example.com',
                password: 'Password123',
            })

            expect(response.status).toBe(401)
            expect(response.body.success).toBe(false)
            expect(response.body.errors).toBe('invalid email or password')
        })

        it('should return 401 if email is not verified', async () => {
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

            const response = await request(app).post('/auth/login').send({
                email,
                password,
            })

            expect(response.status).toBe(401)
            expect(response.body.success).toBe(false)
            expect(response.body.errors).toBe('please verify your email')
        })

        it('should return 401 if password is wrong', async () => {
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

            const response = await request(app).post('/auth/login').send({
                email,
                password: 'WrongPassword123',
            })

            expect(response.status).toBe(401)
            expect(response.body.success).toBe(false)
            expect(response.body.errors).toBe('invalid email or password')
        })
    })

    // =========================
    // POST /auth/google
    // =========================
    describe('POST /auth/google', () => {
        it('should return 200 and token on valid google login for new user', async () => {
            axiosPostMock.mockResolvedValue({
                data: {
                    id_token: 'mock-id-token',
                },
            })

            verifyIdTokenMock.mockResolvedValue({
                getPayload: () => ({
                    email: 'google@example.com',
                    name: 'Google User',
                    sub: 'google-sub-123',
                    email_verified: true,
                }),
            })

            const response = await request(app).post('/auth/google').send({
                code: 'valid-google-auth-code',
            })

            expect(response.status).toBe(200)
            expect(response.body.success).toBe(true)
            expect(response.body.message).toBe('login successful')
            expect(response.body.data).toBeString()

            expect(axiosPostMock).toHaveBeenCalledTimes(1)
            expect(verifyIdTokenMock).toHaveBeenCalledTimes(1)

            const user = await prisma.user.findUnique({
                where: { email: 'google@example.com' },
            })

            expect(user).not.toBeNull()
            expect(user!.name).toBe('Google User')
            expect(user!.emailVerified).toBe(true)
            expect(user!.googleId).toBe('google-sub-123')
        })

        it('should return 400 if authorization code is missing', async () => {
            const response = await request(app).post('/auth/google').send({})

            expect(response.status).toBe(400)
            expect(response.body.success).toBe(false)
            expect(response.body.message).toBe('authorization code is required')
        })

        it('should return 500 if google env is missing', async () => {
            delete process.env.GOOGLE_CLIENT_ID
            delete process.env.GOOGLE_CLIENT_SECRET

            const response = await request(app).post('/auth/google').send({
                code: 'valid-google-auth-code',
            })

            expect(response.status).toBe(500)
            expect(response.body.success).toBe(false)
            expect(response.body.message).toBe('google auth is not configured on server')
        })

        it('should return 400 if google id token is missing', async () => {
            axiosPostMock.mockResolvedValue({
                data: {},
            })

            const response = await request(app).post('/auth/google').send({
                code: 'valid-google-auth-code',
            })

            expect(response.status).toBe(400)
            expect(response.body.success).toBe(false)
            expect(response.body.message).toBe('google id token not found')
        })

        it('should return 400 if token payload is invalid', async () => {
            axiosPostMock.mockResolvedValue({
                data: {
                    id_token: 'mock-id-token',
                },
            })

            verifyIdTokenMock.mockResolvedValue({
                getPayload: () => null,
            })

            const response = await request(app).post('/auth/google').send({
                code: 'valid-google-auth-code',
            })

            expect(response.status).toBe(400)
            expect(response.body.success).toBe(false)
            expect(response.body.message).toBe('invalid token payload')
        })

        it('should return 400 if required google fields are missing', async () => {
            axiosPostMock.mockResolvedValue({
                data: {
                    id_token: 'mock-id-token',
                },
            })

            verifyIdTokenMock.mockResolvedValue({
                getPayload: () => ({
                    email: 'google@example.com',
                    name: undefined,
                    sub: 'google-sub-123',
                    email_verified: true,
                }),
            })

            const response = await request(app).post('/auth/google').send({
                code: 'valid-google-auth-code',
            })

            expect(response.status).toBe(400)
            expect(response.body.success).toBe(false)
            expect(response.body.message).toBe('google fields required')
        })

        it('should return 400 if google email is not verified', async () => {
            axiosPostMock.mockResolvedValue({
                data: {
                    id_token: 'mock-id-token',
                },
            })

            verifyIdTokenMock.mockResolvedValue({
                getPayload: () => ({
                    email: 'google@example.com',
                    name: 'Google User',
                    sub: 'google-sub-123',
                    email_verified: false,
                }),
            })

            const response = await request(app).post('/auth/google').send({
                code: 'valid-google-auth-code',
            })

            expect(response.status).toBe(400)
            expect(response.body.success).toBe(false)
            expect(response.body.message).toBe('email not verified')
        })

        it('should return 500 if google token exchange fails', async () => {
            axiosPostMock.mockRejectedValue({
                response: {
                    data: {
                        error_description: 'invalid_grant',
                    },
                },
                message: 'Request failed',
            })

            const response = await request(app).post('/auth/google').send({
                code: 'bad-google-auth-code',
            })

            expect(response.status).toBe(500)
            expect(response.body.success).toBe(false)
            expect(response.body.message).toBe('google login failed')
            expect(response.body.errors).toBe('invalid_grant')
        })

        it('should return 500 if authService.google throws google id mismatch', async () => {
            await prisma.user.create({
                data: {
                    name: 'Mismatch User',
                    email: 'google@example.com',
                    username: 'google',
                    emailVerified: true,
                    googleId: 'old-google-sub',
                },
            })

            axiosPostMock.mockResolvedValue({
                data: {
                    id_token: 'mock-id-token',
                },
            })

            verifyIdTokenMock.mockResolvedValue({
                getPayload: () => ({
                    email: 'google@example.com',
                    name: 'Mismatch User',
                    sub: 'new-google-sub',
                    email_verified: true,
                }),
            })

            const response = await request(app).post('/auth/google').send({
                code: 'valid-google-auth-code',
            })

            expect(response.status).toBe(500)
            expect(response.body.success).toBe(false)
            expect(response.body.message).toBe('google login failed')
            expect(response.body.errors).toBe('google id mismatch')
        })
    })
})
