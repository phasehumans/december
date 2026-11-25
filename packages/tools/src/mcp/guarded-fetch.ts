/**
 * The fetch of a remote mcp server in a cloud run (review A2). The url text is checked
 * when the server is saved, but a public name can resolve to an address inside the
 * network, and a server can answer with a redirect to one. So every request:
 *   1. checks the url again (https, a public name),
 *   2. resolves the name and refuses when any address is not public,
 *   3. connects to the address that was checked (no second dns answer),
 *   4. never follows a redirect: a redirect is an error.
 */
import { lookup } from 'node:dns/promises'

import { checkMcpUrl, isInternalAddress } from '@december/shared'

export const MCP_REFUSED_INTERNAL = 'the server must be on a public address'
export const MCP_REFUSED_REDIRECT = 'the server answered with a redirect'
export const MCP_REFUSED_NO_ADDRESS = 'the server name was not found'

/** every fixed reason the guard refuses a request with */
export const MCP_REFUSAL_REASONS = [
    MCP_REFUSED_INTERNAL,
    MCP_REFUSED_REDIRECT,
    MCP_REFUSED_NO_ADDRESS,
    'the url is not valid',
    'the url must start with https://',
    'put credentials in a header, not in the url',
]

/** a request the guard did not send, or an answer it did not accept */
export class McpConnectRefusedError extends Error {
    public readonly reason: string

    constructor(reason: string) {
        super(reason)
        this.name = 'McpConnectRefusedError'
        this.reason = reason
    }
}

export type McpAddressResolver = (hostname: string) => Promise<string[]>

export type PinnedRequest = {
    /** the url the caller asked for */
    url: URL
    /** the checked address the connection goes to */
    address: string
    init: RequestInit
}

export interface GuardedFetchOptions {
    /** every address of a host name; the default asks the system resolver */
    resolve?: McpAddressResolver
    /** sends one request to the checked address; the default is `fetchAtAddress` */
    send?: (request: PinnedRequest) => Promise<Response>
}

const resolveWithSystem: McpAddressResolver = async (hostname) => {
    const answers = await lookup(hostname, { all: true, verbatim: true })
    return answers.map((answer) => answer.address)
}

const isIpLiteral = (host: string) => /^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes(':')

/**
 * Sends the request to `address` and not to what the name resolves to now. The url gets
 * the address as its host; the `Host` header and the tls server name stay the real name,
 * so the certificate is still checked against the name. Redirects are not followed.
 * This needs Bun's fetch (`tls.serverName`); another runtime fails the tls check.
 */
export const fetchAtAddress = async (
    request: PinnedRequest & { tls?: Record<string, unknown> }
): Promise<Response> => {
    const { url, address, init, tls } = request
    const target = new URL(url.href)
    target.hostname = address.includes(':') ? `[${address}]` : address
    const headers = new Headers(init.headers)
    headers.set('host', url.host)
    return fetch(target, {
        ...init,
        headers,
        redirect: 'manual',
        tls: { ...tls, serverName: url.hostname },
    } as RequestInit)
}

/** a fetch for the mcp transports that refuses internal addresses and redirects */
export const createGuardedMcpFetch = (options: GuardedFetchOptions = {}) => {
    const { resolve = resolveWithSystem, send = fetchAtAddress } = options

    return async (input: string | URL, init: RequestInit = {}): Promise<Response> => {
        const checked = checkMcpUrl(String(input))
        if (checked.ok === false) throw new McpConnectRefusedError(checked.reason)
        const { url } = checked
        const host = url.hostname.replace(/^\[|\]$/g, '')

        let addresses: string[]
        if (isIpLiteral(host)) {
            addresses = [host]
        } else {
            try {
                addresses = await resolve(host)
            } catch {
                // Intentionally swallowed: a name with no answer is reported with a fixed reason
                addresses = []
            }
        }
        if (addresses.length === 0) throw new McpConnectRefusedError(MCP_REFUSED_NO_ADDRESS)
        // one internal address among the answers refuses the whole name
        if (addresses.some((address) => isInternalAddress(address))) {
            throw new McpConnectRefusedError(MCP_REFUSED_INTERNAL)
        }

        const address = addresses[0] as string
        const response = await send({ url, address, init: { ...init, redirect: 'manual' } })
        if (response.status >= 300 && response.status < 400) {
            await response.body?.cancel().catch(() => {
                // Intentionally swallowed: the answer is dropped anyway
            })
            throw new McpConnectRefusedError(MCP_REFUSED_REDIRECT)
        }
        return response
    }
}
