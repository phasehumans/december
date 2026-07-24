import { prisma } from '@december/database'
import { describe, it, expect, beforeAll, afterAll } from 'bun:test'
import request from 'supertest'

import app from '../src/app'
import { hashRefreshToken } from '../src/modules/auth/auth.utils'

describe('Auth Module Hardening & SHA-256 Token Hashing', () => {
    let testUserId: string
    let testEmail: string
    const testPassword = 'Password123!'
    let accessToken: string
    let refreshToken: string

    beforeAll(async () => {
        testEmail = `authtest-${Date.now()}@example.com`
    })

    afterAll(async () => {
        if (testUserId) {
            await prisma.authSession.deleteMany({ where: { userId: testUserId } }).catch(() => {})
            await prisma.user.delete({ where: { id: testUserId } }).catch(() => {})
        }
    })

    it('POST /api/v1/auth/signup - creates unverified user and sends OTP', async () => {
        const res = await request(app)
            .post('/api/v1/auth/signup')
            .send({ email: testEmail, password: testPassword })

        expect(res.status).toBe(201)
        expect(res.body.message).toBe('otp sent to email')

        const user = await prisma.user.findUnique({ where: { email: testEmail } })
        expect(user).not.toBeNull()
        expect(user?.emailVerified).toBe(false)
        testUserId = user!.id
    })

    it('POST /api/v1/auth/login - fails for unverified user', async () => {
        const res = await request(app)
            .post('/api/v1/auth/login')
            .send({ email: testEmail, password: testPassword })

        expect(res.status).toBe(401)
        expect(res.body.message).toBe('please verify your email')
    })

    it('POST /api/v1/auth/verify - verifies user with OTP and generates session with SHA-256 token hash', async () => {
        // Force OTP to known value in DB for test
        const bcrypt = await import('bcrypt')
        const { env } = await import('../src/env')
        const otpHash = await bcrypt.hash('123456', env.BCRYPT_SALT_ROUNDS)

        await prisma.user.update({
            where: { email: testEmail },
            data: {
                otpHash,
                otpExpiresAt: new Date(Date.now() + 10 * 60 * 1000),
            },
        })

        const res = await request(app)
            .post('/api/v1/auth/verify')
            .send({ email: testEmail, otp: '123456' })

        expect(res.status).toBe(200)
        expect(res.body.data.accessToken).toBeDefined()
        expect(res.body.data.refreshToken).toBeDefined()

        accessToken = res.body.data.accessToken
        refreshToken = res.body.data.refreshToken

        // Verify SHA-256 hash stored in DB matches expected SHA-256 hash of refreshToken
        const expectedHash = hashRefreshToken(refreshToken)
        const session = await prisma.authSession.findFirst({ where: { userId: testUserId } })

        expect(session).not.toBeNull()
        expect(session?.refreshTokenHash).toBe(expectedHash)
    })

    it('POST /api/v1/auth/refresh - refreshes session using SHA-256 refresh token', async () => {
        const res = await request(app).post('/api/v1/auth/refresh').send({ refreshToken })

        expect(res.status).toBe(200)
        expect(res.body.data.accessToken).toBeDefined()
        expect(res.body.data.refreshToken).toBeDefined()

        const newRefreshToken = res.body.data.refreshToken
        expect(newRefreshToken).not.toBe(refreshToken)

        const expectedNewHash = hashRefreshToken(newRefreshToken)
        const session = await prisma.authSession.findFirst({ where: { userId: testUserId } })
        expect(session?.refreshTokenHash).toBe(expectedNewHash)

        // Update refreshToken variable for subsequent tests
        refreshToken = newRefreshToken
    })
})
