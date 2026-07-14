import '../../env'

import crypto from 'crypto'

import { prisma } from '@december/database'
import { afterAll, beforeAll, beforeEach, describe, expect, it, mock } from 'bun:test'
import express, { Router } from 'express'
import request from 'supertest'

mock.module('../../../src/modules/profile/profile.service', () => ({
    profileService: {
        getInfo: async () => ({ fullName: 'Route User', isGithubConnected: true }),
        getProfileCard: async () => ({ id: '1', name: 'Route User', username: 'route_user' }),
        getProfile: async () => ({ id: '1', name: 'Route User', hasPassword: true }),
        updateName: async () => ({ name: 'New Name' }),
        updateUsername: async () => ({ username: 'new_username' }),
        updateAvatarUrl: async () => ({ avatarUrl: 'https://example.com/avatar.png' }),
        changePassword: async () => ({ success: true }),
        updateNotifications: async () => ({ notifyProjectActivity: true }),
        signout: async () => {},
        signoutAll: async () => {},
        deleteAccount: async () => {},
        chatSuggestions: async () => ({ chatSuggestions: true }),
        generationSound: async () => ({ generationSound: 'NEVER' }),
        getdesign: async () => ({ design: 'Sleek UI' }),
        updatedesign: async () => ({ design: 'New Design' }),
        deletedesign: async () => {},
        completeOnboarding: async () => ({ id: '1', hasCompletedOnboarding: true }),
        createFeedback: async () => ({ id: '1', feedback: 'Great' }),
    },
}))

import { errorHandler } from '../../../src/middleware/error.middleware'
import { profileController } from '../../../src/modules/profile/profile.controller'

const TEST_USER_ID = 'test-profile-user-id'
const TEST_SESSION_ID = 'test-profile-session-id'

const createTestUser = async (overrides: Record<string, unknown> = {}) => {
    return prisma.user.create({
        data: {
            id: TEST_USER_ID,
            name: 'Profile Route User',
            email: `profile-route-${crypto.randomUUID()}@example.com`,
            username: `profile-route-${crypto.randomUUID()}`,
            password: 'hashed-password',
            emailVerified: true,
            isDeleted: false,
            ...overrides,
        },
    })
}

describe('profile.routes.integration', () => {
    let app: express.Application
    let isCleaningUp = false

    beforeAll(() => {
        app = express()
        app.use(express.json())

        const profileRouter = Router()

        profileRouter.use((req, _res, next) => {
            if (req.headers['x-no-auth']) {
                req.user = undefined
            } else {
                req.user = { userId: TEST_USER_ID, sessionId: TEST_SESSION_ID }
            }
            next()
        })

        profileRouter.get('/info', profileController.getInfo)
        profileRouter.get('/card', profileController.getProfileCard)
        profileRouter.get('/', profileController.getProfile)
        profileRouter.patch('/name', profileController.updateName)
        profileRouter.patch('/username', profileController.updateUsername)
        profileRouter.patch('/avatar', profileController.updateAvatarUrl)
        profileRouter.patch('/password', profileController.changePassword)
        profileRouter.patch('/notifications', profileController.updateNotifications)
        profileRouter.patch('/onboarding', profileController.completeOnboarding)
        profileRouter.post('/signout', profileController.signout)
        profileRouter.post('/signout/all', profileController.signoutAll)
        profileRouter.delete('/', profileController.deleteAccount)

        profileRouter.post('/suggestions', profileController.chatSuggestions)
        profileRouter.post('/sound', profileController.generationSound)
        profileRouter.get('/design', profileController.getdesign)
        profileRouter.post('/design', profileController.updatedesign)
        profileRouter.delete('/design', profileController.deletedesign)

        profileRouter.post('/feedback', profileController.submitFeedback)

        app.use('/api/v1/profile', profileRouter)
        app.use(errorHandler)
    })

    beforeEach(async () => {
        if (isCleaningUp) return

        await prisma.feedback.deleteMany({ where: { userId: TEST_USER_ID } })
        await prisma.authSession.deleteMany({ where: { userId: TEST_USER_ID } })
        await prisma.user.deleteMany({ where: { id: TEST_USER_ID } })

        await createTestUser()
    })

    afterAll(async () => {
        isCleaningUp = true
        await prisma.$disconnect()
    }, 15000)

    describe('GET /info', () => {
        it('should get user info successfully (200)', async () => {
            const res = await request(app).get('/api/v1/profile/info')
            expect(res.status).toBe(200)
            expect(res.body.success).toBe(true)
            expect(res.body.data.fullName).toBe('Route User')
        })

        it('should return 401 if unauthorized', async () => {
            const res = await request(app).get('/api/v1/profile/info').set('x-no-auth', 'true')
            expect(res.status).toBe(401)
        })
    })

    describe('GET /card', () => {
        it('should get profile card successfully (200)', async () => {
            const res = await request(app).get('/api/v1/profile/card')
            expect(res.status).toBe(200)
            expect(res.body.success).toBe(true)
            expect(res.body.data.username).toBe('route_user')
        })

        it('should return 401 if unauthorized', async () => {
            const res = await request(app).get('/api/v1/profile/card').set('x-no-auth', 'true')
            expect(res.status).toBe(401)
        })
    })

    describe('GET /', () => {
        it('should get full profile successfully (200)', async () => {
            const res = await request(app).get('/api/v1/profile')
            expect(res.status).toBe(200)
            expect(res.body.success).toBe(true)
            expect(res.body.data.hasPassword).toBe(true)
        })

        it('should return 401 if unauthorized', async () => {
            const res = await request(app).get('/api/v1/profile').set('x-no-auth', 'true')
            expect(res.status).toBe(401)
        })
    })

    describe('PATCH /name', () => {
        it('should update name successfully (200)', async () => {
            const res = await request(app).patch('/api/v1/profile/name').send({ name: 'ValidName' })
            expect(res.status).toBe(200)
            expect(res.body.success).toBe(true)
        })

        it('should return 400 if name is invalid', async () => {
            const res = await request(app).patch('/api/v1/profile/name').send({ name: 'Al' })
            expect(res.status).toBe(400)
        })

        it('should return 401 if unauthorized', async () => {
            const res = await request(app)
                .patch('/api/v1/profile/name')
                .set('x-no-auth', 'true')
                .send({ name: 'ValidName' })
            expect(res.status).toBe(401)
        })
    })

    describe('PATCH /username', () => {
        it('should update username successfully (200)', async () => {
            const res = await request(app)
                .patch('/api/v1/profile/username')
                .send({ username: 'valid_user' })
            expect(res.status).toBe(200)
            expect(res.body.success).toBe(true)
        })

        it('should return 400 if username is invalid', async () => {
            const res = await request(app)
                .patch('/api/v1/profile/username')
                .send({ username: 'Invalid User!' })
            expect(res.status).toBe(400)
        })

        it('should return 401 if unauthorized', async () => {
            const res = await request(app)
                .patch('/api/v1/profile/username')
                .set('x-no-auth', 'true')
                .send({ username: 'valid_user' })
            expect(res.status).toBe(401)
        })
    })

    describe('PATCH /avatar', () => {
        it('should update avatar successfully (200)', async () => {
            const res = await request(app)
                .patch('/api/v1/profile/avatar')
                .send({ avatarUrl: 'https://example.com/image.png' })
            expect(res.status).toBe(200)
            expect(res.body.success).toBe(true)
        })

        it('should return 400 if avatar URL is invalid', async () => {
            const res = await request(app)
                .patch('/api/v1/profile/avatar')
                .send({ avatarUrl: 'not-a-url' })
            expect(res.status).toBe(400)
        })

        it('should return 401 if unauthorized', async () => {
            const res = await request(app)
                .patch('/api/v1/profile/avatar')
                .set('x-no-auth', 'true')
                .send({ avatarUrl: 'https://example.com/image.png' })
            expect(res.status).toBe(401)
        })
    })

    describe('PATCH /password', () => {
        it('should change password successfully (200)', async () => {
            const res = await request(app)
                .patch('/api/v1/profile/password')
                .send({ currentPassword: 'old_password', newPassword: 'new_password' })
            expect(res.status).toBe(200)
            expect(res.body.success).toBe(true)
        })

        it('should return 400 if new password is too short', async () => {
            const res = await request(app)
                .patch('/api/v1/profile/password')
                .send({ currentPassword: 'old_password', newPassword: 'short' })
            expect(res.status).toBe(400)
        })

        it('should return 401 if unauthorized', async () => {
            const res = await request(app)
                .patch('/api/v1/profile/password')
                .set('x-no-auth', 'true')
                .send({ currentPassword: 'old_password', newPassword: 'new_password' })
            expect(res.status).toBe(401)
        })
    })

    describe('PATCH /notifications', () => {
        it('should update notifications successfully (200)', async () => {
            const res = await request(app)
                .patch('/api/v1/profile/notifications')
                .send({ notifyProjectActivity: true })
            expect(res.status).toBe(200)
            expect(res.body.success).toBe(true)
        })

        it('should return 401 if unauthorized', async () => {
            const res = await request(app)
                .patch('/api/v1/profile/notifications')
                .set('x-no-auth', 'true')
                .send({ notifyProjectActivity: true })
            expect(res.status).toBe(401)
        })
    })

    describe('PATCH /onboarding', () => {
        it('should complete onboarding successfully (200)', async () => {
            const res = await request(app).patch('/api/v1/profile/onboarding')
            expect(res.status).toBe(200)
            expect(res.body.success).toBe(true)
        })

        it('should return 401 if unauthorized', async () => {
            const res = await request(app)
                .patch('/api/v1/profile/onboarding')
                .set('x-no-auth', 'true')
            expect(res.status).toBe(401)
        })
    })

    describe('POST /signout', () => {
        it('should signout successfully (200)', async () => {
            const res = await request(app).post('/api/v1/profile/signout')
            expect(res.status).toBe(200)
            expect(res.body.success).toBe(true)
        })

        it('should return 401 if unauthorized', async () => {
            const res = await request(app).post('/api/v1/profile/signout').set('x-no-auth', 'true')
            expect(res.status).toBe(401)
        })
    })

    describe('POST /signout/all', () => {
        it('should signout from all devices successfully (200)', async () => {
            const res = await request(app).post('/api/v1/profile/signout/all')
            expect(res.status).toBe(200)
            expect(res.body.success).toBe(true)
        })

        it('should return 401 if unauthorized', async () => {
            const res = await request(app)
                .post('/api/v1/profile/signout/all')
                .set('x-no-auth', 'true')
            expect(res.status).toBe(401)
        })
    })

    describe('DELETE /', () => {
        it('should delete account successfully (200)', async () => {
            const res = await request(app).delete('/api/v1/profile')
            expect(res.status).toBe(200)
            expect(res.body.success).toBe(true)
        })

        it('should return 401 if unauthorized', async () => {
            const res = await request(app).delete('/api/v1/profile').set('x-no-auth', 'true')
            expect(res.status).toBe(401)
        })
    })

    describe('POST /suggestions', () => {
        it('should update chat suggestions successfully (200)', async () => {
            const res = await request(app)
                .post('/api/v1/profile/suggestions')
                .send({ chatSuggestions: true })
            expect(res.status).toBe(200)
            expect(res.body.success).toBe(true)
        })

        it('should return 400 if flag is not boolean', async () => {
            const res = await request(app)
                .post('/api/v1/profile/suggestions')
                .send({ chatSuggestions: 'true' })
            expect(res.status).toBe(400)
        })

        it('should return 401 if unauthorized', async () => {
            const res = await request(app)
                .post('/api/v1/profile/suggestions')
                .set('x-no-auth', 'true')
                .send({ chatSuggestions: true })
            expect(res.status).toBe(401)
        })
    })

    describe('POST /sound', () => {
        it('should update generation sound successfully (200)', async () => {
            const res = await request(app)
                .post('/api/v1/profile/sound')
                .send({ generationSound: 'ALWAYS' })
            expect(res.status).toBe(200)
            expect(res.body.success).toBe(true)
        })

        it('should return 400 if sound option is invalid', async () => {
            const res = await request(app)
                .post('/api/v1/profile/sound')
                .send({ generationSound: 'INVALID' })
            expect(res.status).toBe(400)
        })

        it('should return 401 if unauthorized', async () => {
            const res = await request(app)
                .post('/api/v1/profile/sound')
                .set('x-no-auth', 'true')
                .send({ generationSound: 'ALWAYS' })
            expect(res.status).toBe(401)
        })
    })

    describe('GET /design', () => {
        it('should get design successfully (200)', async () => {
            const res = await request(app).get('/api/v1/profile/design')
            expect(res.status).toBe(200)
            expect(res.body.success).toBe(true)
        })

        it('should return 401 if unauthorized', async () => {
            const res = await request(app).get('/api/v1/profile/design').set('x-no-auth', 'true')
            expect(res.status).toBe(401)
        })
    })

    describe('POST /design', () => {
        it('should update design successfully (200)', async () => {
            const res = await request(app)
                .post('/api/v1/profile/design')
                .send({ design: 'Dark Theme' })
            expect(res.status).toBe(200)
            expect(res.body.success).toBe(true)
        })

        it('should return 400 if design is missing', async () => {
            const res = await request(app).post('/api/v1/profile/design').send({})
            expect(res.status).toBe(400)
        })

        it('should return 401 if unauthorized', async () => {
            const res = await request(app)
                .post('/api/v1/profile/design')
                .set('x-no-auth', 'true')
                .send({ design: 'Dark Theme' })
            expect(res.status).toBe(401)
        })
    })

    describe('DELETE /design', () => {
        it('should delete design successfully (200)', async () => {
            const res = await request(app).delete('/api/v1/profile/design')
            expect(res.status).toBe(200)
            expect(res.body.success).toBe(true)
        })

        it('should return 401 if unauthorized', async () => {
            const res = await request(app).delete('/api/v1/profile/design').set('x-no-auth', 'true')
            expect(res.status).toBe(401)
        })
    })

    describe('POST /feedback', () => {
        it('should submit feedback successfully (200)', async () => {
            const res = await request(app)
                .post('/api/v1/profile/feedback')
                .send({ rating: 5, feedback: 'Amazing tool!' })
            expect(res.status).toBe(200)
            expect(res.body.success).toBe(true)
        })

        it('should return 400 if feedback string is empty', async () => {
            const res = await request(app)
                .post('/api/v1/profile/feedback')
                .send({ rating: 5, feedback: '' })
            expect(res.status).toBe(400)
        })

        it('should return 401 if unauthorized', async () => {
            const res = await request(app)
                .post('/api/v1/profile/feedback')
                .set('x-no-auth', 'true')
                .send({ rating: 5, feedback: 'Amazing tool!' })
            expect(res.status).toBe(401)
        })
    })
})
