import { prisma } from '@december/database'
import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import request from 'supertest'

import app from '../../src/app'
import { cleanupTestUser, createSignedInUser, getRandomIP } from '../helpers'

// #624 part 4: a sandbox with an open preview that gets requests is not paused
describe('preview requests keep a sandbox running', () => {
    let userId: string
    let token: string

    beforeAll(async () => {
        const user = await createSignedInUser({
            email: `sandbox-activity-${Date.now()}@example.com`,
        })
        userId = user.userId
        token = user.token
    })

    afterAll(async () => {
        await prisma.session.deleteMany({ where: { userId } })
        await cleanupTestUser({ id: userId })
    })

    const createPreviewedSession = (title: string) =>
        prisma.session.create({
            data: {
                userId,
                title,
                vmId: `e2b-${title}-vm`,
                vmStatus: 'STOPPED',
                sandboxStatus: 'RUNNING',
                vmLastActivityAt: new Date(Date.now() - 30 * 60 * 1000),
            },
        })

    const lastActivityIsRecent = async (sessionId: string) => {
        const after = await prisma.session.findUnique({ where: { id: sessionId } })
        return after!.vmLastActivityAt!.getTime() > Date.now() - 60 * 1000
    }

    it('a preview request moves the last activity time forward', async () => {
        const session = await createPreviewedSession('proxy')

        const res = await request(app)
            .get(`/api/v1/sessions/${session.id}/preview/3000`)
            .set('x-forwarded-for', getRandomIP())
            .set('Authorization', `Bearer ${token}`)
            .set('Accept', 'application/json')
        expect(res.status).toBe(200)
        expect(await lastActivityIsRecent(session.id)).toBe(true)
    })

    it('the open preview ping counts as activity, only for the owner', async () => {
        const session = await createPreviewedSession('ping')
        const stranger = await createSignedInUser({
            email: `sandbox-activity-other-${Date.now()}@example.com`,
        })

        const denied = await request(app)
            .post(`/api/v1/session/${session.id}/preview-activity`)
            .set('x-forwarded-for', getRandomIP())
            .set('Authorization', `Bearer ${stranger.token}`)
        expect(denied.status).toBe(404)
        expect(await lastActivityIsRecent(session.id)).toBe(false)

        const res = await request(app)
            .post(`/api/v1/session/${session.id}/preview-activity`)
            .set('x-forwarded-for', getRandomIP())
            .set('Authorization', `Bearer ${token}`)
        expect(res.status).toBe(200)
        expect(await lastActivityIsRecent(session.id)).toBe(true)
        await cleanupTestUser({ id: stranger.userId })
    })

    it('a new session is not blocked by idle sandboxes, only by working agents', async () => {
        for (let i = 0; i < 10; i++) {
            await prisma.session.create({
                data: {
                    userId,
                    title: `idle-${i}`,
                    vmStatus: 'STOPPED',
                    sandboxStatus: 'RUNNING',
                    status: 'PARKED',
                },
            })
        }
        await prisma.user.update({ where: { id: userId }, data: { creditBalance: 500 } })

        const res = await request(app)
            .post('/api/v1/sessions')
            .set('x-forwarded-for', getRandomIP())
            .set('Authorization', `Bearer ${token}`)
            .send({ title: 'eleventh' })
        expect(res.status).toBe(201)
    })
})
