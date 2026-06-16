import { prisma } from '@december/database'
import bcrypt from 'bcrypt'
import { describe, it, expect, beforeEach, afterAll, mock } from 'bun:test'
import cookieParser from 'cookie-parser'
import express from 'express'
import request from 'supertest'

const sendOTPMock = mock(async () => {})
const sendWelcomeEmailMock = mock(async () => {})
const axiosPostMock = mock()
const verifyIdTokenMock = mock()
const sendNotificationMock = mock(async () => ({}))

mock.module('../../../src/modules/auth/auth.utils', () => {
    const actual = require('../../../src/modules/auth/auth.utils')
    return {
        ...actual,
        sendOTP: sendOTPMock,
        sendWelcomeEmail: sendWelcomeEmailMock,
    }
})

mock.module('../../../src/modules/notification/notification.service', () => ({
    sendNotificationToUser: sendNotificationMock,
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
    return cookies.map((c) => c.split(';')[0]).join('; ')
}

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

describe('auth.routes.integration', () => {
    let app: ReturnType<typeof createApp>
    let isCleaningUp = false

    beforeEach(async () => {
        if (isCleaningUp) return
        app = createApp()
        sendOTPMock.mockClear()
        sendWelcomeEmailMock.mockClear()
        axiosPostMock.mockReset()
        verifyIdTokenMock.mockReset()
        sendNotificationMock.mockClear()

        await prisma.session.deleteMany()
        await prisma.user.deleteMany()

        process.env.ACCESS_TOKEN_SECRET = 'test-access'
        process.env.REFRESH_TOKEN_SECRET = 'test-refresh'
        process.env.GOOGLE_CLIENT_ID = 'test-client'
        process.env.GOOGLE_CLIENT_SECRET = 'test-secret'
    })

    afterAll(async () => {
        isCleaningUp = true
        await prisma.$disconnect()
    }, 15000)

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

        it('should fail on invalid email', async () => {
            const res = await request(app).post('/auth/signup').send({
                email: 'bad',
                password: 'Password123',
            })

            expect(res.status).toBe(400)
            expect(res.body.success).toBe(false)
        })

        it('should fail on short password', async () => {
            const res = await request(app).post('/auth/signup').send({
                email: 'test@example.com',
                password: '123',
            })

            expect(res.status).toBe(400)
            expect(res.body.success).toBe(false)
        })

        it('should fail on empty body', async () => {
            const res = await request(app).post('/auth/signup').send({})

            expect(res.status).toBe(400)
            expect(res.body.success).toBe(false)
        })

        it('should fail on missing password', async () => {
            const res = await request(app).post('/auth/signup').send({
                email: 'test@example.com',
            })

            expect(res.status).toBe(400)
        })

        it('should fail on missing email', async () => {
            const res = await request(app).post('/auth/signup').send({
                password: 'Password123',
            })

            expect(res.status).toBe(400)
        })

        it('should fail on duplicate email', async () => {
            await createUser({ email: 'dup@example.com', username: 'dup_user' })

            const res = await request(app).post('/auth/signup').send({
                email: 'dup@example.com',
                password: 'Password123',
            })

            expect(res.status).toBe(409)
            expect(res.body.success).toBe(false)
        })

        it('should allow signup and resend OTP if email already exists but is unverified', async () => {
            await createUser({
                email: 're-signup@example.com',
                username: 're_signup',
                emailVerified: false,
            })

            const res = await request(app).post('/auth/signup').send({
                email: 're-signup@example.com',
                password: 'NewPassword123',
            })

            expect(res.status).toBe(201)
            expect(res.body.success).toBe(true)
            expect(res.body.message).toBe('otp sent to email')
            expect(sendOTPMock).toHaveBeenCalled()
        })

        it('should fail on password longer than 20 chars', async () => {
            const res = await request(app)
                .post('/auth/signup')
                .send({
                    email: 'test@example.com',
                    password: 'a'.repeat(21),
                })

            expect(res.status).toBe(400)
        })
    })

    describe('POST /auth/verify', () => {
        it('should verify and set cookies', async () => {
            const otp = '123456'

            await createUser({
                email: 'verify@example.com',
                username: 'verify',
                emailVerified: false,
                otpHash: await bcrypt.hash(otp, 10),
                otpExpiresAt: new Date(Date.now() + 10000),
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

            expect(sendWelcomeEmailMock).toHaveBeenCalledTimes(1)
            expect(sendWelcomeEmailMock).toHaveBeenCalledWith('verify@example.com', 'Test User')
        })

        it('should fail if otp missing', async () => {
            const res = await request(app).post('/auth/verify').send({
                email: 'test@example.com',
            })

            expect(res.status).toBe(400)
        })

        it('should fail if email missing', async () => {
            const res = await request(app).post('/auth/verify').send({
                otp: '123456',
            })

            expect(res.status).toBe(400)
        })

        it('should fail with wrong otp', async () => {
            await createUser({
                email: 'wrongotp@example.com',
                username: 'wrongotp',
                emailVerified: false,
                otpHash: await bcrypt.hash('123456', 10),
                otpExpiresAt: new Date(Date.now() + 10000),
            })

            const res = await request(app).post('/auth/verify').send({
                email: 'wrongotp@example.com',
                otp: '000000',
            })

            expect(res.status).toBe(401)
        })

        it('should fail with expired otp', async () => {
            const otp = '123456'
            await createUser({
                email: 'expiredotp@example.com',
                username: 'expiredotp',
                emailVerified: false,
                otpHash: await bcrypt.hash(otp, 10),
                otpExpiresAt: new Date(Date.now() - 5000),
            })

            const res = await request(app).post('/auth/verify').send({
                email: 'expiredotp@example.com',
                otp,
            })

            expect(res.status).toBe(401)
        })

        it('should fail if user does not exist', async () => {
            const res = await request(app).post('/auth/verify').send({
                email: 'ghost@example.com',
                otp: '123456',
            })

            expect(res.status).toBe(404)
        })
    })

    describe('POST /auth/login', () => {
        it('should login and set cookies', async () => {
            const password = 'Password123'

            await createUser({
                email: 'login@example.com',
                username: 'login',
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
            await createUser({
                email: 'wrong@example.com',
                username: 'wrong',
            })

            const res = await request(app).post('/auth/login').send({
                email: 'wrong@example.com',
                password: 'Wrong123',
            })

            expect(res.status).toBe(401)
        })

        it('should fail with non-existent user', async () => {
            const res = await request(app).post('/auth/login').send({
                email: 'ghost@example.com',
                password: 'Password123',
            })

            expect(res.status).toBe(401)
        })

        it('should fail on empty body', async () => {
            const res = await request(app).post('/auth/login').send({})

            expect(res.status).toBe(400)
        })

        it('should fail on invalid email format', async () => {
            const res = await request(app).post('/auth/login').send({
                email: 'notanemail',
                password: 'Password123',
            })

            expect(res.status).toBe(400)
        })

        it('should fail for soft-deleted user', async () => {
            await createUser({
                email: 'softdel@example.com',
                username: 'softdel_login',
                isDeleted: true,
            })

            const res = await request(app).post('/auth/login').send({
                email: 'softdel@example.com',
                password: 'Password123',
            })

            expect(res.status).toBe(401)
        })
    })

    describe('POST /auth/forgot-password', () => {
        it('should request a reset otp', async () => {
            await createUser({
                email: 'forgot@example.com',
                username: 'forgot_user',
            })

            const res = await request(app).post('/auth/forgot-password/request').send({
                email: 'forgot@example.com',
            })

            expect(res.status).toBe(200)
            expect(sendOTPMock).toHaveBeenCalledTimes(1)
        })

        it('should verify reset otp', async () => {
            const otp = '123456'
            await createUser({
                email: 'verifyforgot@example.com',
                username: 'verifyforgot',
                otpHash: await bcrypt.hash(otp, 10),
                otpExpiresAt: new Date(Date.now() + 10000),
            })

            const res = await request(app).post('/auth/forgot-password/verify').send({
                email: 'verifyforgot@example.com',
                otp,
            })

            expect(res.status).toBe(200)
        })

        it('should reset password with valid otp', async () => {
            const otp = '123456'
            const user = await createUser({
                email: 'resetforgot@example.com',
                username: 'resetforgot',
                otpHash: await bcrypt.hash(otp, 10),
                otpExpiresAt: new Date(Date.now() + 10000),
            })

            const res = await request(app).post('/auth/forgot-password/reset').send({
                email: user.email,
                otp,
                newPassword: 'NewPass123',
            })

            const updatedUser = await prisma.user.findUnique({ where: { id: user.id } })

            expect(res.status).toBe(200)
            expect(await bcrypt.compare('NewPass123', updatedUser!.password!)).toBe(true)
        })

        it('should reject invalid reset payloads', async () => {
            const res = await request(app).post('/auth/forgot-password/reset').send({
                email: 'bad@example.com',
                otp: '123',
                newPassword: '123',
            })

            expect(res.status).toBe(400)
        })

        it('should return 200 but not send otp if requesting for non-existent email', async () => {
            const res = await request(app).post('/auth/forgot-password/request').send({
                email: 'nonexistent@example.com',
            })

            expect(res.status).toBe(200)
            expect(sendOTPMock).not.toHaveBeenCalled()
        })

        it('should fail to verify reset otp with wrong otp', async () => {
            await createUser({
                email: 'verifyforgotwrong@example.com',
                username: 'verifyforgotwrong',
                otpHash: await bcrypt.hash('123456', 10),
                otpExpiresAt: new Date(Date.now() + 10000),
            })

            const res = await request(app).post('/auth/forgot-password/verify').send({
                email: 'verifyforgotwrong@example.com',
                otp: '999999',
            })

            expect(res.status).toBe(401)
            expect(res.body.message).toBe('otp verification failed')
            expect(res.body.errors).toBe('invalid or expired reset code')
        })

        it('should fail to verify reset otp with expired otp', async () => {
            await createUser({
                email: 'verifyforgotexpired@example.com',
                username: 'verifyforgotexpired',
                otpHash: await bcrypt.hash('123456', 10),
                otpExpiresAt: new Date(Date.now() - 1000),
            })

            const res = await request(app).post('/auth/forgot-password/verify').send({
                email: 'verifyforgotexpired@example.com',
                otp: '123456',
            })

            expect(res.status).toBe(401)
            expect(res.body.message).toBe('otp verification failed')
            expect(res.body.errors).toBe('invalid or expired reset code')
        })

        it('should fail to reset password with wrong otp', async () => {
            await createUser({
                email: 'resetforgotwrong@example.com',
                username: 'resetforgotwrong',
                otpHash: await bcrypt.hash('123456', 10),
                otpExpiresAt: new Date(Date.now() + 10000),
            })

            const res = await request(app).post('/auth/forgot-password/reset').send({
                email: 'resetforgotwrong@example.com',
                otp: '999999',
                newPassword: 'NewPassword123',
            })

            expect(res.status).toBe(401)
            expect(res.body.message).toBe('password reset failed')
            expect(res.body.errors).toBe('invalid or expired reset code')
        })

        it('should fail to reset password with expired otp', async () => {
            await createUser({
                email: 'resetforgotexpired@example.com',
                username: 'resetforgotexpired',
                otpHash: await bcrypt.hash('123456', 10),
                otpExpiresAt: new Date(Date.now() - 1000),
            })

            const res = await request(app).post('/auth/forgot-password/reset').send({
                email: 'resetforgotexpired@example.com',
                otp: '123456',
                newPassword: 'NewPassword123',
            })

            expect(res.status).toBe(401)
            expect(res.body.message).toBe('password reset failed')
            expect(res.body.errors).toBe('invalid or expired reset code')
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

        it('should fail if google token exchange fails', async () => {
            axiosPostMock.mockRejectedValue(new Error('token exchange failed'))

            const res = await request(app).post('/auth/google').send({
                code: 'bad-code',
            })

            expect(res.status).toBe(500)
        })
    })

    describe('POST /auth/refresh', () => {
        it('should refresh tokens and rotate cookies', async () => {
            const password = 'Password123'

            await createUser({
                email: 'refresh@example.com',
                username: 'refresh',
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

        it('should fail without any cookie', async () => {
            const res = await request(app).post('/auth/refresh')

            expect(res.status).toBe(401)
        })

        it('should fail with empty refreshToken cookie', async () => {
            const res = await request(app).post('/auth/refresh').set('Cookie', 'refreshToken=')

            expect(res.status).toBe(401)
        })
    })
})
