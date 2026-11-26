import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import {
    readTokenExpiryMs,
    requestRenewedToken,
    renewDecemberTokenIfExpired,
} from '../src/auth/renew'

// a real config file in a temp folder: mocking the config module leaks into other test files
const configDir = fs.mkdtempSync(path.join(os.tmpdir(), 'december-renew-'))
const configFile = path.join(configDir, 'config.json')

const writeToken = (token: string) =>
    fs.writeFileSync(configFile, JSON.stringify({ decemberToken: token }))
const readToken = () => JSON.parse(fs.readFileSync(configFile, 'utf8')).decemberToken

const tokenExpiringAt = (expMs: number) => {
    const part = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url')
    return `${part({ alg: 'HS256' })}.${part({ exp: Math.floor(expMs / 1000) })}.signature`
}

const refreshAnswer = (accessToken: string) =>
    ({
        ok: true,
        json: async () => ({ success: true, data: { accessToken, token: accessToken } }),
    }) as Response

describe('december token renewal', () => {
    const originalFetch = global.fetch
    const originalConfigDir = process.env.DECEMBER_CONFIG_DIR

    beforeEach(() => {
        vi.clearAllMocks()
        process.env.DECEMBER_CONFIG_DIR = configDir
    })

    afterEach(() => {
        global.fetch = originalFetch
        if (originalConfigDir === undefined) delete process.env.DECEMBER_CONFIG_DIR
        else process.env.DECEMBER_CONFIG_DIR = originalConfigDir
    })

    it('reads the expiry of a token, and nothing from a value that is not one', () => {
        const expMs = Date.UTC(2026, 10, 26, 10, 0, 0)
        expect(readTokenExpiryMs(tokenExpiringAt(expMs))).toBe(expMs)
        expect(readTokenExpiryMs('test_token')).toBeUndefined()
        expect(readTokenExpiryMs('a.not-json.c')).toBeUndefined()
    })

    it('sends the token in the body and returns the new one', async () => {
        const fetchMock = vi.fn(async () => refreshAnswer('new-token'))
        global.fetch = fetchMock as any

        const next = await requestRenewedToken({ token: 'old', serverUrl: 'http://server' })

        expect(next).toBe('new-token')
        const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
        expect(url).toBe('http://server/api/v1/auth/refresh')
        expect(JSON.parse(init.body as string)).toEqual({ refreshToken: 'old' })
        expect((init.headers as Record<string, string>)['User-Agent']).toContain('december-cli')
    })

    it('returns nothing when the server says no or cannot be reached', async () => {
        global.fetch = vi.fn(async () => ({ ok: false, json: async () => ({}) })) as any
        expect(await requestRenewedToken({ token: 'old', serverUrl: 'http://s' })).toBeUndefined()

        global.fetch = vi.fn(async () => {
            throw new Error('fetch failed')
        }) as any
        expect(await requestRenewedToken({ token: 'old', serverUrl: 'http://s' })).toBeUndefined()
    })

    it('renews and saves an expired token', async () => {
        writeToken(tokenExpiringAt(Date.now() - 60_000))
        global.fetch = vi.fn(async () => refreshAnswer('renewed')) as any

        await renewDecemberTokenIfExpired()

        expect(readToken()).toBe('renewed')
    })

    it('leaves a token that still works, so other open windows keep working', async () => {
        const token = tokenExpiringAt(Date.now() + 60_000)
        writeToken(token)
        const fetchMock = vi.fn(async () => refreshAnswer('renewed'))
        global.fetch = fetchMock as any

        await renewDecemberTokenIfExpired()

        expect(fetchMock).not.toHaveBeenCalled()
        expect(readToken()).toBe(token)
    })

    it('keeps the old token when the renewal fails', async () => {
        const token = tokenExpiringAt(Date.now() - 60_000)
        writeToken(token)
        global.fetch = vi.fn(async () => ({ ok: false, json: async () => ({}) })) as any

        await renewDecemberTokenIfExpired()

        expect(readToken()).toBe(token)
    })
})
