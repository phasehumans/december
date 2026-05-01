import { describe, it, expect, beforeEach, afterAll, mock } from 'bun:test'
import express from 'express'
import request from 'supertest'
import cookieParser from 'cookie-parser'
import bcrypt from 'bcrypt'

import { prisma } from '../../../src/config/db'

const sendOTPMock = mock(async () => {})
const axiosPostMock = mock()
const verifyIdTokenMock = mock()

mock.module('../../../src/modules/auth/auth.utils', () => ({
    sendOTP: sendOTPMock,
}))

mock.module('axios', () => ({
    default: { post: axiosPostMock },
    post: axiosPostMock,
}))

mock.module('google-auth-library', () => ({
    OAuth2Client: class {
        verifyIdToken = verifyIdTokenMock
    },
}))

import authRouter from '../../../src/modules/auth/auth.routes'

const createApp = () => {
    const app = express()
    app.use(express.json())
    app.use(cookieParser())
    app.use('/auth', authRouter)

    app.use((err: any, _req: any, res: any, _next: any) => {
        res.status(err.statusCode || 500).json({
            success: false,
            message: err.message,
        })
    })

    return app
}

const getCookies = (res: request.Response): string[] => {
    const cookies = res.headers['set-cookie']
    if (!cookies) return []
    return Array.isArray(cookies) ? cookies : [cookies]
}

const buildCookieHeader = (res: request.Response): string => {
    const cookies = getCookies(res)

    return cookies
        .map((c) => c.split(';')[0]) // remove metadata
        .join('; ')
}

describe('auth.routes.integration', () => {
    let app: ReturnType<typeof createApp>

    beforeEach(async () => {
        app = createApp()

        sendOTPMock.mockClear()
        axiosPostMock.mockReset()
        verifyIdTokenMock.mockReset()

        await prisma.session.deleteMany()
        await prisma.user.deleteMany()

        process.env.ACCESS_TOKEN_SECRET = 'test-access'
        process.env.REFRESH_TOKEN_SECRET = 'test-refresh'
        process.env.GOOGLE_CLIENT_ID = 'test-client'
        process.env.GOOGLE_CLIENT_SECRET = 'test-secret'
    })

    afterAll(async () => {
        await prisma.$disconnect()
    })

    describe('POST /auth/signup', () => {
        it('should create user and send otp', async () => {
            const res = await request(app).post('/auth/signup').send({
                email: 'signup@example.com',
                password: 'Password123',
            })

            expect(res.status).toBe(201)
            expect(res.body.success).toBe(true)
            expect(sendOTPMock).toHaveBeenCalled()
        })

        it('should fail on invalid body', async () => {
            const res = await request(app).post('/auth/signup').send({
                email: 'bad',
                password: '123',
            })

            expect(res.status).toBe(400)
            expect(res.body.success).toBe(false)
        })
    })

    describe('POST /auth/verify', () => {
        it('should verify and set cookies', async () => {
            const otp = '123456'

            await prisma.user.create({
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

            const res = await request(app).post('/auth/verify').send({
                email: 'verify@example.com',
                otp,
            })

            expect(res.status).toBe(200)
            expect(res.body.success).toBe(true)

            const cookies = getCookies(res)

            expect(cookies.some((c) => c.includes('accessToken'))).toBe(true)
            expect(cookies.some((c) => c.includes('refreshToken'))).toBe(true)
        })

        it('should fail if otp missing', async () => {
            const res = await request(app).post('/auth/verify').send({
                email: 'test@example.com',
            })

            expect(res.status).toBe(400)
        })
    })

    describe('POST /auth/login', () => {
        it('should login and set cookies', async () => {
            const password = 'Password123'

            await prisma.user.create({
                data: {
                    name: 'login',
                    email: 'login@example.com',
                    username: 'login',
                    password: await bcrypt.hash(password, 10),
                    emailVerified: true,
                },
            })

            const res = await request(app).post('/auth/login').send({
                email: 'login@example.com',
                password,
            })

            expect(res.status).toBe(200)
            expect(res.body.success).toBe(true)

            const cookies = getCookies(res)

            expect(cookies.some((c) => c.includes('accessToken'))).toBe(true)
            expect(cookies.some((c) => c.includes('refreshToken'))).toBe(true)
        })

        it('should fail with wrong password', async () => {
            await prisma.user.create({
                data: {
                    name: 'wrong',
                    email: 'wrong@example.com',
                    username: 'wrong',
                    password: await bcrypt.hash('Correct123', 10),
                    emailVerified: true,
                },
            })

            const res = await request(app).post('/auth/login').send({
                email: 'wrong@example.com',
                password: 'Wrong123',
            })

            expect(res.status).toBe(401)
        })
    })

    describe('POST /auth/google', () => {
        it('should login via google and set cookies', async () => {
            axiosPostMock.mockResolvedValue({
                data: { id_token: 'mock-id-token' },
            })

            verifyIdTokenMock.mockResolvedValue({
                getPayload: () => ({
                    email: 'google@example.com',
                    name: 'Google User',
                    sub: 'google-sub',
                    email_verified: true,
                }),
            })

            const res = await request(app).post('/auth/google').send({
                code: 'valid-code',
            })

            expect(res.status).toBe(200)

            const cookies = getCookies(res)

            expect(cookies.some((c) => c.includes('accessToken'))).toBe(true)
            expect(cookies.some((c) => c.includes('refreshToken'))).toBe(true)
        })

        it('should fail if code missing', async () => {
            const res = await request(app).post('/auth/google').send({})

            expect(res.status).toBe(400)
        })
    })

    describe('POST /auth/refresh', () => {
        it('should refresh tokens and rotate cookies', async () => {
            const password = 'Password123'

            await prisma.user.create({
                data: {
                    name: 'refresh',
                    email: 'refresh@example.com',
                    username: 'refresh',
                    password: await bcrypt.hash(password, 10),
                    emailVerified: true,
                },
            })

            const login = await request(app).post('/auth/login').send({
                email: 'refresh@example.com',
                password,
            })

            const res = await request(app)
                .post('/auth/refresh')
                .set('Cookie', buildCookieHeader(login))

            expect(res.status).toBe(200)

            const newCookies = getCookies(res)

            expect(newCookies.some((c) => c.includes('accessToken'))).toBe(true)
            expect(newCookies.some((c) => c.includes('refreshToken'))).toBe(true)
        })

        it('should clear cookies on failure', async () => {
            const res = await request(app)
                .post('/auth/refresh')
                .set('Cookie', 'refreshToken=invalid')

            expect(res.status).toBe(401)

            const cookies = getCookies(res)

            expect(cookies.some((c) => c.includes('accessToken=;'))).toBe(true)
            expect(cookies.some((c) => c.includes('refreshToken=;'))).toBe(true)
        })
    })
})
