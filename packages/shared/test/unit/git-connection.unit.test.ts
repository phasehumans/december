import { afterEach, describe, expect, it } from 'bun:test'

import { decryptText, encryptText } from '../../src/crypto'
import { resolveAccessToken } from '../../src/git'

import type { StoredGitConnection } from '../../src/git'

const keyHex = 'ab'.repeat(32)
const oauthApp = { clientId: 'id', clientSecret: 's', redirectUri: 'cb' }
const now = new Date('2026-11-24T12:00:00Z')
const realFetch = globalThis.fetch

const connection = (expiresAt: Date | null, refresh: string | null = 'r1') =>
    ({
        provider: 'GITLAB',
        encryptedAccessToken: encryptText({ text: 'a1', keyHex }),
        encryptedRefreshToken: refresh ? encryptText({ text: refresh, keyHex }) : null,
        expiresAt,
    }) satisfies StoredGitConnection

describe('resolveAccessToken', () => {
    afterEach(() => {
        globalThis.fetch = realFetch
    })

    it('returns the stored token while it is still valid', async () => {
        globalThis.fetch = (() => {
            throw new Error('must not call gitlab')
        }) as any
        const token = await resolveAccessToken({
            connection: connection(new Date(now.getTime() + 10 * 60 * 1000)),
            keyHex,
            oauthApp,
            save: async () => {
                throw new Error('must not save')
            },
            now,
        })
        expect(token).toBe('a1')
    })

    it('refreshes a token that expires within a minute and saves the new pair encrypted', async () => {
        let sentRefresh = ''
        globalThis.fetch = (async (_url: any, init?: RequestInit) => {
            sentRefresh = JSON.parse(String(init?.body)).refresh_token
            return new Response(
                JSON.stringify({ access_token: 'a2', refresh_token: 'r2', expires_in: 7200 })
            )
        }) as any
        const saved: any[] = []

        const token = await resolveAccessToken({
            connection: connection(new Date(now.getTime() + 30 * 1000)),
            keyHex,
            oauthApp,
            save: async (update) => {
                saved.push(update)
            },
            now,
        })

        expect(token).toBe('a2')
        expect(sentRefresh).toBe('r1')
        expect(saved).toHaveLength(1)
        expect(decryptText({ encryptedText: saved[0].encryptedAccessToken, keyHex })).toBe('a2')
        expect(decryptText({ encryptedText: saved[0].encryptedRefreshToken, keyHex })).toBe('r2')
        // saved encrypted, never as the plain token. the encrypted text is random hex, so
        // it can hold the letters "a2" by chance: only the whole value is compared
        expect(saved[0].encryptedAccessToken).not.toBe('a2')
        expect(saved[0].encryptedRefreshToken).not.toBe('r2')
        expect(saved[0].expiresAt).toBeInstanceOf(Date)
    })

    it('uses the token another process saved when its own refresh loses the race', async () => {
        globalThis.fetch = (async () =>
            new Response(JSON.stringify({ error: 'invalid_grant' }), { status: 400 })) as any
        const fresh = {
            ...connection(new Date(now.getTime() + 2 * 60 * 60 * 1000)),
            encryptedAccessToken: encryptText({ text: 'a-other', keyHex }),
        }

        const token = await resolveAccessToken({
            connection: connection(new Date(now.getTime() - 1000)),
            keyHex,
            oauthApp,
            save: async () => {
                throw new Error('must not save')
            },
            reload: async () => fresh,
            now,
        })

        expect(token).toBe('a-other')
    })

    it('asks the user to reconnect when the token expired and cannot be refreshed', async () => {
        await expect(
            resolveAccessToken({
                connection: connection(new Date(now.getTime() - 1000), null),
                keyHex,
                oauthApp,
                save: async () => {},
                now,
            })
        ).rejects.toMatchObject({ status: 401 })

        globalThis.fetch = (async () =>
            new Response(JSON.stringify({ error: 'invalid_grant' }), { status: 400 })) as any
        await expect(
            resolveAccessToken({
                connection: connection(new Date(now.getTime() - 1000)),
                keyHex,
                oauthApp,
                save: async () => {},
                reload: async () => connection(new Date(now.getTime() - 1000)),
                now,
            })
        ).rejects.toMatchObject({ status: 401 })
    })

    it('treats a token without an expiry as valid', async () => {
        const token = await resolveAccessToken({
            connection: connection(null),
            keyHex,
            save: async () => {},
            now,
        })
        expect(token).toBe('a1')
    })
})
