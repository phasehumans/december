import '../../../tests/env'

import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'bun:test'

import request from 'supertest'
import express from 'express'
import { Router } from 'express'
import { prisma } from '../../../src/config/db'
import { templateController } from '../../../src/modules/template/template.controller'

const TEST_USER_ID = 'template-test-user-id'
const TEST_SESSION_ID = 'template-test-session-id'

const createTestUser = async (overrides: Record<string, unknown> = {}) => {
    return prisma.user.create({
        data: {
            id: TEST_USER_ID,
            name: 'Template Test User',
            email: `template-${crypto.randomUUID()}@example.com`,
            username: `tpl_${crypto.randomUUID().slice(0, 12)}`,
            password: 'hashed-password',
            emailVerified: true,
            isDeleted: false,
            ...overrides,
        },
    })
}

const createTemplate = async (userId: string, overrides: Record<string, unknown> = {}) => {
    return prisma.project.create({
        data: {
            name: 'Test Template',
            prompt: 'Build a landing page',
            description: 'A shared template',
            isSharedAsTemplate: true,
            isFeatured: false,
            userId,
            ...overrides,
        },
    })
}

describe('template.routes.integration', () => {
    let app: express.Application
    let templateId: string

    beforeAll(() => {
        app = express()
        app.use(express.json())
        app.use((req, _res, next) => {
            req.user = { userId: TEST_USER_ID, sessionId: TEST_SESSION_ID }
            next()
        })
        const testRouter = Router()
        testRouter.get('/', templateController.getAllTemplates)
        testRouter.get('/featured', templateController.getFeaturedTemplates)
        testRouter.get('/:templateId', templateController.getTemplateById)
        testRouter.post('/:templateId/remix', templateController.remixTemplate)
        testRouter.post('/:templateId/like', templateController.toggleLike)
        app.use('/api/v1/templates', testRouter)

        app.use((err: any, _req: any, res: any, _next: any) => {
            res.status(err.statusCode || 500).json({
                success: false,
                message: err.message,
            })
        })
    })

    beforeEach(async () => {
        await prisma.projectLike.deleteMany()
        await prisma.projectVersion.deleteMany()
        await prisma.project.deleteMany()
        await prisma.session.deleteMany()
        await prisma.user.deleteMany()

        await createTestUser()

        const template = await createTemplate(TEST_USER_ID)
        templateId = template.id
    })

    afterAll(async () => {
        await prisma.$disconnect()
    })

    describe('GET /api/v1/templates', () => {
        it('should return 200 with all shared templates', async () => {
            await createTemplate(TEST_USER_ID, { name: 'Second Template' })

            const res = await request(app).get('/api/v1/templates')

            expect(res.status).toBe(200)
            expect(res.body.success).toBe(true)
            expect(Array.isArray(res.body.data)).toBe(true)
            expect(res.body.data.length).toBe(2)
        })

        it('should return 200 with empty array when no templates', async () => {
            await prisma.project.deleteMany()

            const res = await request(app).get('/api/v1/templates')

            expect(res.status).toBe(200)
            expect(res.body.success).toBe(true)
            expect(res.body.data).toEqual([])
        })

        it('should not include non-shared projects in results', async () => {
            await prisma.project.create({
                data: {
                    name: 'Private Project',
                    prompt: 'private',
                    userId: TEST_USER_ID,
                    isSharedAsTemplate: false,
                },
            })

            const res = await request(app).get('/api/v1/templates')

            expect(res.status).toBe(200)
            const names = res.body.data.map((t: any) => t.name)
            expect(names).not.toContain('Private Project')
        })

        it('should return templates with isSharedAsTemplate true', async () => {
            const res = await request(app).get('/api/v1/templates')

            expect(res.status).toBe(200)
            res.body.data.forEach((t: any) => {
                expect(t.isSharedAsTemplate).toBe(true)
            })
        })
    })

    describe('GET /api/v1/templates/featured', () => {
        it('should return 200 with featured templates only', async () => {
            await createTemplate(TEST_USER_ID, { name: 'Featured', isFeatured: true })

            const res = await request(app).get('/api/v1/templates/featured')

            expect(res.status).toBe(200)
            expect(res.body.success).toBe(true)
            const names = res.body.data.map((t: any) => t.name)
            expect(names).toContain('Featured')
        })

        it('should return 200 with empty array when no featured templates', async () => {
            const res = await request(app).get('/api/v1/templates/featured')

            expect(res.status).toBe(200)
            expect(res.body.data).toEqual([])
        })

        it('should not return non-featured templates', async () => {
            const res = await request(app).get('/api/v1/templates/featured')

            expect(res.status).toBe(200)
            res.body.data.forEach((t: any) => {
                expect(t.isFeatured).toBe(true)
            })
        })
    })

    describe('GET /api/v1/templates/:templateId', () => {
        it('should return 200 with template data for valid id', async () => {
            const res = await request(app).get(`/api/v1/templates/${templateId}`)

            expect(res.status).toBe(200)
            expect(res.body.success).toBe(true)
            expect(res.body.data.id).toBe(templateId)
            expect(res.body.data.name).toBe('Test Template')
            expect(res.body.data.isSharedAsTemplate).toBe(true)
        })

        it('should return 404 for non-existent templateId', async () => {
            const res = await request(app).get('/api/v1/templates/non-existent-id')

            expect(res.status).toBe(404)
            expect(res.body.success).toBe(false)
        })

        it('should return 404 for project not shared as template', async () => {
            const privateProject = await prisma.project.create({
                data: {
                    name: 'Private',
                    prompt: 'private',
                    userId: TEST_USER_ID,
                    isSharedAsTemplate: false,
                },
            })

            const res = await request(app).get(`/api/v1/templates/${privateProject.id}`)

            expect(res.status).toBe(404)
            expect(res.body.success).toBe(false)
        })
    })

    describe('POST /api/v1/templates/:templateId/remix', () => {
        it('should return 200 and create remixed project', async () => {
            const res = await request(app).post(`/api/v1/templates/${templateId}/remix`)

            expect(res.status).toBe(200)
            expect(res.body.success).toBe(true)
            expect(res.body.data.name).toBe('Remix of Test Template')
            expect(res.body.data.userId).toBe(TEST_USER_ID)
        })

        it('should return 404 for non-existent template', async () => {
            const res = await request(app).post('/api/v1/templates/non-existent-id/remix')

            expect(res.status).toBe(404)
            expect(res.body.success).toBe(false)
        })

        it('should return 404 for non-shared project', async () => {
            const privateProject = await prisma.project.create({
                data: {
                    name: 'Private',
                    prompt: 'private',
                    userId: TEST_USER_ID,
                    isSharedAsTemplate: false,
                },
            })

            const res = await request(app).post(`/api/v1/templates/${privateProject.id}/remix`)

            expect(res.status).toBe(404)
            expect(res.body.success).toBe(false)
        })

        it('should persist remixed project in database', async () => {
            const res = await request(app).post(`/api/v1/templates/${templateId}/remix`)

            expect(res.status).toBe(200)

            const db = await prisma.project.findUnique({ where: { id: res.body.data.id } })
            expect(db).not.toBeNull()
            expect(db!.name).toBe('Remix of Test Template')
        })

        it('should not mark remixed project as a template', async () => {
            const res = await request(app).post(`/api/v1/templates/${templateId}/remix`)

            expect(res.status).toBe(200)
            expect(res.body.data.isSharedAsTemplate).toBe(false)
        })
    })

    describe('POST /api/v1/templates/:templateId/like', () => {
        it('should return 200 when liking a template', async () => {
            const res = await request(app)
                .post(`/api/v1/templates/${templateId}/like`)
                .send({ isLiked: true })

            expect(res.status).toBe(200)
            expect(res.body.success).toBe(true)
            expect(res.body.data.isLiked).toBe(true)
        })

        it('should return 200 when unliking a template', async () => {
            const res = await request(app)
                .post(`/api/v1/templates/${templateId}/like`)
                .send({ isLiked: false })

            expect(res.status).toBe(200)
            expect(res.body.success).toBe(true)
            expect(res.body.data.isLiked).toBe(false)
        })

        it('should return 400 when isLiked is missing', async () => {
            const res = await request(app).post(`/api/v1/templates/${templateId}/like`).send({})

            expect(res.status).toBe(400)
            expect(res.body.success).toBe(false)
        })

        it('should return 400 when isLiked is a string', async () => {
            const res = await request(app)
                .post(`/api/v1/templates/${templateId}/like`)
                .send({ isLiked: 'true' })

            expect(res.status).toBe(400)
            expect(res.body.success).toBe(false)
        })

        it('should return 400 when isLiked is a number', async () => {
            const res = await request(app)
                .post(`/api/v1/templates/${templateId}/like`)
                .send({ isLiked: 1 })

            expect(res.status).toBe(400)
            expect(res.body.success).toBe(false)
        })

        it('should return 404 for non-existent template', async () => {
            const res = await request(app)
                .post('/api/v1/templates/non-existent-id/like')
                .send({ isLiked: true })

            expect(res.status).toBe(404)
            expect(res.body.success).toBe(false)
        })

        it('should return 404 for non-shared project', async () => {
            const privateProject = await prisma.project.create({
                data: {
                    name: 'Private',
                    prompt: 'private',
                    userId: TEST_USER_ID,
                    isSharedAsTemplate: false,
                },
            })

            const res = await request(app)
                .post(`/api/v1/templates/${privateProject.id}/like`)
                .send({ isLiked: true })

            expect(res.status).toBe(404)
        })

        it('should update like state from true to false', async () => {
            await request(app).post(`/api/v1/templates/${templateId}/like`).send({ isLiked: true })

            const res = await request(app)
                .post(`/api/v1/templates/${templateId}/like`)
                .send({ isLiked: false })

            expect(res.status).toBe(200)
            expect(res.body.data.isLiked).toBe(false)
        })

        it('should persist like state in database', async () => {
            await request(app).post(`/api/v1/templates/${templateId}/like`).send({ isLiked: true })

            const db = await prisma.projectLike.findUnique({
                where: {
                    userId_projectId: { userId: TEST_USER_ID, projectId: templateId },
                },
            })

            expect(db).not.toBeNull()
            expect(db!.isLiked).toBe(true)
        })
    })
})
