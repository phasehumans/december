import { prisma } from '@december/database'
import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import request from 'supertest'

import app from '../../src/app'
import { cleanupTestUser, createSignedInUser, getRandomIP } from '../helpers'

// #624 part 2: $5 free credits, one request per normalized email, only on request
describe('free credit requests', () => {
    const stamp = Date.now()
    // the same gmail inbox, written two ways
    const emailA = `cr.test.${stamp}+promo@gmail.com`
    const emailB = `crtest${stamp}@googlemail.com`
    const users: Record<string, { userId: string; token: string }> = {}

    const form = {
        buildPlan: 'a small saas for my bakery',
        heardFrom: 'a friend',
        agreeToFeedback: true,
    }

    const post = (token: string, body: object) =>
        request(app)
            .post('/api/v1/billing/credit-request')
            .set('x-forwarded-for', getRandomIP())
            .set('Authorization', `Bearer ${token}`)
            .send(body)

    const get = (token: string) =>
        request(app)
            .get('/api/v1/billing/credit-request')
            .set('x-forwarded-for', getRandomIP())
            .set('Authorization', `Bearer ${token}`)

    beforeAll(async () => {
        users.a = await createSignedInUser({ email: emailA })
        users.b = await createSignedInUser({ email: emailB })
    })

    afterAll(async () => {
        await prisma.creditRequest.deleteMany({
            where: { normalizedEmail: `crtest${stamp}@gmail.com` },
        })
        for (const user of Object.values(users)) {
            await cleanupTestUser({ id: user.userId })
        }
    })

    it('has no request before the user asks', async () => {
        const res = await get(users.a!.token)
        expect(res.status).toBe(200)
        expect(res.body.data).toBeNull()
    })

    it('needs the agreement to give feedback', async () => {
        const res = await post(users.a!.token, { ...form, agreeToFeedback: false })
        expect(res.status).toBe(400)
    })

    it('creates a pending request and starts the balance at $0', async () => {
        const res = await post(users.a!.token, form)
        expect(res.status).toBe(201)
        expect(res.body.data.status).toBe('PENDING')

        const status = await get(users.a!.token)
        expect(status.body.data.status).toBe('PENDING')

        const user = await prisma.user.findUnique({ where: { id: users.a!.userId } })
        expect(user?.creditBalance).toBe(0)
    })

    it('a.b+x@gmail.com and ab@googlemail.com count as one request', async () => {
        const res = await post(users.b!.token, form)
        expect(res.status).toBe(409)

        // the second account sees the request made for the same inbox
        const status = await get(users.b!.token)
        expect(status.body.data.status).toBe('PENDING')
    })
})
