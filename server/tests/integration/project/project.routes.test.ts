import '../../../tests/env'

import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'bun:test'
import express, { Router } from 'express'
import request from 'supertest'

import { prisma } from '../../../src/config/db'
import { projectController } from '../../../src/modules/project/project.controller'

const TEST_USER_ID = 'test-project-user-id'
const TEST_SESSION_ID = 'test-project-session-id'

const createTestUser = async (overrides: Record<string, unknown> = {}) => {
    return prisma.user.create({
        data: {
            id: TEST_USER_ID,
            name: 'Test User',
            email: `project-test-${crypto.randomUUID()}@example.com`,
            username: `project-user-${crypto.randomUUID()}`,
            password: 'hashed-password',
            emailVerified: true,
            isDeleted: false,
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

const createTestProject = async (
    userId = TEST_USER_ID,
    overrides: Record<string, unknown> = {}
) => {
    return prisma.project.create({
        data: {
            name: 'Test Project',
            prompt: 'Build a landing page',
            description: 'A valid project description',
            isStarred: false,
            userId,
            ...overrides,
        },
    })
}

describe('project.routes.integration', () => {
    let app: express.Application

    beforeAll(() => {
        app = express()
        app.use(express.json())

        // Inject fake auth user (bypass real auth middleware)
        app.use((req, _res, next) => {
            req.user = { userId: TEST_USER_ID, sessionId: TEST_SESSION_ID }
            next()
        })

        const testRouter = Router()
        testRouter.get('/', projectController.getAllProjects)
        testRouter.get('/:projectId', projectController.getProjectById)
        testRouter.post('/', projectController.createProject)
        testRouter.patch('/:projectId', projectController.renameProject)
        testRouter.delete('/:projectId', projectController.deleteProject)
        testRouter.post('/:projectId/duplicate', projectController.duplicateProject)
        testRouter.get('/:projectId/download', projectController.downloadProjectVersion)
        testRouter.post('/:projectId/share', projectController.shareProjectAsTemplate)
        testRouter.post('/:projectId/star', projectController.toggleStarProject)

        app.use('/api/v1/projects', testRouter)
    })

    beforeEach(async () => {
        await prisma.project.deleteMany()
        await prisma.session.deleteMany()
        await prisma.user.deleteMany()

        await createTestUser()
        await createTestSession()
    })

    afterAll(async () => {
        await prisma.$disconnect()
    })

    describe('GET /', () => {
        it('should return 200 and empty array when user has no projects', async () => {
            const res = await request(app).get('/api/v1/projects')

            expect(res.status).toBe(200)
            expect(res.body.success).toBe(true)
            expect(Array.isArray(res.body.data)).toBe(true)
            expect(res.body.data.length).toBe(0)
        })

        it('should return 200 and list of projects', async () => {
            await createTestProject()
            await createTestProject(TEST_USER_ID, { name: 'Second Project' })

            const res = await request(app).get('/api/v1/projects')

            expect(res.status).toBe(200)
            expect(res.body.success).toBe(true)
            expect(res.body.data.length).toBe(2)
        })

        it('should return 404 when user does not exist', async () => {
            // Create app with a non-existent user id injected
            const ghostApp = express()
            ghostApp.use(express.json())
            ghostApp.use((req, _res, next) => {
                req.user = { userId: 'ghost-user-id', sessionId: 'ghost-session' }
                next()
            })
            const ghostRouter = Router()
            ghostRouter.get('/', projectController.getAllProjects)
            ghostApp.use('/api/v1/projects', ghostRouter)

            const res = await request(ghostApp).get('/api/v1/projects')

            expect(res.status).toBe(404)
            expect(res.body.success).toBe(false)
        })

        it('should not return projects belonging to another user', async () => {
            const otherUser = await prisma.user.create({
                data: {
                    name: 'Other',
                    email: `other-${crypto.randomUUID()}@example.com`,
                    username: `other-${crypto.randomUUID()}`,
                    password: 'pw',
                },
            })
            await createTestProject(otherUser.id, { name: 'Other User Project' })
            await createTestProject(TEST_USER_ID, { name: 'My Project' })

            const res = await request(app).get('/api/v1/projects')

            expect(res.status).toBe(200)
            const names = res.body.data.map((p: any) => p.name)
            expect(names).not.toContain('Other User Project')
            expect(names).toContain('My Project')
        })
    })

    describe('GET /:projectId', () => {
        it('should return 200 and project data', async () => {
            const project = await createTestProject()

            const res = await request(app).get(`/api/v1/projects/${project.id}`)

            expect(res.status).toBe(200)
            expect(res.body.success).toBe(true)
            expect(res.body.data.project.id).toBe(project.id)
            expect(res.body.data.project.name).toBe('Test Project')
        })

        it('should return 200 with no versions when none created', async () => {
            const project = await createTestProject()

            const res = await request(app).get(`/api/v1/projects/${project.id}`)

            expect(res.status).toBe(200)
            expect(res.body.data.versions).toEqual([])
            expect(res.body.data.selectedVersionId).toBeNull()
            expect(res.body.data.activeVersion).toBeNull()
            expect(res.body.data.chatMessages).toEqual([])
        })

        it('should return 404 for non-existent project', async () => {
            const res = await request(app).get('/api/v1/projects/non-existent-project-id')

            expect(res.status).toBe(404)
            expect(res.body.success).toBe(false)
        })

        it('should return 400 for invalid versionId format', async () => {
            const project = await createTestProject()

            const res = await request(app).get(
                `/api/v1/projects/${project.id}?versionId=not-a-valid-uuid`
            )

            expect(res.status).toBe(400)
            expect(res.body.success).toBe(false)
        })

        it('should return 404 for valid but non-existent versionId', async () => {
            const project = await createTestProject()

            const res = await request(app).get(
                `/api/v1/projects/${project.id}?versionId=00000000-0000-0000-0000-000000000000`
            )

            // versionId specified but non-existent; service should throw 404
            expect(res.status).toBe(404)
            expect(res.body.success).toBe(false)
        })

        it('should return 404 when accessing another user project', async () => {
            const otherUser = await prisma.user.create({
                data: {
                    name: 'Other',
                    email: `other2-${crypto.randomUUID()}@example.com`,
                    username: `other2-${crypto.randomUUID()}`,
                    password: 'pw',
                },
            })
            const otherProject = await createTestProject(otherUser.id)

            const res = await request(app).get(`/api/v1/projects/${otherProject.id}`)

            expect(res.status).toBe(404)
            expect(res.body.success).toBe(false)
        })
    })

    describe('POST /', () => {
        it('should return 201 and created project on success', async () => {
            const res = await request(app).post('/api/v1/projects').send({
                name: 'New Project',
                prompt: 'Build a SaaS app',
            })

            expect(res.status).toBe(201)
            expect(res.body.success).toBe(true)
            expect(res.body.data.name).toBe('New Project')
            expect(res.body.data.prompt).toBe('Build a SaaS app')
            expect(res.body.data.userId).toBe(TEST_USER_ID)
        })

        it('should return 201 with optional description', async () => {
            const res = await request(app).post('/api/v1/projects').send({
                name: 'Desc Project',
                prompt: 'Build app',
                description: 'A valid description',
            })

            expect(res.status).toBe(201)
            expect(res.body.data.description).toBe('A valid description')
        })

        it('should return 400 when name is missing', async () => {
            const res = await request(app).post('/api/v1/projects').send({
                prompt: 'Build app',
            })

            expect(res.status).toBe(400)
            expect(res.body.success).toBe(false)
        })

        it('should return 400 when name is too short (< 3 chars)', async () => {
            const res = await request(app).post('/api/v1/projects').send({
                name: 'Hi',
                prompt: 'Build app',
            })

            expect(res.status).toBe(400)
            expect(res.body.success).toBe(false)
            expect(res.body.errors).toBeDefined()
        })

        it('should return 400 when name is too long (> 20 chars)', async () => {
            const res = await request(app)
                .post('/api/v1/projects')
                .send({
                    name: 'A'.repeat(21),
                    prompt: 'Build app',
                })

            expect(res.status).toBe(400)
            expect(res.body.success).toBe(false)
        })

        it('should return 400 when prompt is missing', async () => {
            const res = await request(app).post('/api/v1/projects').send({
                name: 'My Project',
            })

            expect(res.status).toBe(400)
            expect(res.body.success).toBe(false)
        })

        it('should return 400 when prompt is too short', async () => {
            const res = await request(app).post('/api/v1/projects').send({
                name: 'My Project',
                prompt: 'Hi',
            })

            expect(res.status).toBe(400)
        })

        it('should return 400 when description is too short (< 10 chars)', async () => {
            const res = await request(app).post('/api/v1/projects').send({
                name: 'My Project',
                prompt: 'Build app',
                description: 'short',
            })

            expect(res.status).toBe(400)
        })

        it('should return 400 when description is too long (> 30 chars)', async () => {
            const res = await request(app).post('/api/v1/projects').send({
                name: 'My Project',
                prompt: 'Build app',
                description: 'This description is way too long to be valid in schema',
            })

            expect(res.status).toBe(400)
        })

        it('should return 400 when body is completely empty', async () => {
            const res = await request(app).post('/api/v1/projects').send({})

            expect(res.status).toBe(400)
            expect(res.body.success).toBe(false)
        })

        it('should persist project to database after creation', async () => {
            const res = await request(app).post('/api/v1/projects').send({
                name: 'Persist Me',
                prompt: 'Build it now',
            })

            expect(res.status).toBe(201)
            const db = await prisma.project.findUnique({ where: { id: res.body.data.id } })
            expect(db).not.toBeNull()
            expect(db!.name).toBe('Persist Me')
        })
    })

    describe('PATCH /:projectId', () => {
        it('should return 200 on successful rename', async () => {
            const project = await createTestProject()

            const res = await request(app)
                .patch(`/api/v1/projects/${project.id}`)
                .send({ rename: 'Renamed Project' })

            expect(res.status).toBe(200)
            expect(res.body.success).toBe(true)
            expect(res.body.data.message).toBe('project updated')
        })

        it('should persist the renamed name to database', async () => {
            const project = await createTestProject()

            await request(app)
                .patch(`/api/v1/projects/${project.id}`)
                .send({ rename: 'DB Rename Test' })

            const db = await prisma.project.findUnique({ where: { id: project.id } })
            expect(db!.name).toBe('DB Rename Test')
        })

        it('should return 400 when rename field is missing', async () => {
            const project = await createTestProject()

            const res = await request(app).patch(`/api/v1/projects/${project.id}`).send({})

            expect(res.status).toBe(400)
            expect(res.body.success).toBe(false)
        })

        it('should return 404 for non-existent project', async () => {
            const res = await request(app)
                .patch('/api/v1/projects/non-existent-project')
                .send({ rename: 'Ghost' })

            expect(res.status).toBe(404)
            expect(res.body.success).toBe(false)
        })

        it("should return 404 when renaming another user's project", async () => {
            const otherUser = await prisma.user.create({
                data: {
                    name: 'Other',
                    email: `other3-${crypto.randomUUID()}@example.com`,
                    username: `other3-${crypto.randomUUID()}`,
                    password: 'pw',
                },
            })
            const otherProject = await createTestProject(otherUser.id)

            const res = await request(app)
                .patch(`/api/v1/projects/${otherProject.id}`)
                .send({ rename: 'Hijack' })

            expect(res.status).toBe(404)
        })
    })

    describe('DELETE /:projectId', () => {
        it('should return 200 on successful delete', async () => {
            const project = await createTestProject()

            const res = await request(app).delete(`/api/v1/projects/${project.id}`)

            expect(res.status).toBe(200)
            expect(res.body.success).toBe(true)
            expect(res.body.data.message).toBe('project deleted')
        })

        it('should remove the project from the database', async () => {
            const project = await createTestProject()

            await request(app).delete(`/api/v1/projects/${project.id}`)

            const db = await prisma.project.findUnique({ where: { id: project.id } })
            expect(db).toBeNull()
        })

        it('should return 404 for non-existent project', async () => {
            const res = await request(app).delete('/api/v1/projects/non-existent-project')

            expect(res.status).toBe(404)
            expect(res.body.success).toBe(false)
        })

        it("should return 404 when deleting another user's project", async () => {
            const otherUser = await prisma.user.create({
                data: {
                    name: 'Other',
                    email: `other4-${crypto.randomUUID()}@example.com`,
                    username: `other4-${crypto.randomUUID()}`,
                    password: 'pw',
                },
            })
            const otherProject = await createTestProject(otherUser.id)

            const res = await request(app).delete(`/api/v1/projects/${otherProject.id}`)

            expect(res.status).toBe(404)
        })

        it('should return 404 when trying to delete already deleted project', async () => {
            const project = await createTestProject()

            // First delete
            await request(app).delete(`/api/v1/projects/${project.id}`)

            // Second delete should 404
            const res = await request(app).delete(`/api/v1/projects/${project.id}`)

            expect(res.status).toBe(404)
        })
    })

    describe('POST /:projectId/duplicate', () => {
        it('should return 200 and duplicated project', async () => {
            const project = await createTestProject()

            const res = await request(app).post(`/api/v1/projects/${project.id}/duplicate`)

            expect(res.status).toBe(200)
            expect(res.body.success).toBe(true)
            expect(res.body.data.name).toBe('Copy of Test Project')
            expect(res.body.data.userId).toBe(TEST_USER_ID)
        })

        it('should create a new project in the database on duplicate', async () => {
            const project = await createTestProject()

            await request(app).post(`/api/v1/projects/${project.id}/duplicate`)

            const all = await prisma.project.findMany({ where: { userId: TEST_USER_ID } })
            expect(all.length).toBe(2)
        })

        it('should return 404 for non-existent project', async () => {
            const res = await request(app).post('/api/v1/projects/non-existent-project/duplicate')

            expect(res.status).toBe(404)
            expect(res.body.success).toBe(false)
        })

        it("should return 404 when duplicating another user's project", async () => {
            const otherUser = await prisma.user.create({
                data: {
                    name: 'Other',
                    email: `other5-${crypto.randomUUID()}@example.com`,
                    username: `other5-${crypto.randomUUID()}`,
                    password: 'pw',
                },
            })
            const otherProject = await createTestProject(otherUser.id)

            const res = await request(app).post(`/api/v1/projects/${otherProject.id}/duplicate`)

            expect(res.status).toBe(404)
        })

        it('should preserve original project after duplication', async () => {
            const project = await createTestProject()

            await request(app).post(`/api/v1/projects/${project.id}/duplicate`)

            const original = await prisma.project.findUnique({ where: { id: project.id } })
            expect(original).not.toBeNull()
            expect(original!.name).toBe('Test Project')
        })
    })

    describe('GET /:projectId/download', () => {
        it('should return 404 when no version exists for the project', async () => {
            const project = await createTestProject()

            const res = await request(app).get(`/api/v1/projects/${project.id}/download`)

            expect(res.status).toBe(404)
            expect(res.body.success).toBe(false)
        })

        it('should return 404 for non-existent project', async () => {
            const res = await request(app).get('/api/v1/projects/non-existent-project/download')

            expect(res.status).toBe(404)
        })

        it('should return 400 for invalid versionId query param', async () => {
            const project = await createTestProject()

            const res = await request(app).get(
                `/api/v1/projects/${project.id}/download?versionId=not-a-uuid`
            )

            expect(res.status).toBe(400)
        })
    })

    describe('POST /:projectId/share', () => {
        it('should return 200 and share project as template', async () => {
            const project = await createTestProject()

            const res = await request(app)
                .post(`/api/v1/projects/${project.id}/share`)
                .send({ isSharedAsTemplate: true })

            expect(res.status).toBe(200)
            expect(res.body.success).toBe(true)
            expect(res.body.data.message).toBe('project shared as template')
        })

        it('should return 200 and unshare project as template', async () => {
            const project = await createTestProject(TEST_USER_ID, { isSharedAsTemplate: true })

            const res = await request(app)
                .post(`/api/v1/projects/${project.id}/share`)
                .send({ isSharedAsTemplate: false })

            expect(res.status).toBe(200)
            expect(res.body.success).toBe(true)
            expect(res.body.data.message).toBe('project unshared as template')
        })

        it('should update isSharedAsTemplate in database', async () => {
            const project = await createTestProject()

            await request(app)
                .post(`/api/v1/projects/${project.id}/share`)
                .send({ isSharedAsTemplate: true })

            const db = await prisma.project.findUnique({ where: { id: project.id } })
            expect(db!.isSharedAsTemplate).toBe(true)
        })

        it('should return 400 when isSharedAsTemplate is missing', async () => {
            const project = await createTestProject()

            const res = await request(app).post(`/api/v1/projects/${project.id}/share`).send({})

            expect(res.status).toBe(400)
            expect(res.body.success).toBe(false)
        })

        it('should return 404 for non-existent project', async () => {
            const res = await request(app)
                .post('/api/v1/projects/non-existent-project/share')
                .send({ isSharedAsTemplate: true })

            expect(res.status).toBe(404)
            expect(res.body.success).toBe(false)
        })

        it("should return 404 when sharing another user's project", async () => {
            const otherUser = await prisma.user.create({
                data: {
                    name: 'Other',
                    email: `other6-${crypto.randomUUID()}@example.com`,
                    username: `other6-${crypto.randomUUID()}`,
                    password: 'pw',
                },
            })
            const otherProject = await createTestProject(otherUser.id)

            const res = await request(app)
                .post(`/api/v1/projects/${otherProject.id}/share`)
                .send({ isSharedAsTemplate: true })

            expect(res.status).toBe(404)
        })
    })

    describe('POST /:projectId/star', () => {
        it('should return 200 when starring a project (isStarred: true)', async () => {
            const project = await createTestProject()

            const res = await request(app)
                .post(`/api/v1/projects/${project.id}/star`)
                .send({ isStarred: true })

            expect(res.status).toBe(200)
            expect(res.body.success).toBe(true)
            expect(res.body.data.message).toBe('project isStarred state updated')
        })

        it('should return 200 when unstarring a project (isStarred: false)', async () => {
            const project = await createTestProject(TEST_USER_ID, { isStarred: true })

            const res = await request(app)
                .post(`/api/v1/projects/${project.id}/star`)
                .send({ isStarred: false })

            expect(res.status).toBe(200)
            expect(res.body.success).toBe(true)
        })

        it('should persist isStarred=true to database', async () => {
            const project = await createTestProject()

            await request(app).post(`/api/v1/projects/${project.id}/star`).send({ isStarred: true })

            const db = await prisma.project.findUnique({ where: { id: project.id } })
            expect(db!.isStarred).toBe(true)
        })

        it('should persist isStarred=false to database', async () => {
            const project = await createTestProject(TEST_USER_ID, { isStarred: true })

            await request(app)
                .post(`/api/v1/projects/${project.id}/star`)
                .send({ isStarred: false })

            const db = await prisma.project.findUnique({ where: { id: project.id } })
            expect(db!.isStarred).toBe(false)
        })

        it('should return 400 when isStarred is missing from body', async () => {
            const project = await createTestProject()

            const res = await request(app).post(`/api/v1/projects/${project.id}/star`).send({})

            expect(res.status).toBe(400)
            expect(res.body.success).toBe(false)
        })

        it('should return 400 when isStarred is a string', async () => {
            const project = await createTestProject()

            const res = await request(app)
                .post(`/api/v1/projects/${project.id}/star`)
                .send({ isStarred: 'true' })

            expect(res.status).toBe(400)
        })

        it('should return 400 when isStarred is a number', async () => {
            const project = await createTestProject()

            const res = await request(app)
                .post(`/api/v1/projects/${project.id}/star`)
                .send({ isStarred: 1 })

            expect(res.status).toBe(400)
        })

        it('should return 404 for non-existent project', async () => {
            const res = await request(app)
                .post('/api/v1/projects/non-existent-project/star')
                .send({ isStarred: true })

            expect(res.status).toBe(404)
            expect(res.body.success).toBe(false)
        })

        it("should return 404 when starring another user's project", async () => {
            const otherUser = await prisma.user.create({
                data: {
                    name: 'Other',
                    email: `other7-${crypto.randomUUID()}@example.com`,
                    username: `other7-${crypto.randomUUID()}`,
                    password: 'pw',
                },
            })
            const otherProject = await createTestProject(otherUser.id)

            const res = await request(app)
                .post(`/api/v1/projects/${otherProject.id}/star`)
                .send({ isStarred: true })

            expect(res.status).toBe(404)
        })

        it('should allow toggling star on and off consecutively', async () => {
            const project = await createTestProject()

            await request(app).post(`/api/v1/projects/${project.id}/star`).send({ isStarred: true })

            const res = await request(app)
                .post(`/api/v1/projects/${project.id}/star`)
                .send({ isStarred: false })

            expect(res.status).toBe(200)

            const db = await prisma.project.findUnique({ where: { id: project.id } })
            expect(db!.isStarred).toBe(false)
        })
    })
})
