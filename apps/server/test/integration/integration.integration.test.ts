import { describe, it, expect } from 'bun:test'
import request from 'supertest'

import app from '../../src/app'
import { env } from '../../src/env'
import { integrationsService } from '../../src/modules/integration/integration.service'
import { getRandomIP } from '../helpers'

describe('Integrations Module Integration Tests', () => {
    it('1. GET /api/v1/integrations/vercel/connect - fails validation with missing query params (400)', async () => {
        const res = await request(app)
            .get('/api/v1/integrations/vercel/connect')
            .set('x-forwarded-for', getRandomIP())

        expect(res.status).toBe(400)
    })

    it('2. GET /api/v1/integrations/vercel/connect - handles successful vercel connection and redirects (302)', async () => {
        const originalConnect = integrationsService.connectVercel
        integrationsService.connectVercel = async () => ({}) as any

        try {
            const res = await request(app)
                .get(
                    '/api/v1/integrations/vercel/connect?code=vcode123&state=user123:/custom/redirect'
                )
                .set('x-forwarded-for', getRandomIP())

            expect(res.status).toBe(302)
            expect(res.headers.location).toBe(`${env.APP_URL}/custom/redirect`)
        } finally {
            integrationsService.connectVercel = originalConnect
        }
    })

    it('3. GET /api/v1/integrations/github/connect - redirects to callback when state=auth (302)', async () => {
        const res = await request(app)
            .get('/api/v1/integrations/github/connect?code=ghcode123&state=auth')
            .set('x-forwarded-for', getRandomIP())

        expect(res.status).toBe(302)
        expect(res.headers.location).toBe(`${env.APP_URL}/github/callback?code=ghcode123`)
    })

    it('4. GET /api/v1/integrations/github/connect - handles oauth connect and redirects (302)', async () => {
        const originalHandle = integrationsService.handleGitHubOAuth
        integrationsService.handleGitHubOAuth = async () => ({}) as any

        try {
            const res = await request(app)
                .get(
                    '/api/v1/integrations/github/connect?code=ghcode123&state=user123:/profile/integrations'
                )
                .set('x-forwarded-for', getRandomIP())

            expect(res.status).toBe(302)
            expect(res.headers.location).toBe(`${env.APP_URL}/profile/integrations`)
        } finally {
            integrationsService.handleGitHubOAuth = originalHandle
        }
    })
})
