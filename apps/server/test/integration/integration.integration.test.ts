import { describe, it, expect } from 'bun:test'
import request from 'supertest'

import app from '../../src/app'
import { env } from '../../src/env'
import { integrationsService } from '../../src/modules/integration/integration.service'
import { getRandomIP } from '../helpers'

describe('Integrations Module Integration Tests', () => {
    it('1. GET /api/v1/integrations/github/connect - redirects to callback when state=auth (302)', async () => {
        const res = await request(app)
            .get('/api/v1/integrations/github/connect?code=ghcode123&state=auth')
            .set('x-forwarded-for', getRandomIP())

        expect(res.status).toBe(302)
        expect(res.headers.location).toBe(
            `${env.APP_URL}/github/callback?code=ghcode123&state=auth`
        )
    })

    it('1b. GET /api/v1/integrations/github/connect - passes a login nonce state through encoded (302)', async () => {
        const res = await request(app)
            .get('/api/v1/integrations/github/connect?code=gh%26code&state=auth.abc123')
            .set('x-forwarded-for', getRandomIP())

        expect(res.status).toBe(302)
        expect(res.headers.location).toBe(
            `${env.APP_URL}/github/callback?code=gh%26code&state=auth.abc123`
        )
    })

    it('2. GET /api/v1/integrations/github/connect - links github to the signed-in user, not the user in state (302)', async () => {
        const { generateAccessToken } = await import('../../src/modules/auth/auth.utils')
        const token = generateAccessToken({ userId: 'signed-in-user', sessionId: 'session-1' })
        const originalHandle = integrationsService.handleGitHubOAuth
        const calls: Array<{ code: string; userId: string }> = []
        integrationsService.handleGitHubOAuth = (async (data: { code: string; userId: string }) => {
            calls.push(data)
            return {}
        }) as any

        try {
            const res = await request(app)
                .get(
                    '/api/v1/integrations/github/connect?code=ghcode123&state=victim-user:/profile/integrations'
                )
                .set('Authorization', `Bearer ${token}`)
                .set('x-forwarded-for', getRandomIP())

            expect(res.status).toBe(302)
            expect(res.headers.location).toBe(`${env.APP_URL}/profile/integrations`)
            expect(calls).toEqual([{ code: 'ghcode123', userId: 'signed-in-user' }])
        } finally {
            integrationsService.handleGitHubOAuth = originalHandle
        }
    })

    it('3. GET /api/v1/integrations/github/connect - without a session, links nothing and sends the user to login (302)', async () => {
        const originalHandle = integrationsService.handleGitHubOAuth
        let called = false
        integrationsService.handleGitHubOAuth = (async () => {
            called = true
            return {}
        }) as any

        try {
            const res = await request(app)
                .get(
                    '/api/v1/integrations/github/connect?code=ghcode123&state=victim-user:/profile/integrations'
                )
                .set('x-forwarded-for', getRandomIP())

            expect(res.status).toBe(302)
            expect(res.headers.location).toBe(
                `${env.APP_URL}/login?redirect=%2Fprofile%2Fintegrations`
            )
            expect(called).toBe(false)
        } finally {
            integrationsService.handleGitHubOAuth = originalHandle
        }
    })

    it('4. GET /api/v1/integrations/github/connect - an unsafe return path in state falls back to settings (302)', async () => {
        const { generateAccessToken } = await import('../../src/modules/auth/auth.utils')
        const token = generateAccessToken({ userId: 'signed-in-user', sessionId: 'session-1' })
        const originalHandle = integrationsService.handleGitHubOAuth
        integrationsService.handleGitHubOAuth = (async () => ({})) as any

        try {
            const res = await request(app)
                .get('/api/v1/integrations/github/connect?code=ghcode123&state=x:%2F%09%2Fevil.com')
                .set('Authorization', `Bearer ${token}`)
                .set('x-forwarded-for', getRandomIP())

            expect(res.status).toBe(302)
            expect(res.headers.location).toBe(`${env.APP_URL}/settings/repositories`)
        } finally {
            integrationsService.handleGitHubOAuth = originalHandle
        }
    })
})
