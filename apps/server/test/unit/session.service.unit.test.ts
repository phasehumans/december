import { prisma } from '@december/database'
import { describe, it, expect, mock, afterEach, beforeEach } from 'bun:test'

import { sessionRepository } from '../../src/modules/session/session.repository'
import { sessionService } from '../../src/modules/session/session.service'
import { usageService } from '../../src/modules/usage/usage.service'
import { AppError } from '../../src/shared/appError'
import { appCache } from '../../src/shared/cache'

describe('Session Service - Unit Tests', () => {
    beforeEach(async () => {
        await appCache.clearAll()
    })
    const testUserId = '11111111-1111-1111-1111-111111111111'
    const otherUserId = '22222222-2222-2222-2222-222222222222'
    const testSessionId = '33333333-3333-3333-3333-333333333333'
    const testProjectId = '44444444-4444-4444-4444-444444444444'

    const originalFindSessionById = sessionRepository.findSessionById
    const originalCreateSession = sessionRepository.createSession
    const originalUpdateSession = sessionRepository.updateSession
    const originalFindManySessions = sessionRepository.findManySessions
    const originalFindSessionOwner = sessionRepository.findSessionOwner
    const originalCountPrismaSession = prisma.session.count
    const originalCreatePrismaMessage = prisma.message.create
    const originalBalance = usageService.hasMinimumBalance

    afterEach(() => {
        sessionRepository.findSessionById = originalFindSessionById
        sessionRepository.createSession = originalCreateSession
        sessionRepository.updateSession = originalUpdateSession
        sessionRepository.findManySessions = originalFindManySessions
        sessionRepository.findSessionOwner = originalFindSessionOwner
        prisma.session.count = originalCountPrismaSession
        prisma.message.create = originalCreatePrismaMessage
        usageService.hasMinimumBalance = originalBalance
    })

    describe('createSession', () => {
        it('should throw AppError 402 if user has insufficient balance (< $0.50)', async () => {
            const originalBalance = usageService.hasMinimumBalance
            usageService.hasMinimumBalance = mock(async () => false) as any

            try {
                await expect(
                    sessionService.createSession({
                        userId: testUserId,
                        title: 'Test Session',
                    })
                ).rejects.toThrow(
                    new AppError(
                        'Insufficient balance. A minimum balance of $0.50 is required to start a session.',
                        402
                    )
                )
            } finally {
                usageService.hasMinimumBalance = originalBalance
            }
        })

        it('should allow creating session when active sessions are below concurrency limit', async () => {
            const originalBalance = usageService.hasMinimumBalance
            const originalCount = prisma.session.count
            const originalCreateSession = sessionRepository.createSession
            usageService.hasMinimumBalance = mock(async () => true) as any
            prisma.session.count = mock(async () => 1) as any // 1 active session running
            sessionRepository.createSession = mock(async () => ({
                id: 'sess-concurrent-1',
                userId: testUserId,
                title: 'Concurrent Session',
                type: 'WEB',
                vmStatus: 'STOPPED',
                createdAt: new Date(),
                updatedAt: new Date(),
            })) as any

            try {
                const res = await sessionService.createSession({
                    userId: testUserId,
                    title: 'Concurrent Session',
                })
                expect(res.id).toBe('sess-concurrent-1')
            } finally {
                usageService.hasMinimumBalance = originalBalance
                prisma.session.count = originalCount
                sessionRepository.createSession = originalCreateSession
            }
        })

        it('should throw AppError 409 if active sessions reach or exceed per-user concurrency limit', async () => {
            const originalBalance = usageService.hasMinimumBalance
            const originalCount = prisma.session.count
            usageService.hasMinimumBalance = mock(async () => true) as any
            prisma.session.count = mock(async () => 3) as any // default limit is 3

            try {
                await expect(
                    sessionService.createSession({
                        userId: testUserId,
                        title: 'Test Session',
                    })
                ).rejects.toThrow(
                    new AppError('Maximum concurrent active sessions limit (3) reached', 409)
                )
            } finally {
                usageService.hasMinimumBalance = originalBalance
                prisma.session.count = originalCount
            }
        })

        it('should respect custom configured concurrency limit via environment variable', async () => {
            const originalBalance = usageService.hasMinimumBalance
            const originalCount = prisma.session.count
            const originalEnvLimit = process.env.MAX_CONCURRENT_SESSIONS_PER_USER
            process.env.MAX_CONCURRENT_SESSIONS_PER_USER = '5'
            usageService.hasMinimumBalance = mock(async () => true) as any
            prisma.session.count = mock(async () => 5) as any

            try {
                await expect(
                    sessionService.createSession({
                        userId: testUserId,
                        title: 'Test Session',
                    })
                ).rejects.toThrow(
                    new AppError('Maximum concurrent active sessions limit (5) reached', 409)
                )
            } finally {
                process.env.MAX_CONCURRENT_SESSIONS_PER_USER = originalEnvLimit
                usageService.hasMinimumBalance = originalBalance
                prisma.session.count = originalCount
            }
        })

        it('should create standalone session successfully', async () => {
            const originalBalance = usageService.hasMinimumBalance
            const originalCount = prisma.session.count
            const originalCreateSession = sessionRepository.createSession
            usageService.hasMinimumBalance = mock(async () => true) as any
            prisma.session.count = mock(async () => 0) as any
            sessionRepository.createSession = mock(async () => ({
                id: 'sess-123',
                userId: testUserId,
                title: 'Test Session',
                type: 'WEB',
                vmStatus: 'STOPPED',
                createdAt: new Date(),
                updatedAt: new Date(),
            })) as any

            try {
                const res = await sessionService.createSession({
                    userId: testUserId,
                    title: 'Test Session',
                })
                expect(res.id).toBe('sess-123')
            } finally {
                usageService.hasMinimumBalance = originalBalance
                prisma.session.count = originalCount
                sessionRepository.createSession = originalCreateSession
            }
        })

        it('should create session and initial message if prompt is provided', async () => {
            const originalBalance = usageService.hasMinimumBalance
            const originalCount = prisma.session.count
            const originalCreateSession = sessionRepository.createSession
            const originalCreateMessage = prisma.message.create

            usageService.hasMinimumBalance = mock(async () => true) as any
            prisma.session.count = mock(async () => 0) as any
            sessionRepository.createSession = mock(async (data: any) => ({
                id: testSessionId,
                ...data,
                createdAt: new Date(),
                updatedAt: new Date(),
            })) as any
            let createdMessageData: any = null
            prisma.message.create = mock(async ({ data }: any) => {
                createdMessageData = data
                return { id: 'msg-1', ...data }
            }) as any

            try {
                const session = await sessionService.createSession({
                    userId: testUserId,
                    title: 'New Chat Session',
                    prompt: 'Initial prompt message',
                })

                expect(session.id).toBe(testSessionId)
                expect(session.title).toBe('New Chat Session')
                expect(createdMessageData).not.toBeNull()
                expect(createdMessageData.content).toBe('Initial prompt message')
                expect(createdMessageData.role).toBe('USER')
            } finally {
                usageService.hasMinimumBalance = originalBalance
                prisma.session.count = originalCount
                sessionRepository.createSession = originalCreateSession
                prisma.message.create = originalCreateMessage
            }
        })

        it('should pass repository, branch, gitRef, and issueNumber to createSession', async () => {
            const originalBalance = usageService.hasMinimumBalance
            const originalCount = prisma.session.count
            const originalCreateSession = sessionRepository.createSession

            usageService.hasMinimumBalance = mock(async () => true) as any
            prisma.session.count = mock(async () => 0) as any
            let capturedCreateData: any = null
            sessionRepository.createSession = mock(async (data: any) => {
                capturedCreateData = data
                return {
                    id: testSessionId,
                    ...data,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                }
            }) as any

            try {
                const session = await sessionService.createSession({
                    userId: testUserId,
                    repoUrl: 'https://github.com/phasehumans/december.git',
                    branch: 'feat/test',
                    gitRef: 'refs/heads/feat/test',
                    issueNumber: 583,
                })

                expect(session.id).toBe(testSessionId)
                expect(capturedCreateData).not.toBeNull()
                expect(capturedCreateData.repoUrl).toBe(
                    'https://github.com/phasehumans/december.git'
                )
                expect(capturedCreateData.branch).toBe('feat/test')
                expect(capturedCreateData.gitRef).toBe('refs/heads/feat/test')
                expect(capturedCreateData.issueNumber).toBe(583)
                expect(capturedCreateData.githubRepoOwner).toBe('phasehumans')
                expect(capturedCreateData.githubRepoName).toBe('december')
                expect(capturedCreateData.title).toBe('december #583')
            } finally {
                usageService.hasMinimumBalance = originalBalance
                prisma.session.count = originalCount
                sessionRepository.createSession = originalCreateSession
            }
        })
    })

    describe('getUserSessions', () => {
        it('should list sessions and format PR, author, and fallback titles correctly', async () => {
            const originalFindMany = sessionRepository.findManySessions
            sessionRepository.findManySessions = mock(async () => ({
                sessions: [
                    {
                        id: testSessionId,
                        title: 'Custom Title',
                        type: 'WEB',
                        isArchived: false,
                        tags: ['ai'],
                        createdAt: new Date(),
                        updatedAt: new Date(),
                        projectId: testProjectId,
                        project: { id: testProjectId, name: 'Project 1' },
                        messages: [{ content: 'Hello AI' }],
                        user: {
                            githubUsername: 'testuser',
                            email: 'test@example.com',
                            name: 'Test User',
                        },
                        reviews: [
                            {
                                prUrl: 'https://github.com/repo/pull/42',
                                prTitle: 'PR 42 Title',
                                branchName: 'feature-branch',
                                additions: 100,
                                deletions: 20,
                                repoName: 'test-repo',
                            },
                        ],
                    },
                    {
                        id: 'sess-2',
                        title: null,
                        type: 'CLI',
                        isArchived: true,
                        tags: [],
                        createdAt: new Date(),
                        updatedAt: new Date(),
                        projectId: null,
                        project: null,
                        messages: [
                            {
                                content:
                                    'First message text that is quite long and needs truncation',
                            },
                        ],
                        user: { githubUsername: null, email: 'fallback@example.com', name: null },
                        reviews: [],
                    },
                ],
                pagination: { total: 2, page: 1, limit: 50, totalPages: 1 },
            })) as any

            try {
                const result = await sessionService.getUserSessions({ userId: testUserId })

                expect(result.sessions).toHaveLength(2)
                expect(result.sessions[0]?.title).toBe('Custom Title')
                expect(result.sessions[0]?.prNumber).toBe(42)
                expect(result.sessions[0]?.prState).toBe('open')
                expect(result.sessions[0]?.createdBy).toBe('@testuser')

                expect(result.sessions[1]?.title).toContain('First message text')
                expect(result.sessions[1]?.createdBy).toBe('@fallback')
                expect(result.sessions[1]?.createdByName).toBe('fallback@example.com')
            } finally {
                sessionRepository.findManySessions = originalFindMany
            }
        })
    })

    describe('getSession', () => {
        it('should throw AppError 404 if session not found', async () => {
            const originalFind = sessionRepository.findSessionById
            sessionRepository.findSessionById = mock(async (sessionId: string, userId: string) => {
                if (sessionId === 'nonexistent') return null
                return originalFind(sessionId, userId)
            }) as any

            try {
                await expect(
                    sessionService.getSession({ userId: testUserId, sessionId: 'nonexistent' })
                ).rejects.toThrow(new AppError('Session not found', 404))
            } finally {
                sessionRepository.findSessionById = originalFind
            }
        })

        it('should return session with formatted chatMessages', async () => {
            const uniqueSessionId = `unit-test-session-${Date.now()}`
            const originalFind = sessionRepository.findSessionById
            sessionRepository.findSessionById = mock(async (sessionId: string, userId: string) => {
                if (sessionId === uniqueSessionId) {
                    return {
                        id: uniqueSessionId,
                        userId: testUserId,
                        title: 'Existing Session',
                        messages: [
                            {
                                id: 'msg-1',
                                role: 'USER',
                                content: 'test',
                                status: 'done',
                                sequence: 1,
                                blocks: { foo: 'bar' },
                                createdAt: new Date(),
                                updatedAt: new Date(),
                            },
                        ],
                    }
                }
                return originalFind(sessionId, userId)
            }) as any

            try {
                const result = await sessionService.getSession({
                    userId: testUserId,
                    sessionId: uniqueSessionId,
                })

                expect(result.session.id).toBe(uniqueSessionId)
                expect(result.chatMessages).toHaveLength(1)
                expect(result.chatMessages[0]?.blocks).toEqual({ foo: 'bar' })
            } finally {
                sessionRepository.findSessionById = originalFind
            }
        })
    })

    describe('renameSession, archiveSession, unarchiveSession, updateSessionTags', () => {
        it('renameSession throws 404 if session not found', async () => {
            const originalFind = sessionRepository.findSessionById
            sessionRepository.findSessionById = mock(async () => null) as any

            try {
                await expect(
                    sessionService.renameSession({
                        userId: testUserId,
                        sessionId: testSessionId,
                        title: 'New Title',
                    })
                ).rejects.toThrow(new AppError('Session not found', 404))
            } finally {
                sessionRepository.findSessionById = originalFind
            }
        })

        it('renameSession updates title when session is found', async () => {
            const originalFind = sessionRepository.findSessionById
            const originalUpdate = sessionRepository.updateSession
            sessionRepository.findSessionById = mock(async () => ({
                id: testSessionId,
                userId: testUserId,
            })) as any
            sessionRepository.updateSession = mock(async (id, uId, data: any) => ({
                id,
                ...data,
            })) as any

            try {
                const updated = await sessionService.renameSession({
                    userId: testUserId,
                    sessionId: testSessionId,
                    title: 'New Title',
                })
                expect(updated.title).toBe('New Title')
            } finally {
                sessionRepository.findSessionById = originalFind
                sessionRepository.updateSession = originalUpdate
            }
        })

        it('archiveSession and unarchiveSession throw 404 when session not found', async () => {
            const originalFind = sessionRepository.findSessionById
            sessionRepository.findSessionById = mock(async () => null) as any

            try {
                await expect(
                    sessionService.archiveSession({ userId: testUserId, sessionId: testSessionId })
                ).rejects.toThrow(new AppError('Session not found', 404))
                await expect(
                    sessionService.unarchiveSession({
                        userId: testUserId,
                        sessionId: testSessionId,
                    })
                ).rejects.toThrow(new AppError('Session not found', 404))
            } finally {
                sessionRepository.findSessionById = originalFind
            }
        })

        it('updateSessionTags limits tags to at most 1 tag', async () => {
            const originalFind = sessionRepository.findSessionById
            const originalUpdate = sessionRepository.updateSession
            sessionRepository.findSessionById = mock(async () => ({
                id: testSessionId,
                userId: testUserId,
            })) as any
            let savedTags: string[] = []
            sessionRepository.updateSession = mock(async (id, uId, data: any) => {
                savedTags = data.tags
                return { id, ...data }
            }) as any

            try {
                await sessionService.updateSessionTags({
                    userId: testUserId,
                    sessionId: testSessionId,
                    tags: ['first-tag', 'second-tag'],
                })
                expect(savedTags).toEqual(['first-tag'])
            } finally {
                sessionRepository.findSessionById = originalFind
                sessionRepository.updateSession = originalUpdate
            }
        })
    })

    describe('deleteSession', () => {
        it('throws 404 if session does not exist', async () => {
            const originalFindOwner = sessionRepository.findSessionOwner
            sessionRepository.findSessionOwner = mock(async () => null) as any

            try {
                await expect(
                    sessionService.deleteSession({ userId: testUserId, sessionId: testSessionId })
                ).rejects.toThrow(new AppError('Session not found', 404))
            } finally {
                sessionRepository.findSessionOwner = originalFindOwner
            }
        })

        it('throws 403 if non-creator tries to delete session', async () => {
            const originalFindOwner = sessionRepository.findSessionOwner
            sessionRepository.findSessionOwner = mock(async () => ({
                id: testSessionId,
                userId: otherUserId,
            })) as any

            try {
                await expect(
                    sessionService.deleteSession({ userId: testUserId, sessionId: testSessionId })
                ).rejects.toThrow(
                    new AppError('Only the session creator can delete this session', 403)
                )
            } finally {
                sessionRepository.findSessionOwner = originalFindOwner
            }
        })

        it('deletes session successfully when called by owner', async () => {
            const originalFindOwner = sessionRepository.findSessionOwner
            const originalDelete = sessionRepository.deleteSession
            sessionRepository.findSessionOwner = mock(async () => ({
                id: testSessionId,
                userId: testUserId,
            })) as any
            sessionRepository.deleteSession = mock(async () => ({ id: testSessionId })) as any

            try {
                const result = await sessionService.deleteSession({
                    userId: testUserId,
                    sessionId: testSessionId,
                })
                expect(result.message).toBe('session deleted successfully')
            } finally {
                sessionRepository.findSessionOwner = originalFindOwner
                sessionRepository.deleteSession = originalDelete
            }
        })
    })

    describe('caching behavior', () => {
        it('should cache getUserSessions and invalidate on renameSession', async () => {
            let repositoryCallCount = 0
            const originalFindMany = sessionRepository.findManySessions
            const originalFindById = sessionRepository.findSessionById
            const originalUpdate = sessionRepository.updateSession

            sessionRepository.findManySessions = (async () => {
                repositoryCallCount++
                return {
                    sessions: [
                        {
                            id: testSessionId,
                            title: 'Original Title',
                            type: 'WEB',
                            isArchived: false,
                            tags: [],
                            createdAt: new Date(),
                            updatedAt: new Date(),
                            messages: [],
                            user: { githubUsername: 'testuser' },
                        },
                    ],
                    pagination: { page: 1, limit: 50, total: 1, totalPages: 1 },
                }
            }) as any

            sessionRepository.findSessionById = (async () => ({
                id: testSessionId,
                userId: testUserId,
                title: 'Original Title',
            })) as any

            sessionRepository.updateSession = (async (_id, _userId, data) => ({
                id: testSessionId,
                ...data,
            })) as any

            try {
                // First call: hits repository
                const res1 = await sessionService.getUserSessions({ userId: testUserId })
                expect(res1.sessions).toHaveLength(1)
                expect(repositoryCallCount).toBe(1)

                // Second call: hits cache
                const res2 = await sessionService.getUserSessions({ userId: testUserId })
                expect(res2.sessions).toHaveLength(1)
                expect(repositoryCallCount).toBe(1)

                // Rename session: invalidates cache
                await sessionService.renameSession({
                    userId: testUserId,
                    sessionId: testSessionId,
                    title: 'New Title',
                })

                // Third call: cache was invalidated, hits repository
                const res3 = await sessionService.getUserSessions({ userId: testUserId })
                expect(res3.sessions).toHaveLength(1)
                expect(repositoryCallCount).toBe(2)
            } finally {
                sessionRepository.findManySessions = originalFindMany
                sessionRepository.findSessionById = originalFindById
                sessionRepository.updateSession = originalUpdate
            }
        })
    })

    describe('getSessionDiff', () => {
        it('should throw AppError 404 if session is not found', async () => {
            sessionRepository.findSessionById = mock(async () => null) as any
            await expect(
                sessionService.getSessionDiff({
                    userId: testUserId,
                    sessionId: testSessionId,
                })
            ).rejects.toThrow('Session not found')
        })

        it('should return empty gitStatus and gitDiff when session exists but no cached diff is present', async () => {
            sessionRepository.findSessionById = mock(async () => ({
                id: testSessionId,
                userId: testUserId,
            })) as any

            const res = await sessionService.getSessionDiff({
                userId: testUserId,
                sessionId: testSessionId,
            })
            expect(res).toEqual({
                gitStatus: '',
                gitDiff: '',
            })
        })
    })

    describe('getSessionFileTree', () => {
        it('should throw AppError 404 if session is not found', async () => {
            sessionRepository.findSessionById = mock(async () => null) as any
            await expect(
                sessionService.getSessionFileTree({
                    userId: testUserId,
                    sessionId: testSessionId,
                })
            ).rejects.toThrow('Session not found')
        })

        it('should return files array gracefully on valid session', async () => {
            sessionRepository.findSessionById = mock(async () => ({
                id: testSessionId,
                userId: testUserId,
            })) as any

            const res = await sessionService.getSessionFileTree({
                userId: testUserId,
                sessionId: testSessionId,
            })
            expect(res).toBeDefined()
            expect(Array.isArray(res.files)).toBe(true)
        })
    })

    describe('getSessionFileContent', () => {
        it('should throw AppError 404 if session is not found', async () => {
            sessionRepository.findSessionById = mock(async () => null) as any
            await expect(
                sessionService.getSessionFileContent({
                    userId: testUserId,
                    sessionId: testSessionId,
                    path: 'src/app.ts',
                })
            ).rejects.toThrow('Session not found')
        })

        it('should return file path and empty content when S3 is unavailable or file missing', async () => {
            sessionRepository.findSessionById = mock(async () => ({
                id: testSessionId,
                userId: testUserId,
            })) as any

            const res = await sessionService.getSessionFileContent({
                userId: testUserId,
                sessionId: testSessionId,
                path: 'src/app.ts',
            })
            expect(res).toEqual({
                path: 'src/app.ts',
                content: '',
            })
        })
    })

    describe('getSessionPullRequests', () => {
        it('should throw AppError 404 if session is not found', async () => {
            sessionRepository.findSessionById = mock(async () => null) as any
            await expect(
                (sessionService as any).getSessionPullRequests({
                    userId: testUserId,
                    sessionId: testSessionId,
                })
            ).rejects.toThrow('Session not found')
        })

        it('should return null pullRequest when no PR is cached in Redis', async () => {
            sessionRepository.findSessionById = mock(async () => ({
                id: testSessionId,
                userId: testUserId,
            })) as any

            const res = await (sessionService as any).getSessionPullRequests({
                userId: testUserId,
                sessionId: testSessionId,
            })
            expect(res).toEqual({ pullRequest: null })
        })
    })

    describe('getSessionPlan', () => {
        it('should throw AppError 404 if session is not found', async () => {
            sessionRepository.findSessionById = mock(async () => null) as any
            await expect(
                (sessionService as any).getSessionPlan({
                    userId: testUserId,
                    sessionId: testSessionId,
                })
            ).rejects.toThrow('Session not found')
        })

        it('should return baseline plan with 5 canonical phases when session exists', async () => {
            sessionRepository.findSessionById = mock(async () => ({
                id: testSessionId,
                userId: testUserId,
            })) as any

            const res = await (sessionService as any).getSessionPlan({
                userId: testUserId,
                sessionId: testSessionId,
            })
            expect(res.plan).toBeDefined()
            expect(res.plan.sessionId).toBe(testSessionId)
            expect(res.plan.milestones).toHaveLength(5)
            expect(res.plan.milestones.map((m: any) => m.id)).toEqual([
                'reproduce',
                'locate',
                'implement',
                'test',
                'pr',
            ])
        })
    })
})
