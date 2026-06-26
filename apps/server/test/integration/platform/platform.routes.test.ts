import '../../env'

import crypto from 'crypto'
import { prisma } from '@december/database'
import { afterAll, beforeAll, beforeEach, describe, expect, it, mock } from 'bun:test'
import express, { Router } from 'express'
import request from 'supertest'

// Mock service layers to isolate controller and route testing
mock.module('../../../src/modules/platform/platform.service', () => ({
    platformService: {
        deployDecemberProject: async () => ({
            message: 'project deployed successfully to december local hosting',
            deploymentUrl: 'http://localhost',
        }),
        downloadProject: async () => ({ fileName: 'project.zip', zip: new Uint8Array([1, 2, 3]) }),
        getUserGithubRepos: async () => [{ id: 1, name: 'repo' }],
        createRepo: async () => ({ id: 'proj-1', githubRepoName: 'repo' }),
        updateRepo: async () => ({ commitSha: 'sha123' }),
        unlinkGithubRepo: async () => ({ message: 'github repository unlinked successfully' }),
        unlinkVercelProject: async () => ({ message: 'Vercel project unlinked successfully' }),
        syncEnvironmentVariables: async () => ({
            message: 'Environment variables synced successfully',
        }),
        deployVercelDirect: async () => ({
            id: 'dep-1',
            url: 'https://vercel.app',
            readyState: 'READY',
        }),
    },
}))

mock.module('../../../src/modules/platform/vercel.service', () => ({
    vercelService: {
        createProject: async () => ({ id: 'v-proj-1', name: 'v-proj' }),
        getDeploymentByCommit: async () => ({
            id: 'dep-1',
            url: 'https://vercel.app',
            readyState: 'READY',
        }),
        getDeploymentStatus: async () => ({
            id: 'dep-1',
            url: 'https://vercel.app',
            readyState: 'READY',
        }),
        streamBuildLogs: async ({ res }: any) => {
            res.write('build log')
            res.end()
        },
        cancelDeployment: async () => ({ id: 'dep-1', status: 'CANCELLED' }),
    },
}))

import { env } from '../../../src/env'
import { errorHandler } from '../../../src/middleware/error.middleware'
import { platformController } from '../../../src/modules/platform/platform.controller'

const TEST_USER_ID = 'test-platform-user-id'
const TEST_SESSION_ID = 'test-platform-session-id'

const createTestUser = async (overrides: Record<string, unknown> = {}) => {
    return prisma.user.create({
        data: {
            id: TEST_USER_ID,
            name: 'Platform Route User',
            email: `platform-route-${crypto.randomUUID()}@example.com`,
            username: `platform-route-${crypto.randomUUID()}`,
            password: 'hashed-password',
            emailVerified: true,
            isDeleted: false,
            ...overrides,
        },
    })
}

const createTestProject = async (overrides: Record<string, unknown> = {}) => {
    return prisma.project.create({
        data: {
            name: 'Platform Route Project',
            prompt: 'Test project prompt',
            userId: TEST_USER_ID,
            ...overrides,
        },
    })
}

describe('platform.routes.integration', () => {
    let app: express.Application
    let isCleaningUp = false
    let originalWebhookSecret: string | undefined

    beforeAll(() => {
        app = express()
        app.use(express.json())

        const platformRouter = Router()

        // Webhooks (unprotected)
        platformRouter.post('/vercel/webhook', platformController.handleVercelWebhook)

        // Mock authentication middleware
        platformRouter.use((req, _res, next) => {
            if (req.headers['x-no-auth']) {
                req.user = undefined
            } else {
                req.user = { userId: TEST_USER_ID, sessionId: TEST_SESSION_ID }
            }
            next()
        })

        // General
        platformRouter.get('/:projectId/download', platformController.downloadProject)
        platformRouter.post('/:projectId/december/deploy', platformController.deployDecemberProject)
        platformRouter.post('/:projectId/env/sync', platformController.syncEnvironmentVariables)

        // Vercel
        platformRouter.post('/:projectId/vercel/deploy', platformController.deployVercelProject)
        platformRouter.post('/:projectId/vercel/unlink', platformController.unlinkVercelProject)
        platformRouter.get('/:deploymentId/status', platformController.getVercelDeploymentStatus)
        platformRouter.get('/:deploymentId/logs', platformController.streamVercelBuildLogs)
        platformRouter.post('/:deploymentId/cancel', platformController.cancelVercelDeployment)

        // Github
        platformRouter.get('/github/repos', platformController.getUserGithubRepos)
        platformRouter.post('/projects/:projectId/github/repository', platformController.createRepo)
        platformRouter.post('/projects/:projectId/github/sync', platformController.updateRepo)
        platformRouter.post(
            '/projects/:projectId/github/unlink',
            platformController.unlinkGithubRepo
        )

        app.use('/api/v1/platform', platformRouter)
        app.use(errorHandler)

        originalWebhookSecret = env.VERCEL_WEBHOOK_SECRET
    })

    beforeEach(async () => {
        if (isCleaningUp) return

        env.VERCEL_WEBHOOK_SECRET = 'test_secret_key'

        await prisma.projectMemory.deleteMany({ where: { project: { userId: TEST_USER_ID } } })
        await prisma.projectVersion.deleteMany({ where: { project: { userId: TEST_USER_ID } } })
        await prisma.project.deleteMany({ where: { userId: TEST_USER_ID } })
        await prisma.session.deleteMany({ where: { userId: TEST_USER_ID } })
        await prisma.user.deleteMany({ where: { id: TEST_USER_ID } })

        await createTestUser()
    })

    afterAll(async () => {
        isCleaningUp = true
        env.VERCEL_WEBHOOK_SECRET = originalWebhookSecret as any
        await prisma.$disconnect()
    }, 15000)

    describe('POST /vercel/webhook', () => {
        it('should return 401 if signature is missing', async () => {
            const res = await request(app)
                .post('/api/v1/platform/vercel/webhook')
                .send({ type: 'test' })
            expect(res.status).toBe(401)
            expect(res.body.message).toBe('Missing Vercel signature')
        })

        it('should return 401 if signature is invalid', async () => {
            const res = await request(app)
                .post('/api/v1/platform/vercel/webhook')
                .set('x-vercel-signature', 'invalid_sig')
                .send({ type: 'test' })
            expect(res.status).toBe(401)
            expect(res.body.message).toBe('Invalid Vercel signature')
        })

        it('should process successfully with valid signature (200)', async () => {
            const payload = {
                type: 'deployment.succeeded',
                payload: { deployment: { url: 'https://test.app' }, projectId: 'proj1' },
            }
            const expectedSignature = crypto
                .createHmac('sha1', 'test_secret_key')
                .update(JSON.stringify(payload))
                .digest('hex')

            const res = await request(app)
                .post('/api/v1/platform/vercel/webhook')
                .set('x-vercel-signature', expectedSignature)
                .send(payload)
            expect(res.status).toBe(200)
            expect(res.text).toBe('Webhook processed successfully')
        })

        it('should return 200 with warning if secret is not configured', async () => {
            env.VERCEL_WEBHOOK_SECRET = '' as any
            const res = await request(app)
                .post('/api/v1/platform/vercel/webhook')
                .set('x-vercel-signature', 'any_sig')
                .send({ type: 'test' })
            expect(res.status).toBe(200)
            expect(res.text).toBe('Webhook received, but processing is disabled')
        })
    })

    describe('GET /:projectId/download', () => {
        it('should return zip file (200)', async () => {
            const project = await createTestProject()
            const res = await request(app).get(`/api/v1/platform/${project.id}/download`)
            expect(res.status).toBe(200)
            expect(res.header['content-type']).toBe('application/zip')
            expect(res.header['content-disposition']).toContain(
                'attachment; filename="project.zip"'
            )
        })

        it('should return 401 if unauthorized', async () => {
            const res = await request(app)
                .get('/api/v1/platform/proj-123/download')
                .set('x-no-auth', 'true')
            expect(res.status).toBe(401)
        })
    })

    describe('POST /:projectId/december/deploy', () => {
        it('should deploy december project successfully (200)', async () => {
            const project = await createTestProject()
            const res = await request(app).post(`/api/v1/platform/${project.id}/december/deploy`)
            expect(res.status).toBe(200)
            expect(res.body.success).toBe(true)
            expect(res.body.data.deploymentUrl).toBe('http://localhost')
        })

        it('should return 401 if unauthorized', async () => {
            const res = await request(app)
                .post('/api/v1/platform/proj-123/december/deploy')
                .set('x-no-auth', 'true')
            expect(res.status).toBe(401)
        })
    })

    describe('POST /:projectId/env/sync', () => {
        it('should sync env vars successfully (200)', async () => {
            const project = await createTestProject()
            const res = await request(app)
                .post(`/api/v1/platform/${project.id}/env/sync`)
                .send({ keys: ['API_KEY'] })
            expect(res.status).toBe(200)
            expect(res.body.success).toBe(true)
            expect(res.body.message).toBe('environment variables synced successfully')
        })

        it('should return 401 if unauthorized', async () => {
            const res = await request(app)
                .post('/api/v1/platform/proj-123/env/sync')
                .set('x-no-auth', 'true')
            expect(res.status).toBe(401)
        })
    })

    describe('POST /:projectId/vercel/deploy', () => {
        it('should return 401 if unauthorized', async () => {
            const res = await request(app)
                .post('/api/v1/platform/proj-123/vercel/deploy')
                .set('x-no-auth', 'true')
            expect(res.status).toBe(401)
        })

        it('should return 404 if project not found', async () => {
            const res = await request(app).post('/api/v1/platform/fake-id/vercel/deploy')
            expect(res.status).toBe(404)
            expect(res.body.message).toBe('project not found')
        })

        it('should create vercel project and deploy direct if not github linked (200)', async () => {
            const project = await createTestProject()
            const res = await request(app).post(`/api/v1/platform/${project.id}/vercel/deploy`)
            expect(res.status).toBe(200)
            expect(res.body.success).toBe(true)
            expect(res.body.message).toBe('direct deployment triggered on vercel successfully')
            expect(res.body.data.url).toBe('https://vercel.app')
        })

        it('should update repo and get deployment by commit if github linked (200)', async () => {
            const project = await createTestProject({
                githubRepoOwner: 'owner',
                githubRepoName: 'repo',
            })
            const res = await request(app).post(`/api/v1/platform/${project.id}/vercel/deploy`)
            expect(res.status).toBe(200)
            expect(res.body.success).toBe(true)
            expect(res.body.message).toBe('auto-deployment triggered on vercel successfully')
            expect(res.body.data.url).toBe('https://vercel.app')
        })
    })

    describe('POST /:projectId/vercel/unlink', () => {
        it('should unlink vercel project successfully (200)', async () => {
            const project = await createTestProject()
            const res = await request(app).post(`/api/v1/platform/${project.id}/vercel/unlink`)
            expect(res.status).toBe(200)
            expect(res.body.success).toBe(true)
            expect(res.body.message).toBe('vercel project unlinked successfully')
        })

        it('should return 401 if unauthorized', async () => {
            const res = await request(app)
                .post('/api/v1/platform/proj-123/vercel/unlink')
                .set('x-no-auth', 'true')
            expect(res.status).toBe(401)
        })
    })

    describe('GET /:deploymentId/status', () => {
        it('should get deployment status successfully (200)', async () => {
            const res = await request(app).get('/api/v1/platform/dep-123/status')
            expect(res.status).toBe(200)
            expect(res.body.success).toBe(true)
            expect(res.body.data.id).toBe('dep-1')
        })

        it('should return 401 if unauthorized', async () => {
            const res = await request(app)
                .get('/api/v1/platform/dep-123/status')
                .set('x-no-auth', 'true')
            expect(res.status).toBe(401)
        })
    })

    describe('GET /:deploymentId/logs', () => {
        it('should stream build logs successfully (200)', async () => {
            const res = await request(app).get('/api/v1/platform/dep-123/logs')
            expect(res.status).toBe(200)
            expect(res.text).toBe('build log')
        })

        it('should return 401 if unauthorized', async () => {
            const res = await request(app)
                .get('/api/v1/platform/dep-123/logs')
                .set('x-no-auth', 'true')
            expect(res.status).toBe(401)
        })
    })

    describe('POST /:deploymentId/cancel', () => {
        it('should cancel deployment successfully (200)', async () => {
            const res = await request(app).post('/api/v1/platform/dep-123/cancel')
            expect(res.status).toBe(200)
            expect(res.body.success).toBe(true)
            expect(res.body.data.status).toBe('CANCELLED')
        })

        it('should return 401 if unauthorized', async () => {
            const res = await request(app)
                .post('/api/v1/platform/dep-123/cancel')
                .set('x-no-auth', 'true')
            expect(res.status).toBe(401)
        })
    })

    describe('GET /github/repos', () => {
        it('should get user github repos successfully (200)', async () => {
            const res = await request(app).get('/api/v1/platform/github/repos')
            expect(res.status).toBe(200)
            expect(res.body.success).toBe(true)
            expect(res.body.data.length).toBe(1)
        })

        it('should return 401 if unauthorized', async () => {
            const res = await request(app)
                .get('/api/v1/platform/github/repos')
                .set('x-no-auth', 'true')
            expect(res.status).toBe(401)
        })
    })

    describe('POST /projects/:projectId/github/repository', () => {
        it('should create github repository successfully (200)', async () => {
            const res = await request(app)
                .post('/api/v1/platform/projects/proj-123/github/repository')
                .send({ name: 'new-repo', private: true })
            expect(res.status).toBe(200)
            expect(res.body.success).toBe(true)
            expect(res.body.data.githubRepoName).toBe('repo')
        })

        it('should return 400 if repository name is invalid', async () => {
            const res = await request(app)
                .post('/api/v1/platform/projects/proj-123/github/repository')
                .send({ name: 'invalid @ repo!' })
            expect(res.status).toBe(400)
        })

        it('should return 401 if unauthorized', async () => {
            const res = await request(app)
                .post('/api/v1/platform/projects/proj-123/github/repository')
                .set('x-no-auth', 'true')
                .send({ name: 'new-repo' })
            expect(res.status).toBe(401)
        })
    })

    describe('POST /projects/:projectId/github/sync', () => {
        it('should sync github repository successfully (200)', async () => {
            const res = await request(app)
                .post('/api/v1/platform/projects/proj-123/github/sync')
                .send({ commitMessage: 'Update' })
            expect(res.status).toBe(200)
            expect(res.body.success).toBe(true)
            expect(res.body.data.commitSha).toBe('sha123')
        })

        it('should return 401 if unauthorized', async () => {
            const res = await request(app)
                .post('/api/v1/platform/projects/proj-123/github/sync')
                .set('x-no-auth', 'true')
                .send({ commitMessage: 'Update' })
            expect(res.status).toBe(401)
        })
    })

    describe('POST /projects/:projectId/github/unlink', () => {
        it('should unlink github repository successfully (200)', async () => {
            const res = await request(app).post('/api/v1/platform/projects/proj-123/github/unlink')
            expect(res.status).toBe(200)
            expect(res.body.success).toBe(true)
            expect(res.body.message).toBe('github repository unlinked successfully')
        })

        it('should return 401 if unauthorized', async () => {
            const res = await request(app)
                .post('/api/v1/platform/projects/proj-123/github/unlink')
                .set('x-no-auth', 'true')
            expect(res.status).toBe(401)
        })
    })
})
