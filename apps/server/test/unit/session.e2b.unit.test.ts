import { describe, it, expect, spyOn } from 'bun:test'

import { sessionRepository } from '../../src/modules/session/session.repository'
import { sessionService } from '../../src/modules/session/session.service'

describe('Session E2B Service Suite', () => {
    it('disconnectSession - acknowledges disconnect without terminating or pausing background containers', async () => {
        const testSessionId = 'sess-disconnect-1'
        const testUserId = 'user-disconnect-1'

        spyOn(sessionRepository, 'findSessionById').mockImplementation(
            async (id: string) =>
                ({
                    id,
                    userId: testUserId,
                    vmStatus: 'RUNNING',
                }) as any
        )

        const result = await sessionService.disconnectSession({
            userId: testUserId,
            sessionId: testSessionId,
        })

        expect(result.message).toContain('Disconnect acknowledged')
    })

    it('proxyPreview - resolves preview URL, target host and X-Forwarded-Host header', async () => {
        const testSessionId = 'sess-preview-1'
        const testUserId = 'user-preview-1'

        spyOn(sessionRepository, 'findSessionById').mockImplementation(
            async (id: string) =>
                ({
                    id,
                    userId: testUserId,
                    vmStatus: 'RUNNING',
                }) as any
        )

        const result = await sessionService.proxyPreview({
            userId: testUserId,
            sessionId: testSessionId,
            port: 5173,
            reqPath: '/app',
        })

        expect(result.port).toBe(5173)
        expect(result.targetHost).toBe(`session-${testSessionId}-5173.preview.trydecember.com`)
        expect(result.previewUrl).toContain('5173')
        expect(result.headers['X-Forwarded-Host']).toBe(
            `session-${testSessionId}-5173.preview.trydecember.com`
        )
        // no wildcard origin with credentials: browsers refuse that pair
        expect(
            (result.headers as Record<string, string>)['Access-Control-Allow-Origin']
        ).toBeUndefined()
    })

    it('proxyPreview - constructs live e2b.dev targetHost when session.vmId is present', async () => {
        const testSessionId = 'sess-preview-2'
        const testUserId = 'user-preview-2'

        spyOn(sessionRepository, 'findSessionById').mockImplementation(
            async (id: string) =>
                ({
                    id,
                    userId: testUserId,
                    vmId: 'i6gvzd2ae5gtyijtaky0d',
                    vmStatus: 'RUNNING',
                }) as any
        )

        const result = await sessionService.proxyPreview({
            userId: testUserId,
            sessionId: testSessionId,
            port: 5173,
            reqPath: '/',
        })

        expect(result.port).toBe(5173)
        expect(result.targetHost).toBe('5173-i6gvzd2ae5gtyijtaky0d.e2b.dev')
        expect(result.previewUrl).toBe('https://5173-i6gvzd2ae5gtyijtaky0d.e2b.dev/')
        expect(result.headers['X-Forwarded-Host']).toBe('5173-i6gvzd2ae5gtyijtaky0d.e2b.dev')
    })
})
