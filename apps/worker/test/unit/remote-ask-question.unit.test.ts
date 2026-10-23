import { describe, expect, it, mock } from 'bun:test'

import { RemotePlatformAdapter } from '../../src/remote-operations'

describe('RemotePlatformAdapter UI ask_question Bridge (Ticket #590 - Seam 1)', () => {
    it('publishes AskQuestionPrompt event to Redis and resolves when answer is received', async () => {
        const sessionId = 'sess-question-123'
        const publishedEvents: Array<{ channel: string; message: string }> = []
        let messageHandler: ((channel: string, message: string) => void) | null = null

        const mockRedis = {
            status: 'ready',
            publish: mock(async (channel: string, message: string) => {
                publishedEvents.push({ channel, message })
            }),
            set: mock(async () => 'OK'),
            del: mock(async () => 1),
            duplicate: () => ({
                status: 'ready',
                subscribe: mock(async (_channel: string, cb?: any) => {
                    if (cb) cb(null, 1)
                }),
                unsubscribe: mock(async () => 1),
                quit: mock(async () => 'OK'),
                on: mock((event: string, handler: any) => {
                    if (event === 'message') {
                        messageHandler = handler
                    }
                }),
            }),
        }

        const adapter = new RemotePlatformAdapter('mock-vm-1', {
            sessionId,
            redisClient: mockRedis as any,
            timeoutMs: 2000,
        })

        const questions = [
            {
                question: 'Which styling solution do you prefer?',
                options: ['Tailwind CSS', 'CSS Modules', 'Styled Components'],
                is_multi_select: false,
            },
        ]

        // Start asking question in background
        const questionPromise = adapter.ui.askQuestion(questions)
        await new Promise((r) => setTimeout(r, 10))

        // Verify AskQuestionPrompt event was published to session_events
        expect(mockRedis.publish).toHaveBeenCalled()
        const promptEvent = publishedEvents.find((e) => e.channel === `session_events:${sessionId}`)
        expect(promptEvent).toBeDefined()

        const parsedPrompt = JSON.parse(promptEvent!.message)
        expect(parsedPrompt.type).toBe('AskQuestionPrompt')
        expect(parsedPrompt.sessionId).toBe(sessionId)
        expect(parsedPrompt.questionId).toBeDefined()
        expect(parsedPrompt.questions).toEqual(questions)

        // Simulate user answering through Redis answer channel
        expect(messageHandler).not.toBeNull()
        messageHandler!(
            `session_question_answer:${sessionId}`,
            JSON.stringify({
                sessionId,
                questionId: parsedPrompt.questionId,
                answer: 'Tailwind CSS',
            })
        )

        const result = await questionPromise
        expect(result).toBe('Tailwind CSS')
    })

    it('formats multiple selected options as comma-separated string', async () => {
        const sessionId = 'sess-multi-select'
        let messageHandler: ((channel: string, message: string) => void) | null = null

        const mockRedis = {
            status: 'ready',
            publish: mock(async () => 1),
            set: mock(async () => 'OK'),
            del: mock(async () => 1),
            duplicate: () => ({
                status: 'ready',
                subscribe: mock(async () => 1),
                unsubscribe: mock(async () => 1),
                quit: mock(async () => 'OK'),
                on: mock((event: string, handler: any) => {
                    if (event === 'message') messageHandler = handler
                }),
            }),
        }

        const adapter = new RemotePlatformAdapter('mock-vm-2', {
            sessionId,
            redisClient: mockRedis as any,
            timeoutMs: 2000,
        })

        const questions = [
            {
                question: 'Select components to generate:',
                options: ['Header', 'Sidebar', 'Footer'],
                is_multi_select: true,
            },
        ]

        const questionPromise = adapter.ui.askQuestion(questions)
        await new Promise((r) => setTimeout(r, 10))

        messageHandler!(
            `session_question_answer:${sessionId}`,
            JSON.stringify({
                sessionId,
                answer: ['Header', 'Footer'],
            })
        )

        const result = await questionPromise
        expect(result).toBe('Header, Footer')
    })

    it('falls back gracefully to first option when redis is unavailable', async () => {
        const adapter = new RemotePlatformAdapter('mock-vm-no-redis', {
            timeoutMs: 100,
        })

        const questions = [
            {
                question: 'Choose database',
                options: ['(Recommended) PostgreSQL', 'SQLite'],
            },
        ]

        const result = await adapter.ui.askQuestion(questions)
        expect(result).toBe('(Recommended) PostgreSQL')
    })
})
