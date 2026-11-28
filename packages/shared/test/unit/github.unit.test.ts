import { describe, expect, it } from 'bun:test'

import {
    createCommentReaction,
    createIssueComment,
    createIssueReaction,
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

        it('ignores @december, which is an unrelated GitHub user', () => {
            const res = extractBotMention('@december fix the bug in session handling and add tests')
            expect(res.isMentioned).toBe(false)
        })

        it('detects @trydecember and @trydecember[bot]', () => {
            const res1 = extractBotMention('@trydecember explain me this issue')
            expect(res1.isMentioned).toBe(true)
            expect(res1.instruction).toBe('explain me this issue')

            const res2 = extractBotMention('@trydecember[bot] explain me this issue')
            expect(res2.isMentioned).toBe(true)
            expect(res2.instruction).toBe('explain me this issue')
        })

        it('handles case-insensitive mention and whitespace', () => {
            const res = extractBotMention('  @TryDecember   please refactor this module  ')
            expect(res.isMentioned).toBe(true)
            expect(res.instruction).toBe('please refactor this module')
        })

        it('provides default instruction if comment only contains mention', () => {
            const res = extractBotMention('@trydecember')
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

    describe('createIssueReaction', () => {
        it('makes POST request to GitHub issue reactions endpoint with eyes or rocket', async () => {
            const originalFetch = globalThis.fetch
            let capturedUrl = ''
            let capturedOptions: any = null

            globalThis.fetch = (async (url: string | URL | Request, options?: any) => {
                capturedUrl = url.toString()
                capturedOptions = options
                return new Response(JSON.stringify({ id: 2, content: 'rocket' }), { status: 201 })
            }) as any

            try {
                const res = await createIssueReaction({
                    token: 'ghs_test123',
                    owner: 'testorg',
                    repo: 'testrepo',
                    issueNumber: 123,
                    reaction: 'rocket',
                })

                expect(capturedUrl).toBe(
                    'https://api.github.com/repos/testorg/testrepo/issues/123/reactions'
                )
                expect(capturedOptions.method).toBe('POST')
                expect(capturedOptions.headers.Authorization).toBe('Bearer ghs_test123')
                expect(JSON.parse(capturedOptions.body)).toEqual({ content: 'rocket' })
                expect(res.content).toBe('rocket')
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

describe('github app helpers (#568)', () => {
    it('parseBotCommand: "review" first is a review, anything else is a task', async () => {
        const { parseBotCommand } = await import('../../src/utils/github')
        expect(parseBotCommand('@trydecember review')).toEqual({
            isMentioned: true,
            intent: 'review',
            instruction: '',
        })
        expect(parseBotCommand('@trydecember: review the auth part')).toEqual({
            isMentioned: true,
            intent: 'review',
            instruction: 'the auth part',
        })
        expect(parseBotCommand('@trydecember fix the review button').intent).toBe('task')
        expect(parseBotCommand('@trydecember reviewer list is wrong').intent).toBe('task')
        expect(parseBotCommand('hello').isMentioned).toBe(false)
        expect(parseBotCommand('@december review').isMentioned).toBe(false)
    })

    // review E2: git's own rules for a branch name (git check-ref-format --branch)
    it('isValidBranchName follows the ref rules of git', async () => {
        const { isValidBranchName } = await import('../../src/pull-request-settings')
        for (const name of ['december/s1', 'feat/ai-s1', 's1', 'a.b/c_d-1', 'x.locked/s1']) {
            expect(isValidBranchName(name)).toBe(true)
        }
        for (const name of [
            '',
            'wip/.s1',
            '.hidden/s1',
            'a.lock/s1',
            'wip/s1.lock',
            'a..b',
            'a//b',
            '/a',
            'a/',
            'a.',
            'a/.',
            '-a',
            '@',
            'a@{b',
            'a b',
            'a~b',
            'a^b',
            'a:b',
            'a?b',
            'a*b',
            'a[b',
            'a\\b',
            'a\tb',
            'a\x7fb',
            'x; rm -rf /',
        ]) {
            expect(isValidBranchName(name)).toBe(false)
        }
    })

    it('checkBranchPrefix refuses a prefix that gives a branch name git refuses', async () => {
        const { checkBranchPrefix } = await import('../../src/pull-request-settings')
        for (const prefix of ['december/', 'feat/ai-', '', 'team.x/', 'x.lock']) {
            expect(checkBranchPrefix(prefix)).toEqual({ ok: true })
        }
        for (const prefix of [
            'wip/.',
            'a.lock/',
            '.x/',
            'a..b/',
            '/a/',
            'a//',
            '-a/',
            'a b/',
            'a@{/',
        ]) {
            expect(checkBranchPrefix(prefix).ok).toBe(false)
        }
    })

    it('toBranchName falls back to december/<suffix> when the name is not valid', async () => {
        const { toBranchName } = await import('../../src/pull-request-settings')
        expect(toBranchName('wip/.', 's1')).toBe('december/s1')
        expect(toBranchName('a.lock/', 's1')).toBe('december/s1')
        expect(toBranchName('feat/', 's1')).toBe('feat/s1')
    })

    it('toBranchName keeps git-safe names', async () => {
        const { toBranchName } = await import('../../src/pull-request-settings')
        expect(toBranchName('december/', 'issue-4')).toBe('december/issue-4')
        expect(toBranchName('my prefix//', 'issue-4')).toBe('my-prefix/issue-4')
        expect(toBranchName('', 'issue-4')).toBe('issue-4')
        expect(toBranchName('../', 'x..y')).toBe('x.y')
    })

    it('toPullRequestSettings fills defaults and drops unknown values', async () => {
        const { toPullRequestSettings, PULL_REQUEST_SETTING_DEFAULTS } =
            await import('../../src/pull-request-settings')
        expect(toPullRequestSettings(null)).toEqual(PULL_REQUEST_SETTING_DEFAULTS)
        const s = toPullRequestSettings({ autoReview: 'always', prDraft: 'yes' } as any)
        expect(s.autoReview).toBe('asked')
        expect(s.prDraft).toBe(false)
    })

    it('createGithubAppJwt signs an RS256 token GitHub can verify', async () => {
        const { generateKeyPairSync, createVerify } = await import('node:crypto')
        const { createGithubAppJwt } = await import('../../src/utils/github-app')
        const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
        const pem = privateKey.export({ type: 'pkcs1', format: 'pem' }).toString()

        for (const key of [pem.replace(/\n/g, '\\n'), Buffer.from(pem).toString('base64')]) {
            const jwt = createGithubAppJwt({ appId: '123', privateKey: key, now: 1000 })
            const [header, payload, signature] = jwt.split('.')
            const verifier = createVerify('RSA-SHA256')
            verifier.update(`${header}.${payload}`)
            expect(verifier.verify(publicKey, Buffer.from(signature!, 'base64url'))).toBe(true)
            expect(JSON.parse(Buffer.from(payload!, 'base64url').toString())).toEqual({
                iat: 940,
                exp: 1600,
                iss: '123',
            })
        }
    })
})
