import { prisma } from '@december/database'
import { describe, it, expect, beforeAll, afterAll } from 'bun:test'
import request from 'supertest'

import app from '../../src/app'
import { setRepoArchiveFetch } from '../../src/modules/platform/platform.utils'
import { cleanupTestUser, getRandomIP } from '../helpers'

describe('Platform Module Integration Tests', () => {
    let testUserId: string
    let testEmail: string
    let accessToken: string
    let testSessionId: string

    beforeAll(async () => {
        const timestamp = Date.now()
        testEmail = `platformtest-${timestamp}@example.com`

        const user = await prisma.user.create({
            data: {
                name: 'Platform Test User',
                email: testEmail,
                emailVerified: true,
                githubConnected: false,
            },
        })
        testUserId = user.id

        const { generateAccessToken } = await import('../../src/modules/auth/auth.utils')
        const authSession = await prisma.authSession.create({
            data: {
                userId: testUserId,
                refreshTokenHash: `platform-hash-${timestamp}`,
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            },
        })

        accessToken = generateAccessToken({ userId: testUserId, sessionId: authSession.id })

        const session = await prisma.session.create({
            data: {
                userId: testUserId,
                title: 'Platform Test Session',
                vmStatus: 'STOPPED',
                githubRepoName: 'test-repo',
                githubRepoOwner: 'test-owner',
            },
        })
        testSessionId = session.id
    })

    afterAll(async () => {
        if (testUserId) {
            await prisma.session.deleteMany({ where: { userId: testUserId } }).catch(() => {
                // Intentionally swallowed: test cleanup fallback
            })
            await prisma.authSession.deleteMany({ where: { userId: testUserId } }).catch(() => {
                // Intentionally swallowed: test cleanup fallback
            })
            await cleanupTestUser({ id: testUserId })
        }
    })

    it('1. GET /api/v1/platform/:sessionId/download - unauthorized without token (401)', async () => {
        const res = await request(app)
            .get(`/api/v1/platform/${testSessionId}/download`)
            .set('x-forwarded-for', getRandomIP())

        expect(res.status).toBe(401)
    })

    it('2. GET /api/v1/platform/:sessionId/download - a stopped sandbox with a repository reads the repository with the user token', async () => {
        // the test user has no github connection: the download says so, it never serves a fake zip
        const res = await request(app)
            .get(`/api/v1/platform/${testSessionId}/download`)
            .set('x-forwarded-for', getRandomIP())
            .set('Authorization', `Bearer ${accessToken}`)

        expect(res.status).toBe(400)
        expect(res.body.message).toContain('GitHub is not connected')
    })

    it('2b. GET /api/v1/platform/:sessionId/download - streams the zip of the session branch from github', async () => {
        const calls: Array<{ url: string; auth: string | null }> = []
        const branchSession = await prisma.session.create({
            data: {
                userId: testUserId,
                title: 'Branch Session',
                githubRepoName: 'test-repo',
                githubRepoOwner: 'test-owner',
                branch: 'main',
                prBranch: 'december/fix-login',
            },
        })
        await prisma.user.update({
            where: { id: testUserId },
            data: { githubToken: 'gho_test_token' },
        })
        setRepoArchiveFetch((async (url: string, init?: RequestInit) => {
            calls.push({
                url,
                auth: new Headers(init?.headers).get('Authorization'),
            })
            return new Response('PK\x03\x04repo-zip', { status: 200 })
        }) as any)
        try {
            const res = await request(app)
                .get(`/api/v1/platform/${branchSession.id}/download`)
                .set('x-forwarded-for', getRandomIP())
                .set('Authorization', `Bearer ${accessToken}`)
                .buffer(true)
                .parse((response, callback) => {
                    const chunks: Buffer[] = []
                    response.on('data', (chunk: Buffer) => chunks.push(chunk))
                    response.on('end', () => callback(null, Buffer.concat(chunks)))
                })

            expect(res.status).toBe(200)
            expect(res.headers['content-type']).toContain('application/zip')
            expect((res.body as Buffer).toString()).toContain('repo-zip')
            expect(calls).toEqual([
                {
                    url: 'https://api.github.com/repos/test-owner/test-repo/zipball/december/fix-login',
                    auth: 'Bearer gho_test_token',
                },
            ])
        } finally {
            setRepoArchiveFetch(null)
            await prisma.user.update({ where: { id: testUserId }, data: { githubToken: null } })
            await prisma.session.delete({ where: { id: branchSession.id } })
        }
    })

    it('2c. GET /api/v1/platform/:sessionId/download - packs the live sandbox first', async () => {
        const liveSession = await prisma.session.create({
            data: {
                userId: testUserId,
                title: 'Live Session',
                vmId: 'mock-live-sandbox',
                sandboxStatus: 'RUNNING',
                githubRepoName: 'test-repo',
                githubRepoOwner: 'test-owner',
            },
        })
        try {
            const res = await request(app)
                .get(`/api/v1/platform/${liveSession.id}/download`)
                .set('x-forwarded-for', getRandomIP())
                .set('Authorization', `Bearer ${accessToken}`)

            expect(res.status).toBe(200)
            expect(res.headers['content-type']).toContain('application/zip')
        } finally {
            await prisma.session.delete({ where: { id: liveSession.id } })
        }
    })

    it('3. POST /api/v1/platform/sessions/:sessionId/github/unlink - unlinks github repo (200)', async () => {
        const res = await request(app)
            .post(`/api/v1/platform/sessions/${testSessionId}/github/unlink`)
            .set('x-forwarded-for', getRandomIP())
            .set('Authorization', `Bearer ${accessToken}`)

        expect(res.status).toBe(200)
        expect(res.body.data.message).toBe('GitHub repository unlinked successfully')

        const dbSession = await prisma.session.findUnique({ where: { id: testSessionId } })
        expect(dbSession?.githubRepoName).toBeNull()
    })

    it('4. GET /api/v1/platform/:sessionId/download - no live sandbox and no repository is a 404, not an empty zip', async () => {
        const res = await request(app)
            .get(`/api/v1/platform/${testSessionId}/download`)
            .set('x-forwarded-for', getRandomIP())
            .set('Authorization', `Bearer ${accessToken}`)

        expect(res.status).toBe(404)
        expect(res.body.message).toContain('Nothing to download')
    })
})
