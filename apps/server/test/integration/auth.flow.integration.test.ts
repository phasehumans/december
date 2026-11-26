import { prisma } from '@december/database'
import { describe, it, expect, afterAll } from 'bun:test'
import request from 'supertest'

import app from '../../src/app'
import { authCookieToken, cleanupTestUser, getRandomIP, signInWithEmailCode } from '../helpers'

describe('Auth Flow Integration Tests (Email code sign up, Log in, Signout)', () => {
    const testEmail = `flowtest-${Date.now()}@example.com`
    let testUserId: string
    let accessToken: string
    let refreshToken: string

    afterAll(async () => {
        if (testUserId) {
            await cleanupTestUser({ id: testUserId })
        }
    })

    it('1. POST /api/v1/auth/email/start - creates unverified user', async () => {
        const res = await request(app)
            .post('/api/v1/auth/email/start')
            .set('x-forwarded-for', getRandomIP())
            .send({ email: testEmail })

        expect(res.status).toBe(200)
        expect(res.body.message).toBe('otp sent to email')

        const user = await prisma.user.findUnique({ where: { email: testEmail } })
        expect(user).not.toBeNull()
        expect(user?.emailVerified).toBe(false)
        testUserId = user!.id
    })

    it('2. POST /api/v1/auth/email/verify - verifies OTP and issues tokens', async () => {
        const bcrypt = await import('bcrypt')
        const { env } = await import('../../src/env')
        const otpHash = await bcrypt.hash('654321', env.BCRYPT_SALT_ROUNDS)

        await prisma.user.update({
            where: { id: testUserId },
            data: {
                otpHash,
                otpExpiresAt: new Date(Date.now() + 10 * 60 * 1000),
            },
        })

        const res = await request(app)
            .post('/api/v1/auth/email/verify')
            .set('x-forwarded-for', getRandomIP())
            .send({ email: testEmail, otp: '654321' })

        expect(res.status).toBe(200)
        // the token is only in the httpOnly cookie
        expect(res.body.data.accessToken).toBeUndefined()

        accessToken = authCookieToken(res)

        const user = await prisma.user.findUnique({ where: { id: testUserId } })
        expect(user?.emailVerified).toBe(true)
    })

    it('3. POST /api/v1/auth/email/verify - logs a verified user in again with a new code', async () => {
        const res = await signInWithEmailCode(app, testEmail)

        expect(res.status).toBe(200)
        // the token is only in the httpOnly cookie
        expect(res.body.data.accessToken).toBeUndefined()

        accessToken = authCookieToken(res)
    })

    it('4. GET /api/v1/auth/cli-token - route is removed (404)', async () => {
        const res = await request(app)
            .get('/api/v1/auth/cli-token')
            .set('x-forwarded-for', getRandomIP())
            .set('Authorization', `Bearer ${accessToken}`)

        expect(res.status).toBe(404)
    })

    it('5. POST /api/v1/auth/signout - revokes active session', async () => {
        const res = await request(app)
            .post('/api/v1/auth/signout')
            .set('x-forwarded-for', getRandomIP())
            .set('Authorization', `Bearer ${accessToken}`)

        expect(res.status).toBe(200)
        expect(res.body.message).toBe('signed out successfully')

        // Subsequent authenticated request should fail
        const resProtected = await request(app)
            .get('/api/v1/setting')
            .set('x-forwarded-for', getRandomIP())
            .set('Authorization', `Bearer ${accessToken}`)

        expect(resProtected.status).toBe(401)
    })
})
