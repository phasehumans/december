import { prisma } from '@december/database'
import { describe, it, expect, beforeAll, afterAll } from 'bun:test'
import request from 'supertest'

import app from '../../src/app'
import { cleanupTestUser, getRandomIP } from '../helpers'

describe('Setting Module Integration Tests', () => {
    let testUserId: string
    let testEmail: string
    let accessToken: string

    beforeAll(async () => {
        const timestamp = Date.now()
        testEmail = `settingtest-${timestamp}@example.com`

        const user = await prisma.user.create({
            data: {
                name: 'Setting Test User',
                email: testEmail,
                emailVerified: true,
            },
        })
        testUserId = user.id

        const { generateAccessToken } = await import('../../src/modules/auth/auth.utils')
        const session = await prisma.authSession.create({
            data: {
                userId: testUserId,
                refreshTokenHash: `test-hash-${timestamp}`,
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            },
        })

        accessToken = generateAccessToken({ userId: testUserId, sessionId: session.id })
    })

    afterAll(async () => {
        if (testUserId) {
            await prisma.feedback.deleteMany({ where: { userId: testUserId } }).catch(() => {
                // Intentionally swallowed: test cleanup fallback
            })
            await prisma.authSession.deleteMany({ where: { userId: testUserId } }).catch(() => {
                // Intentionally swallowed: test cleanup fallback
            })
            await cleanupTestUser({ id: testUserId })
        }
    })

    it('1. GET /api/v1/setting - unauthorized without token (401)', async () => {
        const res = await request(app).get('/api/v1/setting').set('x-forwarded-for', getRandomIP())

        expect(res.status).toBe(401)
    })

    it('2. GET /api/v1/setting/me - returns user basic info', async () => {
        const res = await request(app)
            .get('/api/v1/setting/me')
            .set('x-forwarded-for', getRandomIP())
            .set('Authorization', `Bearer ${accessToken}`)

        expect(res.status).toBe(200)
        expect(res.body.data.fullName).toBe('Setting Test User')
        expect(res.body.data.isGithubConnected).toBe(false)
    })

    it('3. GET /api/v1/setting - returns user profile', async () => {
        const res = await request(app)
            .get('/api/v1/setting')
            .set('x-forwarded-for', getRandomIP())
            .set('Authorization', `Bearer ${accessToken}`)

        expect(res.status).toBe(200)
        expect(res.body.data.id).toBe(testUserId)
        expect(res.body.data.email).toBe(testEmail)
        expect(res.body.data).not.toHaveProperty('hasPassword')
        expect(res.body.data).not.toHaveProperty('password')
    })

    it('4. PATCH /api/v1/setting/name - updates display name', async () => {
        const res = await request(app)
            .patch('/api/v1/setting/name')
            .set('x-forwarded-for', getRandomIP())
            .set('Authorization', `Bearer ${accessToken}`)
            .send({ name: 'Updated Name' })

        expect(res.status).toBe(200)
        expect(res.body.data.name).toBe('Updated Name')

        const dbUser = await prisma.user.findUnique({ where: { id: testUserId } })
        expect(dbUser?.name).toBe('Updated Name')
    })

    it('6. PATCH /api/v1/setting/notifications - updates notification preferences', async () => {
        const res = await request(app)
            .patch('/api/v1/setting/notifications')
            .set('x-forwarded-for', getRandomIP())
            .set('Authorization', `Bearer ${accessToken}`)
            .send({
                notifyProjectActivity: false,
                notifyProductUpdates: true,
                notifySecurityAlerts: false,
            })

        expect(res.status).toBe(200)
        expect(res.body.data.notifyProjectActivity).toBe(false)
        expect(res.body.data.notifyProductUpdates).toBe(true)
        expect(res.body.data.notifySecurityAlerts).toBe(false)
    })

    it('7. a new user starts with onboarding not done', async () => {
        const profile = await request(app)
            .get('/api/v1/setting')
            .set('x-forwarded-for', getRandomIP())
            .set('Authorization', `Bearer ${accessToken}`)

        expect(profile.status).toBe(200)
        expect(profile.body.data.onboardingCompletedAt).toBeNull()

        const res = await request(app)
            .get('/api/v1/setting/onboarding')
            .set('x-forwarded-for', getRandomIP())
            .set('Authorization', `Bearer ${accessToken}`)

        expect(res.status).toBe(200)
        expect(res.body.data.completedAt).toBeNull()
        expect(res.body.data.step).toBeNull()
        expect(res.body.data.steps).toEqual({ models: false, github: false })
    })

    it('8. PATCH /api/v1/setting/onboarding - saves the step to resume at', async () => {
        const res = await request(app)
            .patch('/api/v1/setting/onboarding')
            .set('x-forwarded-for', getRandomIP())
            .set('Authorization', `Bearer ${accessToken}`)
            .send({ step: 'start' })

        expect(res.status).toBe(200)
        expect(res.body.data.step).toBe('start')

        const bad = await request(app)
            .patch('/api/v1/setting/onboarding')
            .set('x-forwarded-for', getRandomIP())
            .set('Authorization', `Bearer ${accessToken}`)
            .send({ step: 'welcome' })

        expect(bad.status).toBe(400)
    })

    it('9. POST /api/v1/setting/onboarding/complete - sets the date once', async () => {
        const first = await request(app)
            .post('/api/v1/setting/onboarding/complete')
            .set('x-forwarded-for', getRandomIP())
            .set('Authorization', `Bearer ${accessToken}`)

        expect(first.status).toBe(200)
        expect(first.body.data.completedAt).not.toBeNull()

        const second = await request(app)
            .post('/api/v1/setting/onboarding/complete')
            .set('x-forwarded-for', getRandomIP())
            .set('Authorization', `Bearer ${accessToken}`)

        expect(second.status).toBe(200)
        expect(second.body.data.completedAt).toBe(first.body.data.completedAt)

        const profile = await request(app)
            .get('/api/v1/setting')
            .set('x-forwarded-for', getRandomIP())
            .set('Authorization', `Bearer ${accessToken}`)

        expect(profile.body.data.onboardingCompletedAt).toBe(first.body.data.completedAt)
    })

    it('10. POST /api/v1/setting/feedback - submits user feedback', async () => {
        const res = await request(app)
            .post('/api/v1/setting/feedback')
            .set('x-forwarded-for', getRandomIP())
            .set('Authorization', `Bearer ${accessToken}`)
            .send({
                rating: 'happy',
                feedback: 'Everything works smoothly!',
            })

        expect(res.status).toBe(200)
        expect(res.body.data.id).toBeDefined()

        const fb = await prisma.feedback.findFirst({ where: { userId: testUserId } })
        expect(fb).not.toBeNull()
        expect(fb?.rating).toBe('happy')
        expect(fb?.feedback).toBe('Everything works smoothly!')
    })
})
