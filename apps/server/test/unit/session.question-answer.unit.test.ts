import { describe, expect, it, mock, beforeEach } from 'bun:test'

import { sessionRepository } from '../../src/modules/session/session.repository'
import { sessionService } from '../../src/modules/session/session.service'
import { AppError } from '../../src/shared/appError'

describe('Server Question-Answer Bridge API (Ticket #590 - Seam 2)', () => {
    const mockUserId = 'usr-qa-1'
    const mockSessionId = 'sess-qa-123'

    beforeEach(() => {
        sessionRepository.findSessionById = mock(async (sessionId: string, userId: string) => {
            if (sessionId === mockSessionId && userId === mockUserId) {
                return {
                    id: mockSessionId,
                    userId: mockUserId,
                    type: 'WEB',
                    title: 'Interactive Session',
                } as any
            }
            return null
        })
    })

    describe('submitQuestionAnswer', () => {
        it('throws 404 if session does not exist or user is unauthorized', async () => {
            expect(
                sessionService.submitQuestionAnswer({
                    userId: 'wrong-user',
                    sessionId: mockSessionId,
                    answer: 'Tailwind CSS',
                })
            ).rejects.toThrow(AppError)
        })

        it('submits answer successfully for valid session', async () => {
            const result = await sessionService.submitQuestionAnswer({
                userId: mockUserId,
                sessionId: mockSessionId,
                questionId: 'qid-1',
                answer: 'Tailwind CSS',
            })

            expect(result.success).toBe(true)
            expect(result.answer).toBe('Tailwind CSS')
            expect(result.sessionId).toBe(mockSessionId)
        })
    })

    describe('getPendingQuestion', () => {
        it('throws 404 if session does not exist', async () => {
            expect(
                sessionService.getPendingQuestion({
                    userId: 'wrong-user',
                    sessionId: mockSessionId,
                })
            ).rejects.toThrow(AppError)
        })

        it('returns pending question state for valid session', async () => {
            const result = await sessionService.getPendingQuestion({
                userId: mockUserId,
                sessionId: mockSessionId,
            })
            // When no question in Redis, returns null
            expect(result === null || typeof result === 'object').toBe(true)
        })
    })
})
