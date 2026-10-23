import { describe, it, expect } from 'bun:test'

import {
    getSessionsSchema,
    createSessionSchema,
    getSessionByIdSchema,
    renameSessionParamsSchema,
    renameSessionBodySchema,
    archiveSessionParamsSchema,
    unarchiveSessionParamsSchema,
    updateSessionTagsParamsSchema,
    updateSessionTagsBodySchema,
    deleteSessionParamsSchema,
    disconnectSessionParamsSchema,
    rehydrateSessionParamsSchema,
    proxyPreviewParamsSchema,
    getSessionDiffParamsSchema,
    getSessionFileTreeParamsSchema,
    getSessionFileContentParamsSchema,
    getSessionFileContentQuerySchema,
    getSessionPullRequestsParamsSchema,
    getSessionPlanParamsSchema,
    getSessionTestsParamsSchema,
    getSessionPreviewPortParamsSchema,
    submitQuestionAnswerParamsSchema,
    submitQuestionAnswerBodySchema,
    getPendingQuestionParamsSchema,
    getSessionDesktopViewportParamsSchema,
} from '../../src/modules/session/session.schema'

describe('Session Schemas - Unit Tests', () => {
    const validUuid = '123e4567-e89b-12d3-a456-426614174000'

    describe('getSessionsSchema', () => {
        it('should pass with empty query', () => {
            const result = getSessionsSchema.parse({})
            expect(result).toEqual({})
        })

        it('should coerce and validate query filters', () => {
            const result = getSessionsSchema.parse({
                type: 'WEB',
                isArchived: 'true',
                tags: 'frontend,react',
                sortBy: 'createdAt',
                sortOrder: 'desc',
                search: 'test chat',
                page: '2',
                limit: '25',
            })
            expect(result.type).toBe('WEB')
            expect(result.isArchived).toBe(true)
            expect(result.tags).toBe('frontend,react')
            expect(result.sortBy).toBe('createdAt')
            expect(result.sortOrder).toBe('desc')
            expect(result.search).toBe('test chat')
            expect(result.page).toBe(2)
            expect(result.limit).toBe(25)
        })

        it('should parse isArchived=false correctly', () => {
            const result = getSessionsSchema.parse({ isArchived: 'false' })
            expect(result.isArchived).toBe(false)
        })

        it('should fail with invalid session type', () => {
            expect(() => getSessionsSchema.parse({ type: 'INVALID' })).toThrow()
        })

        it('should fail with invalid page or limit', () => {
            expect(() => getSessionsSchema.parse({ page: 0 })).toThrow()
            expect(() => getSessionsSchema.parse({ limit: 101 })).toThrow()
        })
    })

    describe('createSessionSchema', () => {
        it('should pass with valid optional fields', () => {
            const result = createSessionSchema.parse({
                title: 'My Project Session',
                projectId: validUuid,
                type: 'WEB',
                prompt: 'Build a landing page',
                repoUrl: 'https://github.com/phasehumans/december',
                branch: 'main',
                gitRef: 'refs/heads/main',
                issueNumber: 583,
            })
            expect(result.title).toBe('My Project Session')
            expect(result.projectId).toBe(validUuid)
            expect(result.type).toBe('WEB')
            expect(result.prompt).toBe('Build a landing page')
            expect(result.repoUrl).toBe('https://github.com/phasehumans/december')
            expect(result.branch).toBe('main')
            expect(result.gitRef).toBe('refs/heads/main')
            expect(result.issueNumber).toBe(583)
        })

        it('should fail with invalid repoUrl or issueNumber', () => {
            expect(() => createSessionSchema.parse({ repoUrl: 'not-a-url' })).toThrow()
            expect(() => createSessionSchema.parse({ issueNumber: -1 })).toThrow()
            expect(() => createSessionSchema.parse({ issueNumber: 0 })).toThrow()
        })

        it('should pass with empty payload', () => {
            const result = createSessionSchema.parse({})
            expect(result).toEqual({})
        })

        it('should fail with title exceeding 100 characters', () => {
            expect(() => createSessionSchema.parse({ title: 'a'.repeat(101) })).toThrow()
        })

        it('should fail with invalid projectId UUID', () => {
            expect(() => createSessionSchema.parse({ projectId: 'not-a-uuid' })).toThrow()
        })

        it('should fail with empty prompt string', () => {
            expect(() => createSessionSchema.parse({ prompt: '' })).toThrow()
        })
    })

    describe('UUID Params Schemas', () => {
        const schemas = [
            { name: 'getSessionByIdSchema', schema: getSessionByIdSchema },
            { name: 'renameSessionParamsSchema', schema: renameSessionParamsSchema },
            { name: 'archiveSessionParamsSchema', schema: archiveSessionParamsSchema },
            { name: 'unarchiveSessionParamsSchema', schema: unarchiveSessionParamsSchema },
            { name: 'updateSessionTagsParamsSchema', schema: updateSessionTagsParamsSchema },
            { name: 'deleteSessionParamsSchema', schema: deleteSessionParamsSchema },
            { name: 'disconnectSessionParamsSchema', schema: disconnectSessionParamsSchema },
            { name: 'rehydrateSessionParamsSchema', schema: rehydrateSessionParamsSchema },
            { name: 'getSessionDiffParamsSchema', schema: getSessionDiffParamsSchema },
            { name: 'getSessionFileTreeParamsSchema', schema: getSessionFileTreeParamsSchema },
            {
                name: 'getSessionFileContentParamsSchema',
                schema: getSessionFileContentParamsSchema,
            },
            {
                name: 'getSessionPullRequestsParamsSchema',
                schema: getSessionPullRequestsParamsSchema,
            },
            {
                name: 'getSessionPlanParamsSchema',
                schema: getSessionPlanParamsSchema,
            },
            {
                name: 'getSessionDesktopViewportParamsSchema',
                schema: getSessionDesktopViewportParamsSchema,
            },
        ]

        for (const { name, schema } of schemas) {
            it(`${name} - should pass with valid UUID`, () => {
                const result = schema.parse({ id: validUuid })
                expect(result.id).toBe(validUuid)
            })

            it(`${name} - should fail with invalid UUID`, () => {
                expect(() => schema.parse({ id: 'invalid-id' })).toThrow()
            })
        }
    })

    describe('getSessionFileContentQuerySchema', () => {
        it('should pass with valid non-empty path', () => {
            const result = getSessionFileContentQuerySchema.parse({ path: 'src/index.ts' })
            expect(result.path).toBe('src/index.ts')
        })

        it('should fail with empty path', () => {
            expect(() => getSessionFileContentQuerySchema.parse({ path: '' })).toThrow()
        })
    })

    describe('renameSessionBodySchema', () => {
        it('should pass with valid title', () => {
            const result = renameSessionBodySchema.parse({ title: 'Updated Title' })
            expect(result.title).toBe('Updated Title')
        })

        it('should fail with empty title', () => {
            expect(() => renameSessionBodySchema.parse({ title: '' })).toThrow()
        })

        it('should fail with title exceeding 100 chars', () => {
            expect(() => renameSessionBodySchema.parse({ title: 'a'.repeat(101) })).toThrow()
        })
    })

    describe('updateSessionTagsBodySchema', () => {
        it('should pass with empty array or single tag', () => {
            expect(updateSessionTagsBodySchema.parse({ tags: [] })).toEqual({ tags: [] })
            expect(updateSessionTagsBodySchema.parse({ tags: ['backend'] })).toEqual({
                tags: ['backend'],
            })
        })

        it('should fail if more than 1 tag is provided', () => {
            expect(() => updateSessionTagsBodySchema.parse({ tags: ['tag1', 'tag2'] })).toThrow(
                'Only one tag is allowed per session'
            )
        })

        it('should fail if tag exceeds 30 characters', () => {
            expect(() => updateSessionTagsBodySchema.parse({ tags: ['a'.repeat(31)] })).toThrow()
        })
    })

    describe('proxyPreviewParamsSchema', () => {
        it('should pass and coerce valid port number', () => {
            const result = proxyPreviewParamsSchema.parse({ id: validUuid, port: '3000' })
            expect(result.id).toBe(validUuid)
            expect(result.port).toBe(3000)
        })

        it('should fail if port is out of range', () => {
            expect(() => proxyPreviewParamsSchema.parse({ id: validUuid, port: '0' })).toThrow()
            expect(() => proxyPreviewParamsSchema.parse({ id: validUuid, port: '65536' })).toThrow()
        })
    })

    describe('getSessionTestsParamsSchema & getSessionPreviewPortParamsSchema', () => {
        it('should validate valid UUID session id', () => {
            expect(getSessionTestsParamsSchema.parse({ id: validUuid }).id).toBe(validUuid)
            expect(getSessionPreviewPortParamsSchema.parse({ id: validUuid }).id).toBe(validUuid)
        })

        it('should fail if session id is invalid', () => {
            expect(() => getSessionTestsParamsSchema.parse({ id: 'invalid-id' })).toThrow()
            expect(() => getSessionPreviewPortParamsSchema.parse({ id: 'invalid-id' })).toThrow()
        })
    })

    describe('submitQuestionAnswer & getPendingQuestion schemas', () => {
        it('should validate submitQuestionAnswer with single or multiple answers', () => {
            expect(submitQuestionAnswerParamsSchema.parse({ id: validUuid }).id).toBe(validUuid)

            const body1 = submitQuestionAnswerBodySchema.parse({
                questionId: 'qid-1',
                answer: 'Option A',
            })
            expect(body1.answer).toBe('Option A')

            const body2 = submitQuestionAnswerBodySchema.parse({
                answer: ['Option A', 'Option B'],
            })
            expect(body2.answer).toEqual(['Option A', 'Option B'])
        })

        it('should validate getPendingQuestion schema', () => {
            expect(getPendingQuestionParamsSchema.parse({ id: validUuid }).id).toBe(validUuid)
            expect(() => getPendingQuestionParamsSchema.parse({ id: 'bad' })).toThrow()
        })
    })
})
