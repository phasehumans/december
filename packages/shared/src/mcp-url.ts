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
    // protocol assignments, the benchmark network, multicast and reserved
    /^192\.0\.0\./,
    /^198\.1[89]\./,
    /^(22[4-9]|2[3-5]\d)\./,
]

// names that only resolve inside a network; none of them is a public top-level domain
const INTERNAL_SUFFIXES = [
    '.localhost',
    '.internal',
    '.local',
    '.localdomain',
    '.lan',
    '.home',
    '.home.arpa',
    '.corp',
    '.intranet',
    '.private',
    '.svc',
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
    // "localhost." is the same host as "localhost": the dot at the end is dropped first
    const host = url.hostname
        .toLowerCase()
        .replace(/^\[|\]$/g, '')
        .replace(/\.+$/, '')
    if (
        host === 'localhost' ||
        INTERNAL_SUFFIXES.some((suffix) => host.endsWith(suffix)) ||
        !host.includes('.') ||
        host.includes(':') ||
        PRIVATE_IPV4.some((range) => range.test(host))
    ) {
        return { ok: false, reason: 'the server must be on a public address' }
    }
    return { ok: true, url }
}

const parseIpv4 = (text: string): number[] | null => {
    const parts = text.split('.')
    if (parts.length !== 4) return null
    const bytes = parts.map((part) => (/^\d{1,3}$/.test(part) ? Number(part) : -1))
    return bytes.every((byte) => byte >= 0 && byte <= 255) ? bytes : null
}

/** the eight 16-bit groups of an ipv6 address, or null when the text is not one */
const parseIpv6 = (text: string): number[] | null => {
    let value = text
    // an ipv4 address at the end ("::ffff:10.0.0.1") is the last two groups
    const lastColon = value.lastIndexOf(':')
    const tail = value.slice(lastColon + 1)
    if (tail.includes('.')) {
        const bytes = parseIpv4(tail)
        if (!bytes) return null
        const [a = 0, b = 0, c = 0, d = 0] = bytes
        value = `${value.slice(0, lastColon + 1)}${((a << 8) | b).toString(16)}:${((c << 8) | d).toString(16)}`
    }
    const halves = value.split('::')
    if (halves.length > 2) return null
    const toGroups = (part: string): number[] | null => {
        if (part === '') return []
        const groups = part
            .split(':')
            .map((group) => (/^[0-9a-f]{1,4}$/i.test(group) ? parseInt(group, 16) : -1))
        return groups.every((group) => group >= 0) ? groups : null
    }
    const head = toGroups(halves[0] ?? '')
    const rest = halves.length === 2 ? toGroups(halves[1] ?? '') : []
    if (!head || !rest) return null
    if (halves.length === 1) return head.length === 8 ? head : null
    const missing = 8 - head.length - rest.length
    if (missing < 1) return null
    return [...head, ...new Array<number>(missing).fill(0), ...rest]
}

/**
 * True when an ip address is not a public one: loopback, private, link-local (cloud
 * metadata), unique-local, multicast, reserved, or an ipv4 address of these ranges
 * written inside an ipv6 address. Text that is not an ip address is also refused.
 * The worker runs this on every address a server name resolves to (review A2).
 */
export const isInternalAddress = (value: string): boolean => {
    const address = value
        .trim()
        .toLowerCase()
        .replace(/^\[|\]$/g, '')
        .replace(/%.*$/, '')
    if (!address.includes(':')) {
        const bytes = parseIpv4(address)
        return !bytes || PRIVATE_IPV4.some((range) => range.test(bytes.join('.')))
    }
    const groups = parseIpv6(address)
    if (!groups) return true
    const [g0 = 0, g1 = 0, g2 = 0, g3 = 0, g4 = 0, g5 = 0, g6 = 0, g7 = 0] = groups
    const embedded = `${g6 >> 8}.${g6 & 255}.${g7 >> 8}.${g7 & 255}`
    const startsWithZeros = g0 === 0 && g1 === 0 && g2 === 0 && g3 === 0 && g4 === 0
    // "::" and "::1", and the old "::a.b.c.d" form
    if (startsWithZeros && g5 === 0) return true
    // ipv4-mapped "::ffff:a.b.c.d"
    if (startsWithZeros && g5 === 0xffff) return isInternalAddress(embedded)
    // nat64 "64:ff9b::a.b.c.d" reaches the ipv4 address inside it
    if (g0 === 0x64 && g1 === 0xff9b) return isInternalAddress(embedded)
    // 6to4 "2002:a.b.c.d::" does the same
    if (g0 === 0x2002) return isInternalAddress(`${g1 >> 8}.${g1 & 255}.${g2 >> 8}.${g2 & 255}`)
    return (
        (g0 & 0xfe00) === 0xfc00 || // unique-local fc00::/7
        (g0 & 0xffc0) === 0xfe80 || // link-local fe80::/10
        (g0 & 0xffc0) === 0xfec0 || // old site-local fec0::/10
        (g0 & 0xff00) === 0xff00 || // multicast
        (g0 === 0x2001 && g1 === 0x0db8) || // documentation
        (g0 === 0x2001 && g1 === 0) || // teredo
        (g0 === 0x100 && g1 === 0 && g2 === 0 && g3 === 0) // discard-only
    )
}
