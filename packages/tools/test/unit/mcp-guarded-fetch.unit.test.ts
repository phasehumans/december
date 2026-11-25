import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, describe, expect, it } from 'bun:test'

import { McpClientManager } from '../../src/mcp'
import {
    createGuardedMcpFetch,
    fetchAtAddress,
    McpConnectRefusedError,
} from '../../src/mcp/guarded-fetch'

import type { PinnedRequest } from '../../src/mcp/guarded-fetch'

const PUBLIC_ADDRESS = '93.184.216.34'
const servers: Array<{ stop: (force?: boolean) => unknown }> = []

afterEach(() => {
    for (const server of servers.splice(0)) server.stop(true)
})

const refusal = async (attempt: Promise<unknown>): Promise<string> => {
    try {
        await attempt
    } catch (error) {
        expect(error).toBeInstanceOf(McpConnectRefusedError)
        return (error as McpConnectRefusedError).reason
    }
    throw new Error('the request was not refused')
}

// review A2: the worker connects from inside december's network
describe('the guarded fetch of a remote mcp server', () => {
    it('refuses a public name that resolves to an internal address, and sends nothing', async () => {
        for (const address of ['127.0.0.1', '10.0.0.5', '169.254.169.254', 'fd00::1', '::1']) {
            const sent: PinnedRequest[] = []
            const guarded = createGuardedMcpFetch({
                resolve: async () => [address],
                send: async (request) => {
                    sent.push(request)
                    return new Response('never')
                },
            })
            const reason = await refusal(
                guarded('https://mcp.example.com/mcp', { headers: { Authorization: 'Bearer t' } })
            )
            expect(reason).toBe('the server must be on a public address')
            expect(sent).toEqual([])
        }
    })

    it('refuses the name when one of its addresses is internal', async () => {
        const guarded = createGuardedMcpFetch({
            resolve: async () => [PUBLIC_ADDRESS, '10.0.0.5'],
            send: async () => new Response('never'),
        })
        expect(await refusal(guarded('https://mcp.example.com/mcp'))).toBe(
            'the server must be on a public address'
        )
    })

    it('refuses a url that is not https on a public name, with no dns question', async () => {
        let asked = 0
        const guarded = createGuardedMcpFetch({
            resolve: async () => {
                asked += 1
                return [PUBLIC_ADDRESS]
            },
            send: async () => new Response('never'),
        })
        expect(await refusal(guarded('http://mcp.example.com/mcp'))).toBe(
            'the url must start with https://'
        )
        expect(await refusal(guarded('https://169.254.169.254/latest'))).toBe(
            'the server must be on a public address'
        )
        expect(await refusal(guarded('https://[::1]/mcp'))).toBe(
            'the server must be on a public address'
        )
        expect(asked).toBe(0)
    })

    it('refuses a name with no address', async () => {
        const guarded = createGuardedMcpFetch({
            resolve: async () => {
                throw new Error('ENOTFOUND')
            },
            send: async () => new Response('never'),
        })
        expect(await refusal(guarded('https://mcp.example.com/mcp'))).toBe(
            'the server name was not found'
        )
    })

    it('connects to the address that was checked, with the name asked once', async () => {
        const sent: PinnedRequest[] = []
        let asked = 0
        const guarded = createGuardedMcpFetch({
            resolve: async () => {
                asked += 1
                // a second answer would be internal: it must never be used
                return asked === 1 ? [PUBLIC_ADDRESS] : ['127.0.0.1']
            },
            send: async (request) => {
                sent.push(request)
                return new Response('ok')
            },
        })
        const response = await guarded('https://mcp.example.com/mcp', { method: 'POST' })
        expect(await response.text()).toBe('ok')
        expect(asked).toBe(1)
        expect(sent.map((item) => [item.url.href, item.address, item.init.redirect])).toEqual([
            ['https://mcp.example.com/mcp', PUBLIC_ADDRESS, 'manual'],
        ])
    })

    it('refuses a 307 to an internal url and sends no header to the redirect target', async () => {
        const targetSeen: Array<string | null> = []
        const target = Bun.serve({
            port: 0,
            hostname: '127.0.0.1',
            fetch: (request) => {
                targetSeen.push(request.headers.get('authorization'))
                return new Response('secret metadata')
            },
        })
        const firstSeen: Array<string | null> = []
        const first = Bun.serve({
            port: 0,
            hostname: '127.0.0.1',
            fetch: (request) => {
                firstSeen.push(request.headers.get('authorization'))
                return new Response(null, {
                    status: 307,
                    headers: { Location: `http://127.0.0.1:${target.port}/latest/meta-data` },
                })
            },
        })
        servers.push(target, first)

        const guarded = createGuardedMcpFetch({
            resolve: async () => [PUBLIC_ADDRESS],
            // the "public" server of the test is the local one; the redirect rule is the real one
            send: ({ init }) => fetch(`http://127.0.0.1:${first.port}/mcp`, init),
        })
        const reason = await refusal(
            guarded('https://mcp.example.com/mcp', {
                method: 'POST',
                headers: { Authorization: 'Bearer top-secret-1' },
                body: '{}',
            })
        )
        expect(reason).toBe('the server answered with a redirect')
        expect(firstSeen).toEqual(['Bearer top-secret-1'])
        expect(targetSeen).toEqual([])
    })

    it('the mcp client reports a redirect as an error and never reaches the target', async () => {
        const targetSeen: string[] = []
        const target = Bun.serve({
            port: 0,
            hostname: '127.0.0.1',
            fetch: (request) => {
                targetSeen.push(request.url)
                return new Response('secret metadata')
            },
        })
        const first = Bun.serve({
            port: 0,
            hostname: '127.0.0.1',
            fetch: () =>
                new Response(null, {
                    status: 307,
                    headers: { Location: `http://127.0.0.1:${target.port}/latest/meta-data` },
                }),
        })
        servers.push(target, first)

        for (const transport of ['http', 'sse'] as const) {
            const manager = new McpClientManager({
                remoteFetch: createGuardedMcpFetch({
                    resolve: async () => [PUBLIC_ADDRESS],
                    send: ({ init }) => fetch(`http://127.0.0.1:${first.port}/mcp`, init),
                }),
            })
            const info = await manager.connectServer('redirecting', {
                url: 'https://mcp.example.com/mcp',
                transport,
                headers: { Authorization: 'Bearer top-secret-1' },
            })
            expect(info.status).toBe('error')
            expect(info.errorReason).toBe('the server answered with a redirect')
            await manager.disconnectAll()
        }
        expect(targetSeen).toEqual([])
    })

    it('the mcp client keeps the http status of a failure apart from the text of the answer', async () => {
        const manager = new McpClientManager({
            remoteFetch: createGuardedMcpFetch({
                resolve: async () => [PUBLIC_ADDRESS],
                send: async () => new Response('root:x:0:0 internal file text', { status: 500 }),
            }),
        })
        const info = await manager.connectServer('failing', {
            url: 'https://mcp.example.com/mcp',
            transport: 'http',
        })
        expect(info.status).toBe('error')
        expect(info.errorStatus).toBe(500)
        expect(info.errorReason).toBeUndefined()
    })
})

const hasOpenssl = Bun.which('openssl') !== null

describe('fetchAtAddress', () => {
    it.skipIf(!hasOpenssl)(
        'reaches the given address and still checks the certificate against the name',
        async () => {
            const dir = mkdtempSync(join(tmpdir(), 'mcp-pin-'))
            try {
                const made = Bun.spawnSync([
                    'openssl',
                    'req',
                    '-x509',
                    '-newkey',
                    'rsa:2048',
                    '-nodes',
                    '-keyout',
                    join(dir, 'key.pem'),
                    '-out',
                    join(dir, 'cert.pem'),
                    '-days',
                    '2',
                    '-subj',
                    '/CN=pinned.example.com',
                    '-addext',
                    'subjectAltName=DNS:pinned.example.com',
                ])
                expect(made.exitCode).toBe(0)
                const cert = readFileSync(join(dir, 'cert.pem'), 'utf8')
                const key = readFileSync(join(dir, 'key.pem'), 'utf8')
                const seen: Array<string | null> = []
                const server = Bun.serve({
                    port: 0,
                    hostname: '127.0.0.1',
                    tls: { cert, key },
                    fetch: (request) => {
                        seen.push(request.headers.get('host'))
                        return new Response('pinned')
                    },
                })
                servers.push(server)

                // the name has no dns record: only the given address can answer
                const response = await fetchAtAddress({
                    url: new URL(`https://pinned.example.com:${server.port}/mcp`),
                    address: '127.0.0.1',
                    init: {},
                    tls: { ca: cert },
                })
                expect(await response.text()).toBe('pinned')
                expect(seen).toEqual([`pinned.example.com:${server.port}`])

                // another name on the same address fails the certificate check
                await expect(
                    fetchAtAddress({
                        url: new URL(`https://other.example.com:${server.port}/mcp`),
                        address: '127.0.0.1',
                        init: {},
                        tls: { ca: cert },
                    })
                ).rejects.toThrow()
            } finally {
                rmSync(dir, { recursive: true, force: true })
            }
        }
    )
})
