import { describe, expect, it, mock } from 'bun:test'

import { runDecemberAction } from '../src/action-runner'

describe('December GitHub Action Runner (Unit Tests)', () => {
    it('skips execution gracefully if event is an issue_comment without bot mention', async () => {
        const fakeEventJson = JSON.stringify({
            comment: {
                id: 1,
                body: 'just a normal comment without mention',
                user: { login: 'octocat' },
            },
            issue: {
                number: 10,
                title: 'test issue',
            },
        })

        const result = await runDecemberAction({
            eventJson: fakeEventJson,
            githubToken: 'ghs_token_123',
            repository: 'phasehumans/december',
            runCommand: async () => ({ stdout: '', stderr: '', exitCode: 0 }),
        })

        expect(result.success).toBe(true)
        expect(result.status).toBe('SKIPPED')
        expect(result.error).toContain('mention')
    })

    it('returns failure when prompt is missing and not provided in event', async () => {
        const result = await runDecemberAction({
            githubToken: 'ghs_token_123',
            repository: 'phasehumans/december',
            runCommand: async () => ({ stdout: '', stderr: '', exitCode: 0 }),
        })

        expect(result.success).toBe(false)
        expect(result.status).toBe('FAILED')
        expect(result.error).toContain('prompt')
    })

    it('executes task from issue comment, creates branch, creates PR, and notifies webhooks', async () => {
        const executedCommands: string[] = []
        const webhookCalls: any[] = []
        let prCreatedBody: any = null

        const originalFetch = globalThis.fetch
        globalThis.fetch = mock(async (url: string | URL | Request, init?: any) => {
            const urlStr = url.toString()
            if (urlStr.includes('/pulls') && init?.method === 'POST') {
                prCreatedBody = JSON.parse(init.body)
                return new Response(
                    JSON.stringify({
                        number: 55,
                        html_url: 'https://github.com/phasehumans/december/pull/55',
                    }),
                    { status: 201 }
                )
            }
            if (urlStr.includes('/comments') && init?.method === 'POST') {
                return new Response(JSON.stringify({ id: 99 }), { status: 201 })
            }
            if (urlStr.includes('hooks.slack.com')) {
                webhookCalls.push({ url: urlStr, body: JSON.parse(init.body) })
                return new Response('ok', { status: 200 })
            }
            return new Response('{}', { status: 200 })
        }) as any

        const fakeEventJson = JSON.stringify({
            comment: {
                id: 12,
                body: '@trydecember add unit tests for webhook notifications',
                user: { login: 'devuser' },
            },
            issue: {
                number: 568,
                title: 'automated github bot and action',
            },
        })

        try {
            const result = await runDecemberAction({
                eventJson: fakeEventJson,
                githubToken: 'ghs_mock_token_777',
                repository: 'phasehumans/december',
                slackWebhookUrl: 'https://hooks.slack.com/services/test/alert',
                runCommand: async (cmd: string) => {
                    executedCommands.push(cmd)
                    if (cmd.includes('git status --porcelain')) {
                        return { stdout: ' M packages/action/test.ts\n', stderr: '', exitCode: 0 }
                    }
                    return { stdout: 'Tests passed', stderr: '', exitCode: 0 }
                },
            })

            expect(result.success).toBe(true)
            expect(result.status).toBe('COMPLETED')
            expect(result.prNumber).toBe(55)
            expect(result.prUrl).toBe('https://github.com/phasehumans/december/pull/55')

            // Verify branch creation
            const branchCmd = executedCommands.find((c) =>
                c.includes('git checkout -B december/issue-568')
            )
            expect(branchCmd).toBeDefined()

            // Verify PR details and no resume footer
            expect(prCreatedBody).toBeDefined()
            expect(prCreatedBody.title).toContain('#568')
            expect(prCreatedBody.body).toContain('Closes #568')
            expect(prCreatedBody.body).toContain('### Modified Files')
            expect(prCreatedBody.body).not.toContain('⚡')
            expect(prCreatedBody.body).not.toContain('resume')

            // Verify webhook notification was dispatched
            expect(webhookCalls.length).toBe(1)
            expect(webhookCalls[0].body.text).toContain('COMPLETED')
        } finally {
            globalThis.fetch = originalFetch
        }
    })
})

describe('resolveActionModel (#619)', () => {
    const list = (ids: string[]) =>
        (async () => new Response(JSON.stringify({ data: ids.map((id) => ({ id })) }))) as any

    it('keeps a requested model the key can use', async () => {
        const { resolveActionModel } = await import('../src/action-runner')
        expect(await resolveActionModel('openai', 'k', 'gpt-5.6-sol', list(['gpt-5.6-sol']))).toBe(
            'gpt-5.6-sol'
        )
    })

    it('replaces a requested model the key cannot use with the best served one', async () => {
        const { resolveActionModel } = await import('../src/action-runner')
        const warn = console.warn
        const warnings: string[] = []
        console.warn = (msg: string) => warnings.push(msg)
        try {
            const model = await resolveActionModel(
                'anthropic',
                'k',
                'claude-retired-1',
                list(['claude-sonnet-5', 'claude-opus-5'])
            )
            expect(model).toBe('claude-opus-5')
            expect(warnings.join(' ')).toContain('claude-retired-1')
        } finally {
            console.warn = warn
        }
    })

    it('reads ai studio models for the action gemini provider', async () => {
        const { resolveActionModel } = await import('../src/action-runner')
        let url = ''
        const fetchFn = (async (u: string) => {
            url = u
            return new Response(
                JSON.stringify({
                    models: [
                        {
                            name: 'models/gemini-3.8-flash',
                            supportedGenerationMethods: ['generateContent'],
                        },
                    ],
                })
            )
        }) as any
        expect(await resolveActionModel('gemini', 'AIza-test', undefined, fetchFn)).toBe(
            'gemini-3.8-flash'
        )
        expect(url).toContain('generativelanguage.googleapis.com')
    })

    it('stops with a clear message when the key is rejected', async () => {
        const { resolveActionModel } = await import('../src/action-runner')
        const fetchFn = (async () =>
            new Response(JSON.stringify({ error: { message: 'Incorrect API key' } }), {
                status: 401,
            })) as any
        const err: any = await resolveActionModel('openai', 'bad', undefined, fetchFn).catch(
            (e) => e
        )
        expect(err.message).toContain('rejected the API key')
    })
})
