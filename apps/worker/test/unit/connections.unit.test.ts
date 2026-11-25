import { prisma } from '@december/database'
import { encryptText } from '@december/shared/crypto'
import { afterEach, describe, it, expect, mock } from 'bun:test'

import {
    buildMcpConfigs,
    buildSkillRules,
    connectAgentMcpServers,
    connectUserMcpServers,
    disconnectAgentMcpServers,
    pickTurnSkills,
    readMcpHeaders,
    readNameList,
    PICKED_SKILLS_LIMIT,
    toMcpCheck,
    withPickedSkills,
} from '../../src/connections'
import { resolveSecretsEncKey } from '../../src/llm-source'
import { buildTurnPrompt } from '../../src/session-commands'

import type { McpRunConfig, McpServerRow, SkillRow } from '../../src/connections'

const skill = (name: string, extra: Partial<SkillRow> = {}): SkillRow => ({
    name,
    description: `what ${name} does`,
    body: `steps of ${name}`,
    runs: 'agent',
    enabled: true,
    ...extra,
})

// issue 632 section 2: the user's saved skills and mcp servers in a cloud run
describe('saved skills in the rules of a cloud run (#632)', () => {
    it('has no section when the user has no skill the agent may run', () => {
        expect(buildSkillRules([])).toBe('')
        expect(
            buildSkillRules([
                skill('only-when-picked', { runs: 'user' }),
                skill('turned-off', { enabled: false }),
            ])
        ).toBe('')
    })

    it('writes each skill in full under a skills heading', () => {
        const rules = buildSkillRules([
            skill('deploy', { description: 'ship to production', body: 'run the deploy script' }),
            skill('review', { description: 'review a change', body: '  read the diff first\n' }),
        ])
        expect(rules).toBe(
            [
                '## Skills',
                'The user saved these skills. When a task matches a skill, follow its steps.',
                '',
                '### deploy',
                'ship to production',
                '',
                'run the deploy script',
                '',
                '### review',
                'review a change',
                '',
                'read the diff first',
            ].join('\n')
        )
    })

    it('leaves out skills that are off or that only the user may run', () => {
        const rules = buildSkillRules([
            skill('deploy'),
            skill('only-when-picked', { runs: 'user' }),
            skill('turned-off', { enabled: false }),
        ])
        expect(rules).toContain('### deploy')
        expect(rules).not.toContain('only-when-picked')
        expect(rules).not.toContain('turned-off')
    })

    it('past about 8000 characters a skill is listed by name and description only', () => {
        const rules = buildSkillRules([
            skill('first', { body: 'a'.repeat(3000) }),
            skill('big', { description: 'the  long\nrunbook', body: 'b'.repeat(6000) }),
            skill('last', { body: 'c'.repeat(500) }),
        ])

        // the first skill fits, the big one does not, and the small one after it still fits
        expect(rules).toContain(`### first\nwhat first does\n\n${'a'.repeat(3000)}`)
        expect(rules).toContain(`### last\nwhat last does\n\n${'c'.repeat(500)}`)
        expect(rules).not.toContain('bbbb')
        expect(rules).not.toContain('### big')
        expect(rules).toContain('- big: the long runbook')
        expect(rules.length).toBeLessThan(8000)
        // the short list comes after the skills written in full
        expect(rules.indexOf('- big:')).toBeGreaterThan(rules.indexOf('### last'))
    })

    it('one skill over the limit is still listed by name', () => {
        const rules = buildSkillRules([skill('huge', { body: 'x'.repeat(20_000) })])
        expect(rules).toContain('- huge: what huge does')
        expect(rules).not.toContain('xxxx')
    })

    it('stays bounded for 100 skills with long descriptions', () => {
        const rules = buildSkillRules(
            Array.from({ length: 100 }, (_, index) =>
                skill(`skill-${index}`, {
                    description: 'd'.repeat(300),
                    body: 'y'.repeat(20_000),
                })
            )
        )
        expect(rules.length).toBeLessThanOrEqual(16_200)
        expect(rules).not.toContain('yyyy')
        const listed = rules.split('\n').filter((line) => line.startsWith('- skill-')).length
        const more = Number(rules.match(/and (\d+) more\.$/)?.[1])
        expect(listed).toBeGreaterThan(40)
        expect(listed + more).toBe(100)
    })
})

describe('skills picked for a message (#632)', () => {
    const saved = [
        skill('deploy', { description: 'ship to production', body: 'run the deploy script' }),
        skill('audit', { runs: 'user', description: 'audit the code', body: 'list every risk' }),
        skill('turned-off', { enabled: false }),
    ]

    it('picks the named skills that are on, also the ones only the user may run', () => {
        const picked = pickTurnSkills({ skills: saved, names: ['audit', 'deploy'] })
        expect(picked.map((item) => item.name)).toEqual(['audit', 'deploy'])
    })

    it('skips a named skill that is missing or turned off, and a name sent twice', () => {
        const picked = pickTurnSkills({
            skills: saved,
            names: ['gone', 'turned-off', 'deploy', 'deploy'],
        })
        expect(picked.map((item) => item.name)).toEqual(['deploy'])
        expect(pickTurnSkills({ skills: saved, names: [] })).toEqual([])
        expect(pickTurnSkills({ skills: [], names: ['deploy'] })).toEqual([])
    })

    it('puts the picked skills into the turn prompt in full, after what the user typed', async () => {
        const prompt = await buildTurnPrompt({
            prompt: 'ship the fix',
            planFirst: false,
            skills: pickTurnSkills({ skills: saved, names: ['deploy', 'audit'] }),
        })
        expect(prompt).toBe(
            [
                'ship the fix',
                '',
                '<picked-skills>',
                'The user picked these skills for this message. Follow their steps.',
                '',
                '<skill name="deploy">',
                'ship to production',
                '',
                'run the deploy script',
                '</skill>',
                '',
                '<skill name="audit">',
                'audit the code',
                '',
                'list every risk',
                '</skill>',
                '</picked-skills>',
            ].join('\n')
        )
    })

    it('sends a long skill in full, with no cap', async () => {
        const prompt = await buildTurnPrompt({
            prompt: 'go',
            planFirst: false,
            skills: [skill('runbook', { body: 'z'.repeat(20_000) })],
        })
        expect(prompt).toContain('z'.repeat(20_000))
    })

    it('keeps the prompt as typed when no skill is picked', async () => {
        expect(
            await buildTurnPrompt({ prompt: 'ship the fix', planFirst: false, skills: [] })
        ).toBe('ship the fix')
    })

    it('plan first still wraps a prompt with picked skills', async () => {
        const prompt = await buildTurnPrompt({
            prompt: 'ship the fix',
            planFirst: true,
            skills: pickTurnSkills({ skills: saved, names: ['deploy'] }),
        })
        expect(prompt.startsWith('ship the fix\n\n<picked-skills>')).toBe(true)
        expect(prompt).toContain('run the deploy script')
        expect(prompt.indexOf('<plan-first>')).toBeGreaterThan(prompt.indexOf('</picked-skills>'))
    })
})

const server = (name: string, extra: Partial<McpServerRow> = {}): McpServerRow => ({
    id: `id-${name}`,
    name,
    url: `https://${name}.example.com/mcp`,
    transport: 'http',
    auth: 'none',
    encryptedHeaders: null,
    enabled: true,
    disabledTools: [],
    ...extra,
})

// the tests keep "encrypted" headers as plain json behind an "enc:" prefix
const readHeaders = (encrypted: string) => {
    if (!encrypted.startsWith('enc:')) throw new Error('bad key')
    return JSON.parse(encrypted.slice(4)) as Record<string, string>
}
const encrypted = (headers: Record<string, string>) => `enc:${JSON.stringify(headers)}`

describe('the mcp servers a cloud run connects to (#632)', () => {
    it('builds the config of a server with no sign-in', () => {
        const plan = buildMcpConfigs({
            servers: [server('linear', { disabledTools: ['delete_issue'] })],
            disabledMcps: [],
            readHeaders,
        })
        expect(plan.refused).toEqual([])
        expect(plan.connect.map((item) => [item.server.name, item.config])).toEqual([
            [
                'linear',
                {
                    url: 'https://linear.example.com/mcp',
                    transport: 'http',
                    disabledTools: ['delete_issue'],
                    eager: true,
                },
            ],
        ])
    })

    it('adds the saved headers of a server that signs in with a header', () => {
        const plan = buildMcpConfigs({
            servers: [
                server('sentry', {
                    transport: 'sse',
                    auth: 'header',
                    encryptedHeaders: encrypted({ Authorization: 'Bearer top-secret-1' }),
                }),
            ],
            disabledMcps: [],
            readHeaders,
        })
        expect(plan.connect[0]?.config).toEqual({
            url: 'https://sentry.example.com/mcp',
            transport: 'sse',
            headers: { Authorization: 'Bearer top-secret-1' },
            disabledTools: [],
            eager: true,
        })
    })

    it('sends no header to a server saved with no sign-in', () => {
        const plan = buildMcpConfigs({
            servers: [
                server('linear', {
                    auth: 'none',
                    encryptedHeaders: encrypted({ Authorization: 'Bearer stale' }),
                }),
            ],
            disabledMcps: [],
            readHeaders,
        })
        expect(plan.connect[0]?.config.headers).toBeUndefined()
    })

    it('leaves out a server that is off, and one turned off for this session', () => {
        const plan = buildMcpConfigs({
            servers: [
                server('linear'),
                server('figma', { enabled: false }),
                server('sentry'),
                server('notion'),
            ],
            disabledMcps: ['sentry', 'not-saved'],
            readHeaders,
        })
        expect(plan.connect.map((item) => item.server.name)).toEqual(['linear', 'notion'])
        // a switch is not an error: the saved status of these servers stays as it is
        expect(plan.refused).toEqual([])
    })

    it('leaves out a server with a bad url, with an error status', () => {
        const plan = buildMcpConfigs({
            servers: [
                server('plain', { url: 'http://plain.example.com/mcp' }),
                server('inside', { url: 'https://10.0.0.5/mcp' }),
                server('metadata', { url: 'https://169.254.169.254/latest' }),
                server('linear'),
            ],
            disabledMcps: [],
            readHeaders,
        })
        expect(plan.connect.map((item) => item.server.name)).toEqual(['linear'])
        expect(plan.refused.map((item) => [item.server.name, item.check])).toEqual([
            ['plain', { status: 'error', lastError: 'the url must start with https://' }],
            ['inside', { status: 'error', lastError: 'the server must be on a public address' }],
            ['metadata', { status: 'error', lastError: 'the server must be on a public address' }],
        ])
    })

    it('leaves out a server whose saved headers cannot be read, with an error status', () => {
        const plan = buildMcpConfigs({
            servers: [
                server('sentry', { auth: 'header', encryptedHeaders: 'not-readable' }),
                server('github', { auth: 'header', encryptedHeaders: null }),
            ],
            disabledMcps: [],
            readHeaders,
        })
        expect(plan.connect).toEqual([])
        expect(plan.refused.map((item) => [item.server.name, item.check])).toEqual([
            [
                'sentry',
                {
                    status: 'error',
                    lastError: 'the saved headers cannot be read, save the server again',
                },
            ],
            [
                'github',
                {
                    status: 'error',
                    lastError: 'the saved headers cannot be read, save the server again',
                },
            ],
        ])
    })
})

describe('what a run saves about an mcp server (#632)', () => {
    it('a connected server is saved with every tool it lists, also the ones turned off', () => {
        expect(
            toMcpCheck({
                status: 'connected',
                availableTools: ['list_issues', 'create_issue', 'delete_issue'],
                tools: [{ name: 'mcp_linear_list_issues' }, { name: 'mcp_linear_create_issue' }],
            })
        ).toEqual({
            status: 'connected',
            lastError: null,
            tools: ['list_issues', 'create_issue', 'delete_issue'],
        })
    })

    it('a connected server that lists no tools has none', () => {
        expect(toMcpCheck({ status: 'connected', tools: [] })).toEqual({
            status: 'connected',
            lastError: null,
            tools: [],
        })
    })

    it('a server that fails is saved with the http status and a fixed reason', () => {
        expect(toMcpCheck({ status: 'error', error: 'HTTP 401: unauthorized', tools: [] })).toEqual(
            { status: 'error', lastError: 'HTTP 401: the server refused the sign-in' }
        )
        expect(
            toMcpCheck({ status: 'error', error: 'anything', errorStatus: 500, tools: [] })
        ).toEqual({ status: 'error', lastError: 'HTTP 500: the server failed' })
        expect(toMcpCheck({ status: 'error', tools: [] })).toEqual({
            status: 'error',
            lastError: 'the server did not connect',
        })
    })

    // review A2: the answer of the server could be a page from inside the network
    it('never keeps text the server answered with in the reason', () => {
        const check = toMcpCheck({
            status: 'error',
            error: 'HTTP 500: Error POSTing to endpoint: ami-id instance-id AKIA-internal-secret',
            errorStatus: 500,
            tools: [],
        })
        expect(check).toEqual({ status: 'error', lastError: 'HTTP 500: the server failed' })
        expect(
            toMcpCheck({ status: 'error', error: 'root:x:0:0:root:/root:/bin/bash', tools: [] })
        ).toEqual({ status: 'error', lastError: 'the server did not connect' })
    })

    it('keeps the fixed reason of a refused address or a redirect', () => {
        expect(
            toMcpCheck({
                status: 'error',
                error: 'the server answered with a redirect',
                errorReason: 'the server answered with a redirect',
                tools: [],
            })
        ).toEqual({ status: 'error', lastError: 'the server answered with a redirect' })
        expect(
            toMcpCheck({
                status: 'error',
                errorReason: 'the server must be on a public address',
                tools: [],
            })
        ).toEqual({ status: 'error', lastError: 'the server must be on a public address' })
        // a reason that is not one of the fixed ones is not trusted
        expect(
            toMcpCheck({ status: 'error', errorReason: 'text of the server', tools: [] })
        ).toEqual({ status: 'error', lastError: 'the server did not connect' })
    })

    it('a server with no answer, or one that did not finish connecting, is an error', () => {
        expect(toMcpCheck(undefined)).toEqual({
            status: 'error',
            lastError: 'the server did not connect',
        })
        expect(toMcpCheck({ status: 'connecting', tools: [] })).toEqual({
            status: 'error',
            lastError: 'the server did not connect',
        })
        expect(toMcpCheck({ status: 'disconnected', tools: [] })).toEqual({
            status: 'error',
            lastError: 'the server did not connect',
        })
    })

    it('never keeps a header value in the reason', () => {
        const check = toMcpCheck({
            status: 'error',
            error: 'HTTP 403: token Bearer top-secret-1 has no access (key org-secret-2)',
            tools: [],
        })
        expect(check).toEqual({
            status: 'error',
            lastError: 'HTTP 403: the server refused the sign-in',
        })
    })
})

describe('connecting the mcp servers of a run (#632)', () => {
    const checkedAt = new Date('2026-11-25T12:00:00.000Z')
    const connected = (tools: string[]) => ({
        status: 'connected',
        availableTools: tools,
        tools: tools.map((name) => ({ name })),
    })

    /** runs the connect step with fake servers and returns what was connected and saved */
    const run = async (data: {
        servers: McpServerRow[]
        disabledMcps?: string[]
        answers: Record<string, () => Promise<ReturnType<typeof connected> | undefined>>
        save?: (id: string) => Promise<void>
        timeoutMs?: number
    }) => {
        const calls: Array<{ name: string; config: McpRunConfig }> = []
        const saved: Record<string, unknown> = {}
        const dropped: string[] = []
        const results = await connectUserMcpServers({
            servers: data.servers,
            disabledMcps: data.disabledMcps ?? [],
            readHeaders,
            connect: async (name, config) => {
                calls.push({ name, config })
                return data.answers[name]?.()
            },
            drop: (name) => {
                dropped.push(name)
            },
            save: async (id, check) => {
                await data.save?.(id)
                saved[id] = check
            },
            timeoutMs: data.timeoutMs ?? 1000,
            now: () => checkedAt,
        })
        return { calls, saved, dropped, results }
    }

    it('connects each server that is on and saves what it found', async () => {
        const { calls, saved, results } = await run({
            servers: [
                server('linear', { disabledTools: ['delete_issue'] }),
                server('figma', { enabled: false }),
                server('notion'),
            ],
            disabledMcps: ['notion'],
            answers: { linear: async () => connected(['list_issues', 'delete_issue']) },
        })

        expect(calls).toEqual([
            {
                name: 'linear',
                config: {
                    url: 'https://linear.example.com/mcp',
                    transport: 'http',
                    disabledTools: ['delete_issue'],
                    eager: true,
                },
            },
        ])
        // the servers that are off keep their saved status: nothing is written for them
        expect(saved).toEqual({
            'id-linear': {
                status: 'connected',
                lastError: null,
                tools: ['list_issues', 'delete_issue'],
                checkedAt,
            },
        })
        expect(results).toEqual([{ name: 'linear', status: 'connected' }])
    })

    it('one server that fails does not fail the run or the other servers', async () => {
        const { saved, results } = await run({
            servers: [
                server('broken'),
                server('slow'),
                server('inside', { url: 'https://192.168.1.4/mcp' }),
                server('sentry', {
                    auth: 'header',
                    encryptedHeaders: encrypted({ Authorization: 'Bearer top-secret-1' }),
                }),
                server('linear'),
            ],
            answers: {
                broken: async () => {
                    throw new Error('fetch failed')
                },
                // never answers
                slow: () => new Promise(() => {}),
                sentry: async () => ({
                    status: 'error',
                    error: 'HTTP 401 for Bearer top-secret-1',
                    availableTools: [],
                    tools: [],
                }),
                linear: async () => connected(['list_issues']),
            },
            timeoutMs: 30,
        })

        expect(saved).toEqual({
            'id-broken': { status: 'error', lastError: 'the server did not connect', checkedAt },
            'id-slow': {
                status: 'error',
                lastError: 'the server did not answer in time',
                checkedAt,
            },
            'id-inside': {
                status: 'error',
                lastError: 'the server must be on a public address',
                checkedAt,
            },
            'id-sentry': {
                status: 'error',
                lastError: 'HTTP 401: the server refused the sign-in',
                checkedAt,
            },
            'id-linear': {
                status: 'connected',
                lastError: null,
                tools: ['list_issues'],
                checkedAt,
            },
        })
        expect(results.filter((item) => item.status === 'connected')).toEqual([
            { name: 'linear', status: 'connected' },
        ])
    })

    it('a status that cannot be saved does not fail the run', async () => {
        const { results } = await run({
            servers: [server('linear'), server('notion')],
            answers: {
                linear: async () => connected(['list_issues']),
                notion: async () => connected(['search']),
            },
            save: async (id) => {
                if (id === 'id-linear') throw new Error('database is away')
            },
        })
        expect(results).toEqual([
            { name: 'linear', status: 'connected' },
            { name: 'notion', status: 'connected' },
        ])
    })

    it('closes a server whose time is up, and drops it again if it answers late', async () => {
        let finish: (value: ReturnType<typeof connected>) => void = () => {}
        const late = new Promise<ReturnType<typeof connected>>((resolve) => {
            finish = resolve
        })
        const { saved, dropped } = await run({
            servers: [server('slow')],
            answers: { slow: () => late },
            timeoutMs: 20,
        })
        expect(saved['id-slow']).toEqual({
            status: 'error',
            lastError: 'the server did not answer in time',
            checkedAt,
        })
        // the connection that still hangs is closed at once
        expect(dropped).toEqual(['slow'])

        // a late answer must not add tools in the middle of the run
        finish(connected(['search']))
        await new Promise((resolve) => setTimeout(resolve, 5))
        expect(dropped).toEqual(['slow', 'slow'])
    })

    it('a server that cannot be closed after its time is up does not fail the run', async () => {
        const results = await connectUserMcpServers({
            servers: [server('slow'), server('linear')],
            disabledMcps: [],
            readHeaders,
            connect: (name) =>
                name === 'slow' ? new Promise(() => {}) : Promise.resolve(connected(['search'])),
            drop: () => {
                throw new Error('already closed')
            },
            save: async () => {},
            timeoutMs: 20,
        })
        expect(results).toEqual([
            { name: 'slow', status: 'error' },
            { name: 'linear', status: 'connected' },
        ])
    })

    it('does nothing for a user with no servers', async () => {
        const { calls, saved, results } = await run({ servers: [], answers: {} })
        expect(calls).toEqual([])
        expect(saved).toEqual({})
        expect(results).toEqual([])
    })
})

describe('the saved values a run reads (#632)', () => {
    // the server saves the headers with encryptText and the same key rules
    const keyHex = resolveSecretsEncKey() as string
    const save = (value: unknown) => encryptText({ text: JSON.stringify(value), keyHex })

    it('reads the headers the server saved', () => {
        expect(
            readMcpHeaders(save({ Authorization: 'Bearer top-secret-1', 'X-Org': 'acme' }))
        ).toEqual({ Authorization: 'Bearer top-secret-1', 'X-Org': 'acme' })
    })

    it('keeps only headers with a text value', () => {
        expect(readMcpHeaders(save({ Authorization: 'Bearer a', Empty: '', Count: 3 }))).toEqual({
            Authorization: 'Bearer a',
        })
        expect(readMcpHeaders(save(['Authorization']))).toEqual({})
    })

    it('throws for headers saved with another key, or not encrypted', () => {
        const otherKey = encryptText({ text: '{"Authorization":"x"}', keyHex: 'ab'.repeat(32) })
        expect(() => readMcpHeaders(otherKey)).toThrow()
        expect(() => readMcpHeaders('{"Authorization":"x"}')).toThrow()
    })

    it('reads a list of names from job data, and nothing from any other value', () => {
        expect(readNameList(['deploy', 'audit'])).toEqual(['deploy', 'audit'])
        expect(readNameList(['deploy', '', 7, null, { name: 'x' }])).toEqual(['deploy'])
        expect(readNameList(undefined)).toEqual([])
        expect(readNameList('deploy')).toEqual([])
        expect(readNameList({ 0: 'deploy' })).toEqual([])
    })
})

describe('the mcp servers on the agent of a run (#632)', () => {
    const keyHex = resolveSecretsEncKey() as string
    const originalUpdateMany = prisma.userMcpServer.updateMany

    afterEach(() => {
        prisma.userMcpServer.updateMany = originalUpdateMany
    })

    it('gives the agent the decrypted headers, saves the status, and closes at the end', async () => {
        const writes: Array<{ where: unknown; data: Record<string, unknown> }> = []
        prisma.userMcpServer.updateMany = mock(async (args: any) => {
            writes.push(args)
            return { count: 1 }
        }) as any

        const given: Record<string, McpRunConfig> = {}
        let closed = 0
        const agent = {
            initMcpServers: async (configs: Record<string, McpRunConfig>) => {
                Object.assign(given, configs)
            },
            unregisterMcpServerTools: () => {},
            mcpClientManager: {
                getServer: (name: string) =>
                    name === 'sentry'
                        ? {
                              status: 'connected',
                              availableTools: ['search_issues', 'resolve_issue'],
                              tools: [{ name: 'mcp_sentry_search_issues' }],
                          }
                        : { status: 'error', error: 'fetch failed', tools: [] },
                removeServer: async () => {},
                disconnectAll: async () => {
                    closed += 1
                },
            },
        }

        const results = await connectAgentMcpServers({
            agent,
            servers: [
                server('sentry', {
                    auth: 'header',
                    encryptedHeaders: encryptText({
                        text: JSON.stringify({ Authorization: 'Bearer top-secret-1' }),
                        keyHex,
                    }),
                    disabledTools: ['resolve_issue'],
                }),
                server('linear'),
                server('notion'),
            ],
            disabledMcps: ['notion'],
        })

        expect(given).toEqual({
            sentry: {
                url: 'https://sentry.example.com/mcp',
                transport: 'http',
                headers: { Authorization: 'Bearer top-secret-1' },
                disabledTools: ['resolve_issue'],
                eager: true,
            },
            linear: {
                url: 'https://linear.example.com/mcp',
                transport: 'http',
                disabledTools: [],
                eager: true,
            },
        })
        expect(results).toEqual([
            { name: 'sentry', status: 'connected' },
            { name: 'linear', status: 'error' },
        ])

        const bySaved = Object.fromEntries(
            writes.map((write) => [(write.where as { id: string }).id, write.data])
        )
        expect(Object.keys(bySaved).sort()).toEqual(['id-linear', 'id-sentry'])
        expect(bySaved['id-sentry']).toMatchObject({
            status: 'connected',
            lastError: null,
            tools: ['search_issues', 'resolve_issue'],
        })
        expect(bySaved['id-sentry']?.checkedAt).toBeInstanceOf(Date)
        expect(bySaved['id-linear']).toMatchObject({
            status: 'error',
            lastError: 'the server did not connect',
        })
        // an error keeps the tools the last good run listed
        expect('tools' in (bySaved['id-linear'] ?? {})).toBe(false)
        expect(JSON.stringify(writes)).not.toContain('top-secret-1')

        await disconnectAgentMcpServers(agent)
        expect(closed).toBe(1)
    })

    it('closing an agent that never connected a server does nothing', async () => {
        await disconnectAgentMcpServers({
            initMcpServers: async () => {},
            unregisterMcpServerTools: () => {},
        })
    })
})

// review A5: 50 picked skills of 20000 characters each must not all go into one prompt
describe('the size of the picked skills of one message', () => {
    const big = (name: string) => ({ name, description: `about ${name}`, body: 'x'.repeat(20_000) })

    it('sends small skills in full', () => {
        const text = withPickedSkills('do it', [
            { name: 'deploy', description: 'ship', body: 'step 1' },
        ])
        expect(text).toContain('<skill name="deploy">\nship\n\nstep 1\n</skill>')
        expect(text).not.toContain('[cut')
    })

    it('cuts the skill that crosses 30000 characters and lists the later ones by name', () => {
        expect(PICKED_SKILLS_LIMIT).toBe(30_000)
        const text = withPickedSkills('do it', [big('one'), big('two'), big('three'), big('four')])
        expect(text.length).toBeLessThan(31_000)
        expect(text).toContain(`about one\n\n${'x'.repeat(20_000)}\n</skill>`)
        expect(text).toContain('<skill name="two">')
        expect(text).toContain('[cut: the picked skills are over the size limit of one message]')
        expect(text).not.toContain('<skill name="three">')
        expect(text).toContain('Not sent, the size limit was reached: three, four.')
    })
})
