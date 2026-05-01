import '../../../tests/env'

import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'bun:test'

import request from 'supertest'
import express from 'express'
import { Router } from 'express'
import { prisma } from '../../../src/config/db'
import { profileController } from '../../../src/modules/profile/profile.controller'
import { GenerationSound } from '../../../src/modules/profile/profile.schema'

const createTestUser = async (overrides = {}) => {
    return prisma.user.create({
        data: {
            id: 'test-user-id',
            email: `test-${crypto.randomUUID()}@example.com`,
            name: 'Chaitanya Dev',
            username: `user-${crypto.randomUUID()}`,
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

const createTestSession = async (overrides = {}) => {
    return prisma.session.create({
        data: {
            id: 'test-session-id',
            userId: 'test-user-id',
            refreshTokenHash: 'test-hash',
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
        app.use((req, res, next) => {
            req.user = {
                userId: 'test-user-id',
                sessionId: 'test-session-id',
            }
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

    it('GET /info → success', async () => {
        const res = await request(app).get('/api/v1/profile/info')

        expect(res.status).toBe(200)
        expect(res.body.success).toBe(true)
        expect(res.body.data.firstName).toBe('Chaitanya')
    })

    it('PATCH /name → success', async () => {
        const res = await request(app).patch('/api/v1/profile/name').send({ name: 'New Name' })

        expect(res.status).toBe(200)
        expect(res.body.data.name).toBe('New Name')
    })

    it('PATCH /name → validation fail', async () => {
        const res = await request(app).patch('/api/v1/profile/name').send({})

        expect(res.status).toBe(400)
    })

    it('PATCH /username → success', async () => {
        const res = await request(app)
            .patch('/api/v1/profile/username')
            .send({ username: 'newuser' })

        expect(res.status).toBe(200)
    })

    it('PATCH /username → duplicate username', async () => {
        await createTestUser({
            id: 'user-2',
            username: 'takenuser',
        })

        const res = await request(app)
            .patch('/api/v1/profile/username')
            .send({ username: 'takenuser' })

        expect(res.status).toBe(409)
    })

    it('PATCH /password → success', async () => {
        const res = await request(app)
            .patch('/api/v1/profile/password')
            .send({ password: 'newPass123' })

        expect(res.status).toBe(200)
    })

    it('PATCH /notifications → success', async () => {
        const res = await request(app)
            .patch('/api/v1/profile/notifications')
            .send({ notifyProductUpdates: true })

        expect(res.status).toBe(200)
        expect(res.body.data.notifyProductUpdates).toBe(true)
    })

    it('PATCH /notifications → empty fail', async () => {
        const res = await request(app).patch('/api/v1/profile/notifications').send({})

        expect(res.status).toBe(400)
    })

    it('PATCH /chat-suggestions → success', async () => {
        const res = await request(app)
            .patch('/api/v1/profile/chat-suggestions')
            .send({ chatSuggestions: true })

        expect(res.status).toBe(200)
    })

    it('PATCH /generation-sound → success', async () => {
        const res = await request(app)
            .patch('/api/v1/profile/generation-sound')
            .send({ generationSound: GenerationSound.ALWAYS })

        expect(res.status).toBe(200)
    })

    it('POST /signout → revoke session', async () => {
        const res = await request(app).post('/api/v1/profile/signout')

        expect(res.status).toBe(200)

        const session = await prisma.session.findUnique({
            where: { id: 'test-session-id' },
        })

        expect(session?.isRevoked).toBe(true)
    })

    it('POST /signout-all → revoke all sessions', async () => {
        await prisma.session.create({
            data: {
                id: 'session-2',
                userId: 'test-user-id',
                refreshTokenHash: 'test-hash-2',
                expiresAt: new Date(Date.now() + 100000),
                isRevoked: false,
            },
        })

        const res = await request(app).post('/api/v1/profile/signout-all')

        expect(res.status).toBe(200)

        const sessions = await prisma.session.findMany({
            where: { userId: 'test-user-id' },
        })

        expect(sessions.every((s) => s.isRevoked)).toBe(true)
    })

    it('DELETE /delete → success', async () => {
        const res = await request(app).delete('/api/v1/profile/delete')

        expect(res.status).toBe(200)

        const user = await prisma.user.findUnique({
            where: { id: 'test-user-id' },
        })

        expect(user?.isDeleted).toBe(true)
    })

    it('DELETE /delete → already deleted', async () => {
        await request(app).delete('/api/v1/profile/delete')

        const res = await request(app).delete('/api/v1/profile/delete')

        expect(res.status).toBe(409)
    })
})
