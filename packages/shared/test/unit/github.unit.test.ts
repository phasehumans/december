import { describe, expect, it } from 'bun:test'

import {
    createCommentReaction,
    createIssueComment,
    createPullRequest,
    extractBotMention,
    isAuthorizedGithubSender,
} from '../../src/utils/github'

describe('GitHub Utils - Unit Tests', () => {
    describe('extractBotMention', () => {
        it('returns isMentioned: false if bot is not mentioned in comment', () => {
            const res = extractBotMention('hello there, this is a normal comment')
            expect(res.isMentioned).toBe(false)
            expect(res.instruction).toBe('')
        })

        it('detects @december and extracts the instruction', () => {
            const res = extractBotMention('@december fix the bug in session handling and add tests')
            expect(res.isMentioned).toBe(true)
            expect(res.instruction).toBe('fix the bug in session handling and add tests')
        })

        it('handles case-insensitive mention and whitespace', () => {
            const res = extractBotMention('  @December   please refactor this module  ')
            expect(res.isMentioned).toBe(true)
            expect(res.instruction).toBe('please refactor this module')
        })

        it('provides default instruction if comment only contains mention', () => {
            const res = extractBotMention('@december')
            expect(res.isMentioned).toBe(true)
            expect(res.instruction).toBe(
                'Fix the issue described in the issue description and ensure tests pass.'
            )
        })
    })

    describe('isAuthorizedGithubSender', () => {
        it('returns true for OWNER, MEMBER, and COLLABORATOR', () => {
            expect(isAuthorizedGithubSender('OWNER')).toBe(true)
            expect(isAuthorizedGithubSender('MEMBER')).toBe(true)
            expect(isAuthorizedGithubSender('COLLABORATOR')).toBe(true)
            expect(isAuthorizedGithubSender('owner')).toBe(true)
            expect(isAuthorizedGithubSender('member')).toBe(true)
            expect(isAuthorizedGithubSender('collaborator')).toBe(true)
        })

        it('returns false for NONE, CONTRIBUTOR, FIRST_TIMER, or undefined', () => {
            expect(isAuthorizedGithubSender('NONE')).toBe(false)
            expect(isAuthorizedGithubSender('CONTRIBUTOR')).toBe(false)
            expect(isAuthorizedGithubSender('FIRST_TIMER')).toBe(false)
            expect(isAuthorizedGithubSender('FIRST_TIME_CONTRIBUTOR')).toBe(false)
            expect(isAuthorizedGithubSender(undefined)).toBe(false)
            expect(isAuthorizedGithubSender(null)).toBe(false)
        })
    })

    describe('createCommentReaction', () => {
        it('makes POST request to GitHub reactions endpoint', async () => {
            const originalFetch = globalThis.fetch
            let capturedUrl = ''
            let capturedOptions: any = null

            globalThis.fetch = (async (url: string | URL | Request, options?: any) => {
                capturedUrl = url.toString()
                capturedOptions = options
                return new Response(JSON.stringify({ id: 1, content: 'eyes' }), { status: 201 })
            }) as any

            try {
                const res = await createCommentReaction({
                    token: 'ghs_test123',
                    owner: 'testorg',
                    repo: 'testrepo',
                    commentId: 456,
                    reaction: 'eyes',
                })

                expect(capturedUrl).toBe(
                    'https://api.github.com/repos/testorg/testrepo/issues/comments/456/reactions'
                )
                expect(capturedOptions.method).toBe('POST')
                expect(capturedOptions.headers.Authorization).toBe('Bearer ghs_test123')
                expect(JSON.parse(capturedOptions.body)).toEqual({ content: 'eyes' })
                expect(res.content).toBe('eyes')
            } finally {
                globalThis.fetch = originalFetch
            }
        })
    })

    describe('createIssueComment', () => {
        it('makes POST request to GitHub issue comments endpoint', async () => {
            const originalFetch = globalThis.fetch
            let capturedUrl = ''
            let capturedOptions: any = null

            globalThis.fetch = (async (url: string | URL | Request, options?: any) => {
                capturedUrl = url.toString()
                capturedOptions = options
                return new Response(JSON.stringify({ id: 789, body: 'Hello' }), { status: 201 })
            }) as any

            try {
                const res = await createIssueComment({
                    token: 'ghs_test123',
                    owner: 'testorg',
                    repo: 'testrepo',
                    issueNumber: 42,
                    body: 'Hello',
                })

                expect(capturedUrl).toBe(
                    'https://api.github.com/repos/testorg/testrepo/issues/42/comments'
                )
                expect(capturedOptions.method).toBe('POST')
                expect(capturedOptions.headers.Authorization).toBe('Bearer ghs_test123')
                expect(JSON.parse(capturedOptions.body)).toEqual({ body: 'Hello' })
                expect(res.id).toBe(789)
            } finally {
                globalThis.fetch = originalFetch
            }
        })
    })

    describe('createPullRequest', () => {
        it('makes POST request to GitHub pulls endpoint', async () => {
            const originalFetch = globalThis.fetch
            let capturedUrl = ''
            let capturedOptions: any = null

            globalThis.fetch = (async (url: string | URL | Request, options?: any) => {
                capturedUrl = url.toString()
                capturedOptions = options
                return new Response(
                    JSON.stringify({
                        number: 99,
                        html_url: 'https://github.com/testorg/testrepo/pull/99',
                    }),
                    { status: 201 }
                )
            }) as any

            try {
                const res = await createPullRequest({
                    token: 'ghs_test123',
                    owner: 'testorg',
                    repo: 'testrepo',
                    title: 'fix: resolve issue #42',
                    head: 'december/issue-42',
                    base: 'main',
                    body: 'Fix details',
                })

                expect(capturedUrl).toBe('https://api.github.com/repos/testorg/testrepo/pulls')
                expect(capturedOptions.method).toBe('POST')
                expect(capturedOptions.headers.Authorization).toBe('Bearer ghs_test123')
                expect(JSON.parse(capturedOptions.body)).toEqual({
                    title: 'fix: resolve issue #42',
                    head: 'december/issue-42',
                    base: 'main',
                    body: 'Fix details',
                })
                expect(res.number).toBe(99)
            } finally {
                globalThis.fetch = originalFetch
            }
        })
    })
})
