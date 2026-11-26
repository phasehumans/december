import { describe, it, expect } from 'bun:test'
import request from 'supertest'

import app from '../../src/app'

describe('Server Health Check Endpoints', () => {
    it('GET /health says only ok: no version, uptime or service details in public', async () => {
        const res = await request(app).get('/health')
        expect(res.status).toBe(200)
        expect(res.body).toEqual({ status: 'ok' })
        expect(res.headers['cache-control']).toBe('no-store')
    })

    it('the old /api/health and /api/v1/health aliases are gone', async () => {
        expect((await request(app).get('/api/health')).status).toBe(404)
        expect((await request(app).get('/api/v1/health')).status).toBe(404)
    })
})
