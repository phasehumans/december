import '../../../tests/env'

import bcrypt from 'bcrypt'
import { describe, it, expect, beforeAll, beforeEach, afterAll, mock } from 'bun:test'
import path from 'path'
import express from 'express'
import { Router } from 'express'
import request from 'supertest'

import { prisma } from '../../../src/config/db'
import { GenerationSound } from '../../../src/modules/profile/profile.schema'

const TEST_USER_ID = 'test-user-id'
const TEST_SESSION_ID = 'test-session-id'

const createTestUser = async (overrides: Record<string, unknown> = {}) => {
    return prisma.user.create({
        data: {
            id: TEST_USER_ID,
            email: `test-${crypto.randomUUID()}@example.com`,
            name: 'Chaitanya Sonawane',
            username: `user_${crypto.randomUUID().slice(0, 12)}`,
            password: await bcrypt.hash('Password123', 10),
            isDeleted: false,
            notifyProductUpdates: false,
            notifyProjectActivity: false,
            notifySecurityAlerts: false,
            chatSuggestions: false,
            generationSound: GenerationSound.NEVER,
            githubConnected: false,
            ...overrides,
        },
    })
}

const createTestSession = async (overrides: Record<string, unknown> = {}) => {
    return prisma.session.create({
        data: {
            id: TEST_SESSION_ID,
            userId: TEST_USER_ID,
            refreshTokenHash: `hash-${crypto.randomUUID()}`,
            expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24),
            isRevoked: false,
            ...overrides,
        },
    })
}

describe('profile.routes.integration', () => {
    let app: express.Application

    beforeAll(async () => {
        const authMiddlewarePath = path.resolve(
            import.meta.dir,
            '../../../src/middleware/auth.middleware'
        )
        mock.module(authMiddlewarePath, () => ({
            authMiddleware: (req: any, _res: any, next: any) => {
                req.user = { userId: TEST_USER_ID, sessionId: TEST_SESSION_ID }
                next()
            },
        }))

        const profileRouter = (await import('../../../src/modules/profile/profile.routes')).default

        app = express()
        app.use(express.json())
        app.use('/api/v1/profile', profileRouter)
    })

    beforeEach(async () => {
        await prisma.session.deleteMany()
        await prisma.user.deleteMany()

        await createTestUser()
        await createTestSession()
    })

    afterAll(async () => {
        await prisma.$disconnect()
    })

    describe('GET /info', () => {
        it('should return 200 with fullName', async () => {
            const res = await request(app).get('/api/v1/profile/info')

            expect(res.status).toBe(200)
            expect(res.body.success).toBe(true)
            expect(res.body.data.fullName).toBe('Chaitanya Sonawane')
        })
    })

    describe('GET /card', () => {
        it('should return 200 with profile card data', async () => {
            const res = await request(app).get('/api/v1/profile/card')

            expect(res.status).toBe(200)
            expect(res.body.success).toBe(true)
        })
    })

    describe('GET /', () => {
        it('should return 200 with full profile', async () => {
            const res = await request(app).get('/api/v1/profile')

            expect(res.status).toBe(200)
            expect(res.body.success).toBe(true)
            expect(res.body.data.id).toBe(TEST_USER_ID)
        })
    })

    describe('PATCH /name', () => {
        it('should return 200 on success', async () => {
            const res = await request(app).patch('/api/v1/profile/name').send({ name: 'New Name' })

            expect(res.status).toBe(200)
            expect(res.body.data.name).toBe('New Name')
        })

        it('should return 400 when name is missing', async () => {
            const res = await request(app).patch('/api/v1/profile/name').send({})

            expect(res.status).toBe(400)
        })

        it('should return 400 when name is too short', async () => {
            const res = await request(app).patch('/api/v1/profile/name').send({ name: 'ab' })

            expect(res.status).toBe(400)
        })

        it('should return 400 when name is too long', async () => {
            const res = await request(app)
                .patch('/api/v1/profile/name')
                .send({ name: 'a'.repeat(21) })

            expect(res.status).toBe(400)
        })

        it('should persist name in database', async () => {
            await request(app).patch('/api/v1/profile/name').send({ name: 'Persisted' })

            const db = await prisma.user.findUnique({ where: { id: TEST_USER_ID } })
            expect(db!.name).toBe('Persisted')
        })
    })

    describe('PATCH /username', () => {
        it('should return 200 on success', async () => {
            const res = await request(app)
                .patch('/api/v1/profile/username')
                .send({ username: 'newuser' })

            expect(res.status).toBe(200)
        })

        it('should return 409 on duplicate username', async () => {
            await prisma.user.create({
                data: {
                    id: 'user-2',
                    name: 'Other',
                    email: `other-${crypto.randomUUID()}@example.com`,
                    username: 'takenuser',
                    password: 'pw',
                },
            })

            const res = await request(app)
                .patch('/api/v1/profile/username')
                .send({ username: 'takenuser' })

            expect(res.status).toBe(409)
        })

        it('should return 400 on same username', async () => {
            const user = await prisma.user.findUnique({ where: { id: TEST_USER_ID } })

            const res = await request(app)
                .patch('/api/v1/profile/username')
                .send({ username: user!.username })

            expect(res.status).toBe(400)
        })

        it('should return 400 for too short username', async () => {
            const res = await request(app)
                .patch('/api/v1/profile/username')
                .send({ username: 'ab' })

            expect(res.status).toBe(400)
        })

        it('should return 400 for username with uppercase', async () => {
            const res = await request(app)
                .patch('/api/v1/profile/username')
                .send({ username: 'UpperCase' })

            expect(res.status).toBe(400)
        })

        it('should return 400 when username is missing', async () => {
            const res = await request(app).patch('/api/v1/profile/username').send({})

            expect(res.status).toBe(400)
        })
    })

    describe('PATCH /password', () => {
        it('should return 200 on success', async () => {
            const res = await request(app)
                .patch('/api/v1/profile/password')
                .send({ currentPassword: 'Password123', newPassword: 'newPass123' })

            expect(res.status).toBe(200)
        })

        it('should return 400 for short password', async () => {
            const res = await request(app)
                .patch('/api/v1/profile/password')
                .send({ currentPassword: 'Password123', newPassword: '123' })

            expect(res.status).toBe(400)
        })

        it('should return 400 for long password', async () => {
            const res = await request(app)
                .patch('/api/v1/profile/password')
                .send({ currentPassword: 'Password123', newPassword: 'a'.repeat(21) })

            expect(res.status).toBe(400)
        })

        it('should return 400 when password is missing', async () => {
            const res = await request(app).patch('/api/v1/profile/password').send({})

            expect(res.status).toBe(400)
        })

        it('should return 401 when current password is incorrect', async () => {
            const res = await request(app)
                .patch('/api/v1/profile/password')
                .send({ currentPassword: 'Wrong123', newPassword: 'newPass123' })

            expect(res.status).toBe(401)
        })
    })

    describe('PATCH /notifications', () => {
        it('should return 200 on single field update', async () => {
            const res = await request(app)
                .patch('/api/v1/profile/notifications')
                .send({ notifyProductUpdates: true })

            expect(res.status).toBe(200)
            expect(res.body.data.notifyProductUpdates).toBe(true)
        })

        it('should return 200 on multiple field update', async () => {
            const res = await request(app)
                .patch('/api/v1/profile/notifications')
                .send({ notifyProductUpdates: true, notifySecurityAlerts: true })

            expect(res.status).toBe(200)
            expect(res.body.data.notifyProductUpdates).toBe(true)
            expect(res.body.data.notifySecurityAlerts).toBe(true)
        })

        it('should return 400 when empty body', async () => {
            const res = await request(app).patch('/api/v1/profile/notifications').send({})

            expect(res.status).toBe(400)
        })

        it('should return 400 when field is string instead of boolean', async () => {
            const res = await request(app)
                .patch('/api/v1/profile/notifications')
                .send({ notifyProductUpdates: 'true' })

            expect(res.status).toBe(400)
        })
    })

    describe('POST /suggestions', () => {
        it('should return 200 on success', async () => {
            const res = await request(app)
                .post('/api/v1/profile/suggestions')
                .send({ chatSuggestions: true })

            expect(res.status).toBe(200)
        })

        it('should return 400 on same value', async () => {
            const res = await request(app)
                .post('/api/v1/profile/suggestions')
                .send({ chatSuggestions: false })

            expect(res.status).toBe(400)
        })

        it('should return 400 when field is missing', async () => {
            const res = await request(app).post('/api/v1/profile/suggestions').send({})

            expect(res.status).toBe(400)
        })

        it('should return 400 when field is string', async () => {
            const res = await request(app)
                .post('/api/v1/profile/suggestions')
                .send({ chatSuggestions: 'true' })

            expect(res.status).toBe(400)
        })
    })

    describe('POST /sound', () => {
        it('should return 200 on success', async () => {
            const res = await request(app)
                .post('/api/v1/profile/sound')
                .send({ generationSound: GenerationSound.ALWAYS })

            expect(res.status).toBe(200)
        })

        it('should return 400 on same value', async () => {
            const res = await request(app)
                .post('/api/v1/profile/sound')
                .send({ generationSound: GenerationSound.NEVER })

            expect(res.status).toBe(400)
        })

        it('should return 400 for invalid enum value', async () => {
            const res = await request(app)
                .post('/api/v1/profile/sound')
                .send({ generationSound: 'INVALID' })

            expect(res.status).toBe(400)
        })

        it('should return 400 when field is missing', async () => {
            const res = await request(app).post('/api/v1/profile/sound').send({})

            expect(res.status).toBe(400)
        })
    })

    describe('POST /signout', () => {
        it('should return 200 and revoke session', async () => {
            const res = await request(app).post('/api/v1/profile/signout')

            expect(res.status).toBe(200)

            const session = await prisma.session.findUnique({ where: { id: TEST_SESSION_ID } })
            expect(session?.isRevoked).toBe(true)
        })

        it('should return 200 even if session already revoked', async () => {
            await prisma.session.update({
                where: { id: TEST_SESSION_ID },
                data: { isRevoked: true, revokedAt: new Date() },
            })

            const res = await request(app).post('/api/v1/profile/signout')

            expect(res.status).toBe(200)
        })
    })

    describe('POST /signout/all', () => {
        it('should return 200 and revoke all sessions', async () => {
            await prisma.session.create({
                data: {
                    id: 'session-2',
                    userId: TEST_USER_ID,
                    refreshTokenHash: 'test-hash-2',
                    expiresAt: new Date(Date.now() + 100000),
                    isRevoked: false,
                },
            })

            const res = await request(app).post('/api/v1/profile/signout/all')

            expect(res.status).toBe(200)

            const sessions = await prisma.session.findMany({ where: { userId: TEST_USER_ID } })
            expect(sessions.every((s) => s.isRevoked)).toBe(true)
        })
    })

    describe('DELETE /', () => {
        it('should return 200 and soft-delete user', async () => {
            const res = await request(app).delete('/api/v1/profile')

            expect(res.status).toBe(200)

            const user = await prisma.user.findUnique({ where: { id: TEST_USER_ID } })
            expect(user?.isDeleted).toBe(true)
            expect(user?.deletedAt).toBeTruthy()
        })

        it('should return 409 when already deleted', async () => {
            await request(app).delete('/api/v1/profile')

            const res = await request(app).delete('/api/v1/profile')

            expect(res.status).toBe(409)
        })

        it('should revoke all sessions on delete', async () => {
            await request(app).delete('/api/v1/profile')

            const sessions = await prisma.session.findMany({ where: { userId: TEST_USER_ID } })
            expect(sessions.every((s) => s.isRevoked)).toBe(true)
        })
    })

    describe('POST /feedback', () => {
        it('should return 200 on successful feedback submission', async () => {
            const res = await request(app)
                .post('/api/v1/profile/feedback')
                .send({ rating: 'happy', feedback: 'Great job!' })

            expect(res.status).toBe(200)
            expect(res.body.success).toBe(true)
            expect(res.body.message).toBe('Feedback submitted successfully')

            // Verify db has the feedback
            const dbFeedback = await prisma.feedback.findFirst({
                where: { userId: TEST_USER_ID },
            })
            expect(dbFeedback).not.toBeNull()
            expect(dbFeedback?.feedback).toBe('Great job!')
            expect(dbFeedback?.rating).toBe('happy')
        })

        it('should return 400 when feedback content is missing', async () => {
            const res = await request(app)
                .post('/api/v1/profile/feedback')
                .send({ rating: 'happy' })

            expect(res.status).toBe(400)
            expect(res.body.success).toBe(false)
            expect(res.body.errors.feedback).toBeDefined()
        })
    })
})
