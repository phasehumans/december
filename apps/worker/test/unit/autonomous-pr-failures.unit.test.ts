import { prisma } from '@december/database'
import { describe, it, expect, mock, beforeEach, afterEach } from 'bun:test'

import { handleAutonomousTaskBranchAndPr } from '../../src/listener'

// review E2: a branch name git refuses, and a checkout or push that fails
describe('the task branch when git refuses a step (review E2)', () => {
    const sessionId = 'sess-e2-1'
    const userId = 'user-e2-1'
    const original = {
        fetch: globalThis.fetch,
        findSession: prisma.session.findUnique,
        findUser: prisma.user.findUnique,
        updateSession: prisma.session.update,
        findPrSettings: prisma.pullRequestSettings.findUnique,
    }
    let sessionUpdates: any[] = []
    let prSettings: Record<string, unknown> | null = null
    let requests: string[] = []

    const setup = (data: { session?: Record<string, unknown>; failing?: string } = {}) => {
        const { session = {}, failing } = data
        const executedCommands: string[] = []
        prisma.session.findUnique = mock(async () => ({
            id: sessionId,
            userId,
            title: 'Add search',
            githubRepoOwner: 'acme',
            githubRepoName: 'web',
            branch: 'main',
            ...session,
        })) as any
        const sandbox = {
            commands: {
                run: mock(async (cmd: string) => {
                    executedCommands.push(cmd)
                    if (cmd.includes('git status --porcelain')) {
                        return { stdout: ' M src/search.ts', exitCode: 0 }
                    }
                    if (failing && cmd.includes(failing)) {
                        // the e2b sdk throws when a command ends with an error
                        throw new Error(`exit status 128: fatal: not a valid ref (${failing})`)
                    }
                    return { stdout: '', exitCode: 0 }
                }),
            },
        }
        const events: Array<Record<string, unknown>> = []
        const publish = async (_sessionId: string, event: Record<string, unknown>) => {
            events.push(event)
        }
        return { sandbox, executedCommands, events, publish }
    }

    beforeEach(() => {
        sessionUpdates = []
        requests = []
        prSettings = { commitAuthor: 'december', prAuthor: 'user' }
        prisma.pullRequestSettings.findUnique = mock(async () => prSettings) as any
        prisma.user.findUnique = mock(async () => ({ id: userId, githubToken: 'ghu_t' })) as any
        prisma.session.update = mock(async (args: any) => {
            sessionUpdates.push(args)
            return {}
        }) as any
        globalThis.fetch = mock(async (url: string | URL | Request, init?: RequestInit) => {
            requests.push(`${init?.method ?? 'GET'} ${url.toString()}`)
            const body = init?.body ? JSON.parse(String(init.body)) : {}
            if (url.toString().endsWith('/pulls')) {
                return new Response(
                    JSON.stringify({
                        number: 7,
                        title: body.title,
                        html_url: 'https://github.com/acme/web/pull/7',
                        state: 'open',
                    }),
                    { status: 201 }
                )
            }
            return new Response('{}', { status: 200 })
        }) as any
    })

    afterEach(() => {
        globalThis.fetch = original.fetch
        prisma.session.findUnique = original.findSession
        prisma.user.findUnique = original.findUser
        prisma.session.update = original.updateSession
        prisma.pullRequestSettings.findUnique = original.findPrSettings
    })

    it('uses december/<id> when the saved prefix gives a name git refuses', async () => {
        prSettings = { branchPrefix: 'wip/.', commitAuthor: 'december', prAuthor: 'user' }
        const { sandbox, executedCommands, events, publish } = setup()

        const result = await handleAutonomousTaskBranchAndPr({ sessionId, sandbox, publish })

        expect(result?.headRef).toBe('december/sess-e2-1')
        expect(executedCommands).toContain('git push origin december/sess-e2-1')
        expect(sessionUpdates.map((update) => update.data.prBranch)).toEqual([
            'december/sess-e2-1',
            'december/sess-e2-1',
        ])
        expect(events).toEqual([])
    })

    it('repairs a session that has a bad saved branch', async () => {
        prSettings = { branchPrefix: 'feat/', commitAuthor: 'december', prAuthor: 'user' }
        const { sandbox, executedCommands, publish } = setup({
            session: { prBranch: 'wip/.sess-e2-1' },
        })

        const result = await handleAutonomousTaskBranchAndPr({ sessionId, sandbox, publish })

        expect(result?.headRef).toBe('feat/sess-e2-1')
        expect(executedCommands).toContain('git push origin feat/sess-e2-1')
        expect(executedCommands.join('\n')).not.toContain('wip/.')
        expect(sessionUpdates[0]?.data).toEqual({ prBranch: 'feat/sess-e2-1' })
    })

    it('a push that fails sends an error event, saves no branch and opens no pull request', async () => {
        const { sandbox, events, publish } = setup({ failing: 'git push origin' })

        const result = await handleAutonomousTaskBranchAndPr({ sessionId, sandbox, publish })

        expect(result).toBe(null)
        expect(events).toEqual([
            {
                type: 'AgentError',
                code: 'GIT_PUSH_FAILED',
                error: 'Could not push the branch december/sess-e2-1. The work is committed and stays in the sandbox.',
                message:
                    'Could not push the branch december/sess-e2-1. The work is committed and stays in the sandbox.',
            },
        ])
        expect(sessionUpdates).toEqual([])
        expect(requests.filter((request) => request.includes('/pulls'))).toEqual([])
    })

    it('a checkout that fails sends an error event and does not commit or push', async () => {
        const { sandbox, executedCommands, events, publish } = setup({
            failing: 'git checkout -B',
        })

        const result = await handleAutonomousTaskBranchAndPr({ sessionId, sandbox, publish })

        expect(result).toBe(null)
        expect(events.map((event) => [event.type, event.code, event.error])).toEqual([
            [
                'AgentError',
                'GIT_BRANCH_FAILED',
                'Could not switch to the branch december/sess-e2-1. The work is not pushed and stays in the sandbox.',
            ],
        ])
        expect(executedCommands.some((cmd) => cmd.includes('git commit'))).toBe(false)
        expect(executedCommands.some((cmd) => cmd.includes('git push'))).toBe(false)
        expect(sessionUpdates).toEqual([])
    })

    it('a push that ends with an exit code (no throw) is a failure too', async () => {
        const { sandbox, events, publish } = setup()
        const run = sandbox.commands.run
        sandbox.commands.run = mock(async (cmd: string) =>
            cmd.startsWith('git push origin') ? { stdout: '', exitCode: 1 } : run(cmd)
        ) as any

        const result = await handleAutonomousTaskBranchAndPr({ sessionId, sandbox, publish })

        expect(result).toBe(null)
        expect(events.map((event) => event.code)).toEqual(['GIT_PUSH_FAILED'])
    })
})
