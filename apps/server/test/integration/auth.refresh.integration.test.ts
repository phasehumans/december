import { prisma } from '@december/database'
import { describe, it, expect, afterAll } from 'bun:test'
import request from 'supertest'

import app from '../../src/app'
import { sessionCache } from '../../src/modules/auth/auth.cache'
import { generateAccessToken } from '../../src/modules/auth/auth.utils'
import { authCookieToken, cleanupTestUser, getRandomIP, signInWithEmailCode } from '../helpers'

describe('Auth Refresh Token & Rotation Integration Tests', () => {
    const testEmail = `refreshtest-${Date.now()}@example.com`
    let testUserId: string
    let refreshToken: string

    afterAll(async () => {
        if (testUserId) {
            await cleanupTestUser({ id: testUserId })
        }
    })

    const sessionIdOf = (token: string) => JSON.parse(atob(token.split('.')[1]!)).sessionId

    // a token for the session of a new sign-in, made some time ago
    const signInWithOldToken = async (ageMs: number) => {
        const loginRes = await signInWithEmailCode(app, testEmail)
        expect(loginRes.status).toBe(200)
        const sessionId = sessionIdOf(authCookieToken(loginRes))
        const token = generateAccessToken(
            { userId: testUserId, sessionId },
            { issuedAt: new Date(Date.now() - ageMs) }
        )
        return { sessionId, token }
    }

    // makes the last refresh of a session look this long ago
    const ageLastRefresh = async (sessionId: string, ageMs: number) => {
        await prisma.authSession.update({
            where: { id: sessionId },
            data: { rotatedAt: new Date(Date.now() - ageMs) },
        })
        await sessionCache.invalidate(sessionId)
    }

    const refreshWithBody = (token: string) =>
        request(app)
            .post('/api/v1/auth/refresh')
            .set('x-forwarded-for', getRandomIP())
            .send({ refreshToken: token })

    const getSettings = (token: string) =>
        request(app)
            .get('/api/v1/setting')
            .set('x-forwarded-for', getRandomIP())
            .set('Authorization', `Bearer ${token}`)

    it('setup: signup & verify user', async () => {
        const user = await prisma.user.create({
            data: {
                email: testEmail,
                name: 'Refresh Test User',
                emailVerified: true,
            },
        })
        testUserId = user.id

        const loginRes = await signInWithEmailCode(app, testEmail)

        expect(loginRes.status).toBe(200)
        refreshToken = authCookieToken(loginRes)
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
        const loginRes = await signInWithEmailCode(app, testEmail)

        expect(loginRes.status).toBe(200)
        const activeToken = authCookieToken(loginRes)

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
        const loginRes = await signInWithEmailCode(app, testEmail)

        expect(loginRes.status).toBe(200)
        const sharedTabToken = authCookieToken(loginRes)

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

        // both tabs got a token that can refresh again later
        expect((await refreshWithBody(tab1Res.body.data.accessToken)).status).toBe(200)
        expect((await refreshWithBody(tab2Res.body.data.accessToken)).status).toBe(200)

        const session = await prisma.authSession.findUnique({
            where: { id: sessionIdOf(sharedTabToken) },
        })
        expect(session?.isRevoked).toBe(false)
    })

    it('5. POST /api/v1/auth/refresh - detects token reuse outside 30-second grace window and revokes session', async () => {
        const { sessionId, token: oldToken } = await signInWithOldToken(2 * 60 * 1000)

        const refreshRes = await refreshWithBody(oldToken)
        expect(refreshRes.status).toBe(200)

        // the old token again 40 seconds after the refresh
        await ageLastRefresh(sessionId, 40 * 1000)

        const reuseRes = await refreshWithBody(oldToken)
        expect(reuseRes.status).toBe(401)
        expect(reuseRes.body.message).toBe('token reuse detected')

        const revokedSession = await prisma.authSession.findUnique({ where: { id: sessionId } })
        expect(revokedSession?.isRevoked).toBe(true)
    })

    it('6. authMiddleware - authenticates via HTTP-only accessToken cookie', async () => {
        const loginRes = await signInWithEmailCode(app, testEmail)

        expect(loginRes.status).toBe(200)
        const cookies = loginRes.headers['set-cookie']
        expect(cookies).toBeDefined()

        // Extract accessToken cookie
        const cookieHeader = Array.isArray(cookies) ? cookies.join('; ') : cookies

        // Access protected endpoint with cookie instead of Authorization header
        const res = await request(app)
            .get('/api/v1/setting')
            .set('x-forwarded-for', getRandomIP())
            .set('Cookie', cookieHeader)

        expect(res.status).toBe(200)
        expect(res.body.data.email).toBe(testEmail)
    })

    it('7. POST /api/v1/auth/refresh - renews an expired token while its session is active', async () => {
        const loginRes = await signInWithEmailCode(app, testEmail)
        const sessionId = sessionIdOf(authCookieToken(loginRes))
        const expiredToken = generateAccessToken(
            { userId: testUserId, sessionId },
            { expiresIn: -60 }
        )

        const expiredRes = await getSettings(expiredToken)
        expect(expiredRes.status).toBe(401)
        expect(expiredRes.body.message).toBe('Access token expired')

        const refreshRes = await refreshWithBody(expiredToken)
        expect(refreshRes.status).toBe(200)

        const settingsRes = await getSettings(refreshRes.body.data.accessToken)
        expect(settingsRes.status).toBe(200)
    })

    it('8. POST /api/v1/auth/refresh - a cookie refresh puts the new token only in the cookie', async () => {
        const loginRes = await signInWithEmailCode(app, testEmail)
        const token = authCookieToken(loginRes)

        const res = await request(app)
            .post('/api/v1/auth/refresh')
            .set('x-forwarded-for', getRandomIP())
            .set('Cookie', `accessToken=${token}`)

        expect(res.status).toBe(200)
        expect(res.body.data.accessToken).toBeUndefined()
        expect(res.body.data.token).toBeUndefined()
        expect(authCookieToken(res)).not.toBe(token)
    })

    it('9. authMiddleware - a token replaced by a refresh stops working after the grace period', async () => {
        const { sessionId, token: oldToken } = await signInWithOldToken(2 * 60 * 1000)

        const refreshRes = await refreshWithBody(oldToken)
        const newToken = refreshRes.body.data.accessToken

        // other tabs can still finish requests sent with the old token
        expect((await getSettings(oldToken)).status).toBe(200)

        await ageLastRefresh(sessionId, 40 * 1000)

        const replacedRes = await getSettings(oldToken)
        expect(replacedRes.status).toBe(401)
        expect(replacedRes.body.message).toBe('Token replaced')
        expect((await getSettings(newToken)).status).toBe(200)
    })
})
