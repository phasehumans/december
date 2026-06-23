import { prisma } from '@december/database'
import { describe, it, expect, beforeEach, afterAll, mock } from 'bun:test'
import jwt from 'jsonwebtoken'
import request from 'supertest'

import { env } from '../../../src/env'

const importFromGithubMock = mock(async () => ({ id: 'import-id', status: 'PENDING' }))
const getImportStatusMock = mock(async () => ({ id: 'import-id', status: 'PENDING' }))

mock.module('../../../src/modules/import/import.service', () => ({
    uploadService: {
        importFromGithub: importFromGithubMock,
        getImportStatus: getImportStatusMock,
    },
}))

import app from '../../../src/app'

describe('import.routes.integration', () => {
    let user: any
    let token: string

    beforeEach(async () => {
        importFromGithubMock.mockClear()
        getImportStatusMock.mockClear()

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

    describe('POST /api/v1/upload/github', () => {
        it('should queue GitHub import successfully', async () => {
            const response = await request(app)
                .post('/api/v1/upload/github')
                .set('Authorization', `Bearer ${token}`)
                .send({
                    repoURL: 'https://github.com/owner/repo',
                })

            expect(response.status).toBe(202)
            expect(response.body.success).toBe(true)
            expect(response.body.message).toBe('import queued')
            expect(importFromGithubMock).toHaveBeenCalledTimes(1)
        })

        it('should fail with invalid payload', async () => {
            const response = await request(app)
                .post('/api/v1/upload/github')
                .set('Authorization', `Bearer ${token}`)
                .send({
                    repoURL: '',
                })

            expect(response.status).toBe(400)
        })
    })

    describe('GET /api/v1/upload/:id', () => {
        it('should fetch import status successfully', async () => {
            const response = await request(app)
                .get('/api/v1/upload/00000000-0000-0000-0000-000000000000')
                .set('Authorization', `Bearer ${token}`)

            expect(response.status).toBe(200)
            expect(response.body.success).toBe(true)
            expect(response.body.message).toBe('import status fetched')
            expect(getImportStatusMock).toHaveBeenCalledTimes(1)
        })
    })
})
