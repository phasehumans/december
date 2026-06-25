import { describe, it, expect, beforeEach, mock } from 'bun:test'
import request from 'supertest'

const connectVercelMock = mock(async () => {})
const connectSupabaseMock = mock(async () => {})
const connectNotionMock = mock(async () => {})
const connectGithubMock = mock(async () => {})

mock.module('../../../src/modules/integration/integration.service', () => ({
    integrationsService: {
        connectVercel: connectVercelMock,
        connectSupabase: connectSupabaseMock,
        connectNotion: connectNotionMock,
        connectGithub: connectGithubMock,
    },
}))

import app from '../../../src/app'

describe('integration.routes.integration', () => {
    beforeEach(() => {
        connectVercelMock.mockClear()
        connectSupabaseMock.mockClear()
        connectNotionMock.mockClear()
        connectGithubMock.mockClear()
    })

    describe('GET /api/v1/integrations/vercel/connect', () => {
        it('should redirect if state and code are provided', async () => {
            const response = await request(app)
                .get('/api/v1/integrations/vercel/connect')
                .query({ code: 'code123', state: 'user123' })

            expect(response.status).toBe(302)
            expect(response.header.location).toBe('http://localhost:3000/profile/integrations')
            expect(connectVercelMock).toHaveBeenCalledTimes(1)
        })

        it('should fail with 400 if state or code is missing', async () => {
            const response = await request(app)
                .get('/api/v1/integrations/vercel/connect')
                .query({ code: 'code123' })

            expect(response.status).toBe(400)
        })

        it('should return 500 if the service throws an unexpected error', async () => {
            connectVercelMock.mockImplementationOnce(() => {
                throw new Error('Unexpected Error')
            })

            const response = await request(app)
                .get('/api/v1/integrations/vercel/connect')
                .query({ code: 'code123', state: 'user123' })

            expect(response.status).toBe(500)
            expect(response.body.success).toBe(false)
            expect(response.body.message).toBe('internal server error')
        })
    })

    describe('GET /api/v1/integrations/supabase/connect', () => {
        it('should redirect if state and code are provided', async () => {
            const response = await request(app)
                .get('/api/v1/integrations/supabase/connect')
                .query({ code: 'code123', state: 'user123' })

            expect(response.status).toBe(302)
            expect(response.header.location).toBe('http://localhost:3000/profile/integrations')
            expect(connectSupabaseMock).toHaveBeenCalledTimes(1)
        })
    })

    describe('GET /api/v1/integrations/notion/connect', () => {
        it('should redirect if state and code are provided', async () => {
            const response = await request(app)
                .get('/api/v1/integrations/notion/connect')
                .query({ code: 'code123', state: 'user123' })

            expect(response.status).toBe(302)
            expect(response.header.location).toBe('http://localhost:3000/profile/integrations')
            expect(connectNotionMock).toHaveBeenCalledTimes(1)
        })
    })
})
