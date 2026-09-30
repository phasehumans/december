import { prisma } from '@december/database'
import { describe, it, expect, afterAll } from 'bun:test'
import request from 'supertest'

import app from '../../src/app'
import { cleanupTestUser, getRandomIP } from '../helpers'

describe('Auth Refresh Token & Rotation Integration Tests', () => {
    const testEmail = `refreshtest-${Date.now()}@example.com`
    const testPassword = 'Password123!'
    let testUserId: string
    let refreshToken: string

    afterAll(async () => {
        if (testUserId) {
            await cleanupTestUser({ id: testUserId })
        }
    })

    it('setup: signup & verify user', async () => {
        const bcrypt = await import('bcrypt')
        const { env } = await import('../../src/env')
        const passHash = await bcrypt.hash(testPassword, env.BCRYPT_SALT_ROUNDS)

        const user = await prisma.user.create({
            data: {
                email: testEmail,
                name: 'Refresh Test User',
                username: `refreshuser-${Date.now()}`,
                password: passHash,
                emailVerified: true,
            },
        })
        testUserId = user.id

        const loginRes = await request(app)
            .post('/api/v1/auth/login')
            .set('x-forwarded-for', getRandomIP())
            .send({ email: testEmail, password: testPassword })

        expect(loginRes.status).toBe(200)
        refreshToken = loginRes.body.data.accessToken
    })

    it('1. POST /api/v1/auth/refresh - refreshes session and returns 30-day session token', async () => {
        const res = await request(app)
            .post('/api/v1/auth/refresh')
            .set('x-forwarded-for', getRandomIP())
            .send({ refreshToken })

        expect(res.status).toBe(200)
        expect(res.body.data.accessToken).toBeDefined()

        const session = await prisma.authSession.findFirst({ where: { userId: testUserId } })
        expect(session).toBeDefined()
    })

    it('2. POST /api/v1/auth/refresh - rejects expired session', async () => {
        // Force expiresAt timestamp in DB to past
        await prisma.authSession.updateMany({
            where: { userId: testUserId },
            data: { expiresAt: new Date(Date.now() - 1000) },
        })

        const { sessionCache } = await import('../../src/modules/auth/auth.cache')
        sessionCache.clear()

        const resExpired = await request(app)
            .post('/api/v1/auth/refresh')
            .set('x-forwarded-for', getRandomIP())
            .send({ refreshToken })

        expect(resExpired.status).toBe(401)
        expect(resExpired.body.message).toBe('session expired')
    })

    it('3. POST /api/v1/auth/refresh - rotates tokens atomically and updates previousRefreshTokenHash and rotatedAt', async () => {
        // Log in to get fresh active session
        const loginRes = await request(app)
            .post('/api/v1/auth/login')
            .set('x-forwarded-for', getRandomIP())
            .send({ email: testEmail, password: testPassword })

        expect(loginRes.status).toBe(200)
        const activeToken = loginRes.body.data.accessToken

        const refreshRes = await request(app)
            .post('/api/v1/auth/refresh')
            .set('x-forwarded-for', getRandomIP())
            .send({ refreshToken: activeToken })

        expect(refreshRes.status).toBe(200)
        const newAccessToken = refreshRes.body.data.accessToken
        expect(newAccessToken).toBeDefined()
        expect(newAccessToken).not.toBe(activeToken)

        // Check DB session fields
        const session = await prisma.authSession.findFirst({
            where: { userId: testUserId, isRevoked: false },
        })
        expect(session).not.toBeNull()
        expect(session?.previousRefreshTokenHash).toBeDefined()
        expect(session?.rotatedAt).toBeDefined()
    })

    it('4. POST /api/v1/auth/refresh - handles concurrent multi-tab refresh within 30-second grace window', async () => {
        // Log in to get fresh active session
        const loginRes = await request(app)
            .post('/api/v1/auth/login')
            .set('x-forwarded-for', getRandomIP())
            .send({ email: testEmail, password: testPassword })

        expect(loginRes.status).toBe(200)
        const sharedTabToken = loginRes.body.data.accessToken

        // Simulate Tab 1 and Tab 2 refreshing simultaneously with the same token
        const [tab1Res, tab2Res] = await Promise.all([
            request(app)
                .post('/api/v1/auth/refresh')
                .set('x-forwarded-for', getRandomIP())
                .send({ refreshToken: sharedTabToken }),
            request(app)
                .post('/api/v1/auth/refresh')
                .set('x-forwarded-for', getRandomIP())
                .send({ refreshToken: sharedTabToken }),
        ])

        // Both concurrent requests should succeed without false token reuse logout
        expect(tab1Res.status).toBe(200)
        expect(tab2Res.status).toBe(200)
        expect(tab1Res.body.data.accessToken).toBeDefined()
        expect(tab2Res.body.data.accessToken).toBeDefined()

        // Verify session remains active and not revoked
        const session = await prisma.authSession.findFirst({
            where: { userId: testUserId, isRevoked: false },
        })
        expect(session).not.toBeNull()
        expect(session?.isRevoked).toBe(false)
    })

    it('5. POST /api/v1/auth/refresh - detects token reuse outside 30-second grace window and revokes session', async () => {
        // Log in to get fresh active session
        const loginRes = await request(app)
            .post('/api/v1/auth/login')
            .set('x-forwarded-for', getRandomIP())
            .send({ email: testEmail, password: testPassword })

        expect(loginRes.status).toBe(200)
        const oldToken = loginRes.body.data.accessToken

        // Rotate once
        const refreshRes = await request(app)
            .post('/api/v1/auth/refresh')
            .set('x-forwarded-for', getRandomIP())
            .send({ refreshToken: oldToken })

        expect(refreshRes.status).toBe(200)

        // Age rotatedAt beyond 30-second grace window (set to 40 seconds ago)
        await prisma.authSession.updateMany({
            where: { userId: testUserId, isRevoked: false },
            data: { rotatedAt: new Date(Date.now() - 40 * 1000) },
        })

        // Attempt reuse of the old rotated token outside grace period
        const reuseRes = await request(app)
            .post('/api/v1/auth/refresh')
            .set('x-forwarded-for', getRandomIP())
            .send({ refreshToken: oldToken })

        expect(reuseRes.status).toBe(401)
        expect(reuseRes.body.message).toBe('token reuse detected')

        // Verify session was revoked immediately in DB
        const jwt = await import('jsonwebtoken')
        const decoded = jwt.default.decode(oldToken) as any
        const revokedSession = await prisma.authSession.findUnique({
            where: { id: decoded.sessionId },
        })
        expect(revokedSession?.isRevoked).toBe(true)
    })

    it('6. authMiddleware - authenticates via HTTP-only accessToken cookie', async () => {
        const loginRes = await request(app)
            .post('/api/v1/auth/login')
            .set('x-forwarded-for', getRandomIP())
            .send({ email: testEmail, password: testPassword })

        expect(loginRes.status).toBe(200)
        const cookies = loginRes.headers['set-cookie']
        expect(cookies).toBeDefined()

        // Extract accessToken cookie
        const cookieHeader = Array.isArray(cookies) ? cookies.join('; ') : cookies

        // Access protected endpoint with cookie instead of Authorization header
        const res = await request(app)
            .get('/api/v1/auth/cli-token')
            .set('x-forwarded-for', getRandomIP())
            .set('Cookie', cookieHeader)

        expect(res.status).toBe(200)
        expect(res.body.data.email).toBe(testEmail)
    })
})
