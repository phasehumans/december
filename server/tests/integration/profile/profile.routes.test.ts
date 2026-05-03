import '../../../tests/env'

import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'bun:test'

import request from 'supertest'
import express from 'express'
import { Router } from 'express'
import { prisma } from '../../../src/config/db'
import { profileController } from '../../../src/modules/profile/profile.controller'
import { GenerationSound } from '../../../src/modules/profile/profile.schema'

const TEST_USER_ID = 'test-user-id'
const TEST_SESSION_ID = 'test-session-id'

const createTestUser = async (overrides: Record<string, unknown> = {}) => {
    return prisma.user.create({
        data: {
            id: TEST_USER_ID,
            email: `test-${crypto.randomUUID()}@example.com`,
            name: 'Chaitanya Dev',
            username: `user_${crypto.randomUUID().slice(0, 12)}`,
            password: 'hashed-password',
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

    beforeAll(() => {
        app = express()
        app.use(express.json())
        app.use((req, _res, next) => {
            req.user = { userId: TEST_USER_ID, sessionId: TEST_SESSION_ID }
            next()
        })
        const testRouter = Router()
        testRouter.get('/github/connect', profileController.connectGithub)
        testRouter.get('/info', profileController.getInfo)
        testRouter.get('/card', profileController.getProfileCard)
        testRouter.get('/', profileController.getProfile)
        testRouter.patch('/name', profileController.updateName)
        testRouter.patch('/username', profileController.updateUsername)
        testRouter.patch('/password', profileController.changePassword)
        testRouter.patch('/notifications', profileController.updateNotifications)
        testRouter.post('/signout', profileController.signout)
        testRouter.post('/signout-all', profileController.signoutAll)
        testRouter.delete('/delete', profileController.deleteAccount)
        testRouter.patch('/chat-suggestions', profileController.chatSuggestions)
        testRouter.patch('/generation-sound', profileController.generationSound)
        app.use('/api/v1/profile', testRouter)
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
        it('should return 200 with firstName', async () => {
            const res = await request(app).get('/api/v1/profile/info')

            expect(res.status).toBe(200)
            expect(res.body.success).toBe(true)
            expect(res.body.data.firstName).toBe('Chaitanya')
        })

        it('should return 404 for soft-deleted user', async () => {
            await prisma.user.update({ where: { id: TEST_USER_ID }, data: { isDeleted: true } })

            const res = await request(app).get('/api/v1/profile/info')

            expect(res.status).toBe(404)
            expect(res.body.success).toBe(false)
        })
    })

    describe('GET /card', () => {
        it('should return 200 with profile card data', async () => {
            const res = await request(app).get('/api/v1/profile/card')

            expect(res.status).toBe(200)
            expect(res.body.success).toBe(true)
        })

        it('should return 404 for soft-deleted user', async () => {
            await prisma.user.update({ where: { id: TEST_USER_ID }, data: { isDeleted: true } })

            const res = await request(app).get('/api/v1/profile/card')

            expect(res.status).toBe(404)
        })
    })

    describe('GET /', () => {
        it('should return 200 with full profile', async () => {
            const res = await request(app).get('/api/v1/profile')

            expect(res.status).toBe(200)
            expect(res.body.success).toBe(true)
            expect(res.body.data.id).toBe(TEST_USER_ID)
        })

        it('should return 404 for soft-deleted user', async () => {
            await prisma.user.update({ where: { id: TEST_USER_ID }, data: { isDeleted: true } })

            const res = await request(app).get('/api/v1/profile')

            expect(res.status).toBe(404)
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
                .send({ password: 'newPass123' })

            expect(res.status).toBe(200)
        })

        it('should return 400 for short password', async () => {
            const res = await request(app)
                .patch('/api/v1/profile/password')
                .send({ password: '123' })

            expect(res.status).toBe(400)
        })

        it('should return 400 for long password', async () => {
            const res = await request(app)
                .patch('/api/v1/profile/password')
                .send({ password: 'a'.repeat(21) })

            expect(res.status).toBe(400)
        })

        it('should return 400 when password is missing', async () => {
            const res = await request(app).patch('/api/v1/profile/password').send({})

            expect(res.status).toBe(400)
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

    describe('PATCH /chat-suggestions', () => {
        it('should return 200 on success', async () => {
            const res = await request(app)
                .patch('/api/v1/profile/chat-suggestions')
                .send({ chatSuggestions: true })

            expect(res.status).toBe(200)
        })

        it('should return 400 on same value', async () => {
            const res = await request(app)
                .patch('/api/v1/profile/chat-suggestions')
                .send({ chatSuggestions: false })

            expect(res.status).toBe(400)
        })

        it('should return 400 when field is missing', async () => {
            const res = await request(app).patch('/api/v1/profile/chat-suggestions').send({})

            expect(res.status).toBe(400)
        })

        it('should return 400 when field is string', async () => {
            const res = await request(app)
                .patch('/api/v1/profile/chat-suggestions')
                .send({ chatSuggestions: 'true' })

            expect(res.status).toBe(400)
        })
    })

    describe('PATCH /generation-sound', () => {
        it('should return 200 on success', async () => {
            const res = await request(app)
                .patch('/api/v1/profile/generation-sound')
                .send({ generationSound: GenerationSound.ALWAYS })

            expect(res.status).toBe(200)
        })

        it('should return 400 on same value', async () => {
            const res = await request(app)
                .patch('/api/v1/profile/generation-sound')
                .send({ generationSound: GenerationSound.NEVER })

            expect(res.status).toBe(400)
        })

        it('should return 400 for invalid enum value', async () => {
            const res = await request(app)
                .patch('/api/v1/profile/generation-sound')
                .send({ generationSound: 'INVALID' })

            expect(res.status).toBe(400)
        })

        it('should return 400 when field is missing', async () => {
            const res = await request(app).patch('/api/v1/profile/generation-sound').send({})

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

    describe('POST /signout-all', () => {
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

            const res = await request(app).post('/api/v1/profile/signout-all')

            expect(res.status).toBe(200)

            const sessions = await prisma.session.findMany({ where: { userId: TEST_USER_ID } })
            expect(sessions.every((s) => s.isRevoked)).toBe(true)
        })
    })

    describe('DELETE /delete', () => {
        it('should return 200 and soft-delete user', async () => {
            const res = await request(app).delete('/api/v1/profile/delete')

            expect(res.status).toBe(200)

            const user = await prisma.user.findUnique({ where: { id: TEST_USER_ID } })
            expect(user?.isDeleted).toBe(true)
            expect(user?.deletedAt).toBeTruthy()
        })

        it('should return 409 when already deleted', async () => {
            await request(app).delete('/api/v1/profile/delete')

            const res = await request(app).delete('/api/v1/profile/delete')

            expect(res.status).toBe(409)
        })

        it('should revoke all sessions on delete', async () => {
            await request(app).delete('/api/v1/profile/delete')

            const sessions = await prisma.session.findMany({ where: { userId: TEST_USER_ID } })
            expect(sessions.every((s) => s.isRevoked)).toBe(true)
        })
    })
})
