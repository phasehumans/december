import { describe, it, expect } from 'bun:test'

import { checkMcpUrl, isInternalAddress } from '../../src/mcp-url'

const PUBLIC_ADDRESS = 'the server must be on a public address'

const refused = (url: string) => {
    const result = checkMcpUrl(url)
    return result.ok ? `${url} was allowed` : result.reason
}

// issue 632 section 2: the url of a remote mcp server a cloud session may connect to
describe('checkMcpUrl', () => {
    it('allows https on a public host', () => {
        for (const url of [
            'https://mcp.example.com/mcp',
            'https://mcp.linear.app/sse',
            'https://example.com:8443/mcp?team=web',
            'https://MCP.Example.com/mcp',
            'https://1.1.1.1/mcp',
            'https://172.15.0.1/mcp',
            'https://172.32.0.1/mcp',
            'https://192.167.1.1/mcp',
            'https://100.63.0.1/mcp',
            'https://100.128.0.1/mcp',
            'https://169.253.0.1/mcp',
            'https://internal.example.com/mcp',
        ]) {
            expect({ url, ok: checkMcpUrl(url).ok }).toEqual({ url, ok: true })
        }
    })

    it('returns the parsed url', () => {
        const result = checkMcpUrl('https://mcp.example.com/mcp?team=web')
        expect(result.ok).toBe(true)
        if (result.ok) {
            expect(result.url.hostname).toBe('mcp.example.com')
            expect(result.url.pathname).toBe('/mcp')
        }
    })

    it('refuses a value that is not a url', () => {
        for (const url of [
            '',
            'mcp.example.com',
            '//mcp.example.com/mcp',
            'https://exa mple.com',
        ]) {
            expect(refused(url)).toBe('the url is not valid')
        }
    })

    it('takes https only', () => {
        for (const url of [
            'http://mcp.example.com/mcp',
            'ws://mcp.example.com/mcp',
            'wss://mcp.example.com/mcp',
            'ftp://mcp.example.com/mcp',
            'file:///etc/passwd',
            'javascript:alert(1)',
        ]) {
            expect(refused(url)).toBe('the url must start with https://')
        }
    })

    it('refuses localhost', () => {
        for (const url of [
            'https://localhost/mcp',
            'https://localhost:3000/mcp',
            'https://LOCALHOST/mcp',
            'https://api.localhost/mcp',
            'https://127.0.0.1/mcp',
            'https://127.8.9.10/mcp',
            'https://0.0.0.0/mcp',
        ]) {
            expect(refused(url)).toBe(PUBLIC_ADDRESS)
        }
    })

    it('refuses the private ranges 10/8, 172.16/12 and 192.168/16', () => {
        for (const url of [
            'https://10.0.0.1/mcp',
            'https://10.255.255.254/mcp',
            'https://172.16.0.1/mcp',
            'https://172.20.10.5/mcp',
            'https://172.31.255.254/mcp',
            'https://192.168.0.1/mcp',
            'https://192.168.255.254:8443/mcp',
        ]) {
            expect(refused(url)).toBe(PUBLIC_ADDRESS)
        }
    })

    it('refuses link-local 169.254/16, where cloud metadata lives', () => {
        for (const url of [
            'https://169.254.169.254/latest/meta-data/',
            'https://169.254.0.1/mcp',
        ]) {
            expect(refused(url)).toBe(PUBLIC_ADDRESS)
        }
    })

    it('refuses shared, reserved and multicast ipv4 ranges', () => {
        for (const url of [
            'https://100.64.0.1/mcp',
            'https://100.127.255.254/mcp',
            'https://192.0.0.8/mcp',
            'https://198.18.0.1/mcp',
            'https://198.19.255.254/mcp',
            'https://224.0.0.1/mcp',
            'https://240.0.0.1/mcp',
            'https://255.255.255.255/mcp',
        ]) {
            expect(refused(url)).toBe(PUBLIC_ADDRESS)
        }
    })

    it('refuses ipv6 loopback, unique-local and link-local', () => {
        for (const url of [
            'https://[::1]/mcp',
            'https://[::]/mcp',
            'https://[fc00::1]/mcp',
            'https://[fd12:3456:789a::1]/mcp',
            'https://[fe80::1]/mcp',
        ]) {
            expect(refused(url)).toBe(PUBLIC_ADDRESS)
        }
    })

    it('refuses internal names', () => {
        for (const url of [
            'https://redis/mcp',
            'https://intranet/mcp',
            'https://db.internal/mcp',
            'https://metadata.google.internal/computeMetadata/v1/',
            'https://printer.local/mcp',
            'https://api.default.svc.cluster.local/mcp',
            'https://api.default.svc/mcp',
            'https://nas.lan/mcp',
            'https://router.home.arpa/mcp',
            'https://box.localdomain/mcp',
            'https://wiki.corp/mcp',
            'https://wiki.intranet/mcp',
        ]) {
            expect(refused(url)).toBe(PUBLIC_ADDRESS)
        }
    })

    describe('forms that hide an address', () => {
        it('refuses an ip written as one decimal or hex number', () => {
            for (const url of [
                // 127.0.0.1
                'https://2130706433/mcp',
                'https://0x7f000001/mcp',
                'https://017700000001/mcp',
                // 169.254.169.254
                'https://2852039166/mcp',
                'https://0xa9fea9fe/mcp',
                // 10.0.0.1
                'https://167772161/mcp',
            ]) {
                expect(refused(url)).toBe(PUBLIC_ADDRESS)
            }
        })

        it('refuses short, octal and hex dotted forms', () => {
            for (const url of [
                'https://127.1/mcp',
                'https://0177.0.0.1/mcp',
                'https://0x7f.0.0.1/mcp',
                'https://10.1/mcp',
                'https://192.168.257/mcp',
            ]) {
                expect(refused(url)).toBe(PUBLIC_ADDRESS)
            }
        })

        it('refuses a trailing dot', () => {
            for (const url of [
                'https://localhost./mcp',
                'https://localhost.:8443/mcp',
                'https://api.localhost./mcp',
                'https://127.0.0.1./mcp',
                'https://10.0.0.1./mcp',
                'https://db.internal./mcp',
                'https://printer.local./mcp',
                'https://redis./mcp',
                // the ideographic full stop becomes a dot
                'https://localhost。/mcp',
            ]) {
                expect(refused(url)).toBe(PUBLIC_ADDRESS)
            }
        })

        it('refuses userinfo in the url', () => {
            for (const url of [
                'https://x@127.0.0.1/mcp',
                'https://mcp.example.com@127.0.0.1/mcp',
                'https://user:secret@mcp.example.com/mcp',
                'https://token@mcp.example.com/mcp',
            ]) {
                expect(refused(url)).toBe('put credentials in a header, not in the url')
            }
        })

        it('refuses ipv4-mapped and other ipv6 forms of a private address', () => {
            for (const url of [
                'https://[::ffff:127.0.0.1]/mcp',
                'https://[::ffff:7f00:1]/mcp',
                'https://[::ffff:10.0.0.1]/mcp',
                'https://[::ffff:169.254.169.254]/mcp',
                'https://[0:0:0:0:0:ffff:c0a8:1]/mcp',
                'https://[64:ff9b::7f00:1]/mcp',
                'https://[0000:0000:0000:0000:0000:0000:0000:0001]/mcp',
            ]) {
                expect(refused(url)).toBe(PUBLIC_ADDRESS)
            }
        })

        it('refuses a percent-encoded or full-width host', () => {
            for (const url of [
                'https://%6c%6f%63%61%6c%68%6f%73%74/mcp',
                'https://%31%32%37.0.0.1/mcp',
                'https://１２７.0.0.1/mcp',
            ]) {
                expect(refused(url)).toBe(PUBLIC_ADDRESS)
            }
        })
    })
})

// review A2: the address a server name resolves to gets the same range rules
describe('isInternalAddress', () => {
    it('refuses loopback, private, link-local and other internal ipv4 addresses', () => {
        for (const address of [
            '127.0.0.1',
            '10.1.2.3',
            '169.254.169.254',
            '172.16.0.1',
            '192.168.1.1',
            '100.64.0.1',
            '0.0.0.0',
            '224.0.0.1',
        ]) {
            expect(isInternalAddress(address)).toBe(true)
        }
    })

    it('refuses internal ipv6 addresses, also an ipv4 address written as ipv6', () => {
        for (const address of [
            '::1',
            '::',
            'fd00::1',
            'fc00::1',
            'fe80::1',
            'fe80::1%eth0',
            'ff02::1',
            '::ffff:127.0.0.1',
            '::ffff:7f00:1',
            '::ffff:10.0.0.1',
            '64:ff9b::a9fe:a9fe',
            '2001:db8::1',
            '[::1]',
        ]) {
            expect(isInternalAddress(address)).toBe(true)
        }
    })

    it('refuses text that is not an ip address', () => {
        expect(isInternalAddress('')).toBe(true)
        expect(isInternalAddress('example.com')).toBe(true)
        expect(isInternalAddress('1.2.3')).toBe(true)
        expect(isInternalAddress('999.1.1.1')).toBe(true)
        expect(isInternalAddress('gggg::1')).toBe(true)
    })

    it('allows public addresses', () => {
        for (const address of [
            '93.184.216.34',
            '8.8.8.8',
            '172.32.0.1',
            '2606:4700:4700::1111',
            '::ffff:8.8.8.8',
        ]) {
            expect(isInternalAddress(address)).toBe(false)
        }
    })
})
