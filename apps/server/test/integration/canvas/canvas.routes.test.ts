import { prisma } from '@december/database'
import { describe, it, expect, beforeEach, afterAll, mock } from 'bun:test'
import jwt from 'jsonwebtoken'
import request from 'supertest'

import { env } from '../../../src/env'

const putBinaryFileMock = mock(async () => {})
const getBinaryFileMock = mock(async () => null)
const deleteObjectMock = mock(async () => {})

mock.module('../../../src/shared/project-storage', () => ({
    assetKey: (projectId: string, assetPath: string) => `projects/${projectId}/assets/${assetPath}`,
    temporaryCanvasAssetKey: (userId: string, assetPath: string) =>
        `users/${userId}/canvas-temp/${assetPath}`,
    putBinaryFile: putBinaryFileMock,
    getBinaryFile: getBinaryFileMock,
    deleteObject: deleteObjectMock,
}))

import app from '../../../src/app'

describe('canvas.routes.integration', () => {
    let user: any
    let project: any
    let token: string

    beforeEach(async () => {
        putBinaryFileMock.mockClear()
        getBinaryFileMock.mockClear()
        deleteObjectMock.mockClear()

        await prisma.projectVersion.deleteMany()
        await prisma.project.deleteMany()
        await prisma.session.deleteMany()
        await prisma.user.deleteMany()

        user = await prisma.user.create({
            data: {
                name: 'Test User',
                email: 'test@example.com',
                username: 'testuser',
                password: 'password123',
                emailVerified: true,
            },
        })

        project = await prisma.project.create({
            data: {
                name: 'Test Project',
                userId: user.id,
                prompt: 'test prompt',
            },
        })

        const version = await prisma.projectVersion.create({
            data: {
                versionNumber: 1,
                projectId: project.id,
                status: 'READY',
                sourcePrompt: 'initial prompt',
                objectStoragePrefix: `projects/${project.id}/v1/`,
                manifestJson: [],
            },
        })

        await prisma.project.update({
            where: { id: project.id },
            data: { currentVersionId: version.id },
        })

        const session = await prisma.session.create({
            data: {
                userId: user.id,
                expiresAt: new Date(Date.now() + 3600000),
                userAgent: 'test-agent',
                ipAddress: '127.0.0.1',
                refreshTokenHash: 'session-hash',
            },
        })

        token = jwt.sign({ userId: user.id, sessionId: session.id }, env.ACCESS_TOKEN_SECRET)
    })

    afterAll(async () => {
        await prisma.$disconnect()
    })

    describe('POST /api/v1/canvas/save', () => {
        it('should save canvas successfully', async () => {
            const canvasState = {
                items: [],
                connections: [],
                pan: { x: 10, y: 20 },
                scale: 100,
                hasInteracted: true,
            }

            const response = await request(app)
                .post('/api/v1/canvas/save')
                .set('Authorization', `Bearer ${token}`)
                .send({
                    projectId: project.id,
                    canvasState,
                })

            expect(response.status).toBe(200)
            expect(response.body.success).toBe(true)
            expect(response.body.message).toBe('canvas saved successfully')
            expect(response.body.data.canvasState).toEqual(canvasState)

            // Verify project version is updated in DB
            const updatedProject = await prisma.project.findUnique({
                where: { id: project.id },
                select: { currentVersionId: true },
            })
            const version = await prisma.projectVersion.findUnique({
                where: { id: updatedProject!.currentVersionId! },
            })
            expect(version!.canvasStateJson).toEqual(canvasState)
        })

        it('should fail if project is not owned by the user', async () => {
            const otherUser = await prisma.user.create({
                data: {
                    name: 'Other User',
                    email: 'other@example.com',
                    username: 'otheruser',
                    password: 'password123',
                    emailVerified: true,
                },
            })

            const otherProject = await prisma.project.create({
                data: {
                    name: 'Other Project',
                    userId: otherUser.id,
                    prompt: 'test prompt',
                },
            })

            const response = await request(app)
                .post('/api/v1/canvas/save')
                .set('Authorization', `Bearer ${token}`)
                .send({
                    projectId: otherProject.id,
                    canvasState: {
                        items: [],
                        connections: [],
                        pan: { x: 0, y: 0 },
                        scale: 100,
                        hasInteracted: false,
                    },
                })

            expect(response.status).toBe(400)
            expect(response.body.success).toBe(false)
            expect(response.body.message).toBe('project not found')
        })
    })

    describe('POST /api/v1/canvas/web-clips', () => {
        it('should reject invalid URL schema', async () => {
            const response = await request(app)
                .post('/api/v1/canvas/web-clips')
                .set('Authorization', `Bearer ${token}`)
                .send({
                    url: 'not-a-valid-url',
                    projectId: project.id,
                })

            expect(response.status).toBe(400)
            expect(response.body.success).toBe(false)
            expect(response.body.message).toBe('validation failed')
            expect(response.body.errors.url).toBeDefined()
        })
    })
})
