import { describe, expect, it, mock, beforeEach } from 'bun:test'

import { sessionRepository } from '../../src/modules/session/session.repository'
import { sessionService } from '../../src/modules/session/session.service'
import { AppError } from '../../src/shared/appError'

describe('Server Session Desktop Viewport API (Ticket #591 - Seam 2)', () => {
    const mockUserId = 'usr-viewport-1'
    const mockSessionId = 'sess-viewport-123'

    beforeEach(() => {
        sessionRepository.findSessionById = mock(async (sessionId: string, userId: string) => {
            if (sessionId === mockSessionId && userId === mockUserId) {
                return {
                    id: mockSessionId,
                    userId: mockUserId,
                    type: 'WEB',
                    title: 'Desktop Viewport Session',
                } as any
            }
            return null
        })
    })

    describe('getSessionDesktopViewport', () => {
        it('throws 404 if session does not exist or user is unauthorized', async () => {
            expect(
                sessionService.getSessionDesktopViewport({
                    userId: 'wrong-user',
                    sessionId: mockSessionId,
                })
            ).rejects.toThrow(AppError)
        })

        it('returns null viewport when no viewport is cached in Redis', async () => {
            const result = await sessionService.getSessionDesktopViewport({
                userId: mockUserId,
                sessionId: mockSessionId,
            })

            expect(result).toBeDefined()
            expect(result.viewport).toBeNull()
        })
    })
})
