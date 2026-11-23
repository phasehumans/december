import { prisma } from '@december/database'
import { describe, it, expect, beforeAll, afterAll } from 'bun:test'
import request from 'supertest'

import app from '../../src/app'
import { cleanupTestUser, getRandomIP } from '../helpers'

describe('Waitlist Module Integration Tests', () => {
    let testUserId: string
    let accessToken: string

    const get = (path: string) =>
        request(app)
            .get(path)
            .set('x-forwarded-for', getRandomIP())
            .set('Authorization', `Bearer ${accessToken}`)

    const post = (path: string) =>
        request(app)
            .post(path)
            .set('x-forwarded-for', getRandomIP())
            .set('Authorization', `Bearer ${accessToken}`)

    beforeAll(async () => {
        const timestamp = Date.now()
        const user = await prisma.user.create({
            data: {
                name: 'Waitlist Test User',
                email: `waitlisttest-${timestamp}@example.com`,
                emailVerified: true,
            },
        })
        testUserId = user.id

        const { generateAccessToken } = await import('../../src/modules/auth/auth.utils')
        const session = await prisma.authSession.create({
            data: {
                userId: testUserId,
                refreshTokenHash: `test-hash-waitlist-${timestamp}`,
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            },
        })

        accessToken = generateAccessToken({ userId: testUserId, sessionId: session.id })
    })

    afterAll(async () => {
        if (testUserId) {
            await prisma.featureWaitlist.deleteMany({ where: { userId: testUserId } }).catch(() => {
                // Intentionally swallowed: test cleanup fallback
            })
            await cleanupTestUser({ id: testUserId })
        }
    })

    it('1. GET /api/v1/waitlist/super-crew - unauthorized without token (401)', async () => {
        const res = await request(app)
            .get('/api/v1/waitlist/super-crew')
            .set('x-forwarded-for', getRandomIP())

        expect(res.status).toBe(401)
    })

    it('2. GET returns default state and does not create a row', async () => {
        const res = await get('/api/v1/waitlist/super-crew')

        expect(res.status).toBe(200)
        expect(res.body.data).toEqual({
            feature: 'super-crew',
            joined: false,
            joinedAt: null,
            popupSeen: false,
            canShowPopup: false,
        })

        const rows = await prisma.featureWaitlist.count({ where: { userId: testUserId } })
        expect(rows).toBe(0)
    })

    it('3. canShowPopup turns true once onboarding is complete', async () => {
        await prisma.user.update({
            where: { id: testUserId },
            data: { onboardingCompletedAt: new Date() },
        })

        const res = await get('/api/v1/waitlist/super-crew')

        expect(res.status).toBe(200)
        expect(res.body.data.canShowPopup).toBe(true)
        expect(res.body.data.popupSeen).toBe(false)
    })

    it('4. POST /join is idempotent', async () => {
        const first = await post('/api/v1/waitlist/super-crew/join')

        expect(first.status).toBe(200)
        expect(first.body.data.joined).toBe(true)
        expect(typeof first.body.data.joinedAt).toBe('string')

        const second = await post('/api/v1/waitlist/super-crew/join')

        expect(second.status).toBe(200)
        expect(second.body.data.joinedAt).toBe(first.body.data.joinedAt)

        const rows = await prisma.featureWaitlist.count({ where: { userId: testUserId } })
        expect(rows).toBe(1)
    })

    it('5. POST /seen flips canShowPopup to false', async () => {
        const res = await post('/api/v1/waitlist/super-crew/seen')

        expect(res.status).toBe(200)
        expect(res.body.data.popupSeen).toBe(true)
        expect(res.body.data.canShowPopup).toBe(false)
        expect(res.body.data.joined).toBe(true)

        const again = await get('/api/v1/waitlist/super-crew')
        expect(again.body.data.canShowPopup).toBe(false)
    })

    it('6. unknown feature is rejected (400)', async () => {
        const res = await get('/api/v1/waitlist/not-a-feature')

        expect(res.status).toBe(400)
    })
})
