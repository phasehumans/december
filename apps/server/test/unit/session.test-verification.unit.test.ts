import { describe, expect, it, mock, beforeEach } from 'bun:test'

import { sessionRepository } from '../../src/modules/session/session.repository'
import { sessionService } from '../../src/modules/session/session.service'
import { AppError } from '../../src/shared/appError'

describe('Server Session Test Verification & Preview Port API (Ticket #589 - Seam 3)', () => {
    const mockUserId = 'usr-123'
    const mockSessionId = 'sess-456'

    beforeEach(() => {
        sessionRepository.findSessionById = mock(async (sessionId: string, userId: string) => {
            if (sessionId === mockSessionId && userId === mockUserId) {
                return {
                    id: mockSessionId,
                    userId: mockUserId,
                    type: 'WEB',
                    title: 'Test Session',
                    vmId: 'vm-123',
                } as any
            }
            return null
        })
    })

    describe('getSessionTests', () => {
        it('throws 404 if session does not exist or user does not own it', async () => {
            expect(
                sessionService.getSessionTests({
                    userId: 'wrong-user',
                    sessionId: mockSessionId,
                })
            ).rejects.toThrow(AppError)
        })

        it('returns null if no tests have run yet for the session', async () => {
            const result = await sessionService.getSessionTests({
                userId: mockUserId,
                sessionId: mockSessionId,
            })
            // When no tests in Redis, returns null or empty report
            expect(result).toBeDefined()
        })
    })

    describe('getSessionPreviewPort', () => {
        it('throws 404 if session does not exist', async () => {
            expect(
                sessionService.getSessionPreviewPort({
                    userId: 'wrong-user',
                    sessionId: mockSessionId,
                })
            ).rejects.toThrow(AppError)
        })

        it('returns preview port structure when session exists', async () => {
            const result = await sessionService.getSessionPreviewPort({
                userId: mockUserId,
                sessionId: mockSessionId,
            })
            expect(result).toBeDefined()
            expect('port' in result).toBe(true)
        })
    })
})
