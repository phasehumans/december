import { describe, it, expect } from 'bun:test'
import request from 'supertest'

import app from '../../src/app'
import { env } from '../../src/env'
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

    it('2. GET /api/v1/integrations/github/connect - a code that is not a sign-in links nothing (V2) (302)', async () => {
        const { generateAccessToken } = await import('../../src/modules/auth/auth.utils')
        const { integrationRepository } =
            await import('../../src/modules/integration/integration.repository')
        const token = generateAccessToken({ userId: 'signed-in-user', sessionId: 'session-1' })
        const originalUpdate = integrationRepository.updateUserGithub
        let linked = false
        integrationRepository.updateUserGithub = (async () => {
            linked = true
            return {}
        }) as any

        try {
            const res = await request(app)
                .get(
                    '/api/v1/integrations/github/connect?code=attacker-code&state=victim-user:/profile/integrations'
                )
                .set('Authorization', `Bearer ${token}`)
                .set('x-forwarded-for', getRandomIP())

            expect(res.status).toBe(302)
            expect(res.headers.location).toBe(`${env.APP_URL}/settings/repositories`)
            expect(linked).toBe(false)
        } finally {
            integrationRepository.updateUserGithub = originalUpdate
        }
    })

    it('3. GET /api/v1/integrations/github/connect - an app install with user authorization goes on to the install callback (302)', async () => {
        const res = await request(app)
            .get(
                '/api/v1/integrations/github/connect?code=c1&installation_id=55&setup_action=install&state=%2Fsettings%2Frepositories'
            )
            .set('x-forwarded-for', getRandomIP())

        expect(res.status).toBe(302)
        expect(res.headers.location).toBe(
            '/api/v1/githubapp/callback?installation_id=55&setup_action=install&state=%2Fsettings%2Frepositories&code=c1'
        )
    })
})
