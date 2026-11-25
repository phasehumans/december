import { prisma } from '@december/database'
import { describe, it, expect, afterAll, beforeAll } from 'bun:test'
import request from 'supertest'

import app from '../../src/app'
import { cleanupTestUser, getRandomIP, signInWithEmailCode } from '../helpers'

// issue 632: /permissions for cloud sessions, deny rules saved on the account
describe('Tool deny rules (#632)', () => {
    const email = `perm-${Date.now()}@example.com`
    let token: string

    const call = (method: 'get' | 'put', body?: object) =>
        request(app)
            [method]('/api/v1/setting/permissions')
            .set('x-forwarded-for', getRandomIP())
            .set('Authorization', `Bearer ${token}`)
            .send(body ?? {})

    beforeAll(async () => {
        await prisma.user.create({ data: { email, name: 'Perm User', emailVerified: true } })
        token = (await signInWithEmailCode(app, email)).body.data.accessToken
    })

    afterAll(async () => {
        await cleanupTestUser({ email })
    })

    it('starts empty, saves the list without duplicates and replaces it', async () => {
        expect((await call('get')).body.data).toEqual({ rules: [] })

        const saved = await call('put', { rules: ['git push*', 'rm -rf*', 'git push*'] })
        expect(saved.status).toBe(200)
        expect(saved.body.data).toEqual({ rules: ['git push*', 'rm -rf*'] })

        const replaced = await call('put', { rules: ['web_fetch'] })
        expect(replaced.body.data).toEqual({ rules: ['web_fetch'] })
        expect((await call('get')).body.data).toEqual({ rules: ['web_fetch'] })
    })

    it('rejects empty rules and too many', async () => {
        expect((await call('put', { rules: [' '] })).status).toBe(400)
        const many = Array.from({ length: 101 }, (_, i) => `rule-${i}`)
        expect((await call('put', { rules: many })).status).toBe(400)
    })
})
