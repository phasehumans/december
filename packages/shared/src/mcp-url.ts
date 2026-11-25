/**
 * A remote mcp server url a cloud session may connect to (#632 section 2). The worker
 * connects from inside december's network, so only https on a public host is allowed:
 * no localhost, private ranges, link-local (cloud metadata) or bare internal names.
 */
const PRIVATE_IPV4 = [
    /^0\./,
    /^10\./,
    /^127\./,
    /^169\.254\./,
    /^172\.(1[6-9]|2\d|3[01])\./,
    /^192\.168\./,
    /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./,
]

export const checkMcpUrl = (
    value: string
): { ok: true; url: URL } | { ok: false; reason: string } => {
    let url: URL
    try {
        url = new URL(value)
    } catch {
        // Intentionally swallowed: a value that is not a url is reported below
        return { ok: false, reason: 'the url is not valid' }
    }
    if (url.protocol !== 'https:') return { ok: false, reason: 'the url must start with https://' }
    if (url.username || url.password) {
        return { ok: false, reason: 'put credentials in a header, not in the url' }
    }
    const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '')
    if (
        host === 'localhost' ||
        host.endsWith('.localhost') ||
        host.endsWith('.internal') ||
        host.endsWith('.local') ||
        !host.includes('.') ||
        host.includes(':') ||
        PRIVATE_IPV4.some((range) => range.test(host))
    ) {
        return { ok: false, reason: 'the server must be on a public address' }
    }
    return { ok: true, url }
}
