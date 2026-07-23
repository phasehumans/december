import { describe, it, expect } from 'bun:test'
import express from 'express'
import request from 'supertest'

import app from '../src/app'
import { createRateLimiter } from '../src/middleware/rate-limiter'

describe('Rate Limiter & Structured Logger Middleware Integration', () => {
    it('propagates or generates x-request-id header on HTTP responses', async () => {
        const res = await request(app).get('/api/v1/core/health')
        expect(res.headers['x-request-id']).toBeDefined()
        expect(typeof res.headers['x-request-id']).toBe('string')
    })

    it('preserves incoming x-request-id header when provided by client', async () => {
        const customId = 'test-request-id-12345'
        const res = await request(app).get('/api/v1/core/health').set('x-request-id', customId)
        expect(res.headers['x-request-id']).toBe(customId)
    })

    it('returns rate limit headers (ratelimit-limit, ratelimit-remaining)', async () => {
        const res = await request(app).get('/api/v1/core/health')
        expect(res.headers['ratelimit-limit']).toBeDefined()
        expect(res.headers['ratelimit-remaining']).toBeDefined()
    })

    it('enforces rate limit and returns 429 payload when threshold is exceeded', async () => {
        const testApp = express()
        const strictLimiter = createRateLimiter({
            windowMs: 60 * 1000,
            limit: 2,
            message: 'Strict test limit reached',
        })

        testApp.use('/test-limit', strictLimiter, (_req, res) => {
            res.json({ ok: true })
        })

        // Request 1: OK
        const res1 = await request(testApp).get('/test-limit')
        expect(res1.status).toBe(200)

        // Request 2: OK
        const res2 = await request(testApp).get('/test-limit')
        expect(res2.status).toBe(200)

        // Request 3: 429 Exceeded
        const res3 = await request(testApp).get('/test-limit')
        expect(res3.status).toBe(429)
        expect(res3.body.success).toBe(false)
        expect(res3.body.message).toBe('Strict test limit reached')
        expect(res3.body.error).toBeDefined()
        expect(res3.body.error.code).toBe('RATE_LIMIT_EXCEEDED')
        expect(typeof res3.body.error.retryAfter).toBe('number')
    })
})
