import { execSync } from 'node:child_process'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import type { SubscriptionAdapter, SubscriptionTokenBundle } from '../types'

const DEFAULT_ENDPOINT = 'https://api2.cursor.sh'

function decodeJwtPayload(token: string): any | null {
    try {
        const parts = token.split('.')
        const payloadPart = parts[1]
        if (parts.length === 3 && payloadPart) {
            const decoded = Buffer.from(payloadPart, 'base64url').toString('utf-8')
            return JSON.parse(decoded)
        }
    } catch {
        // Intentionally swallowed: invalid base64url token
    }
    return null
}

async function extractFromSqlite(dbPath: string): Promise<{
    accessToken?: string
    refreshToken?: string
    email?: string
    membershipType?: string
} | null> {
    // 1. Attempt bun:sqlite if running in Bun runtime
    try {
        const bunSqlite = await import('bun:sqlite' as any)
        if (bunSqlite && bunSqlite.Database) {
            const db = new bunSqlite.Database(dbPath, { readonly: true })
            const rows = db
                .query(`SELECT key, value FROM ItemTable WHERE key LIKE 'cursorAuth/%'`)
                .all() as Array<{ key: string; value: string }>
            db.close()

            const data: Record<string, string> = {}
            for (const row of rows) {
                data[row.key] = row.value
            }

            const accessToken = data['cursorAuth/accessToken']
            if (accessToken) {
                return {
                    accessToken,
                    refreshToken: data['cursorAuth/refreshToken'],
                    email: data['cursorAuth/cachedEmail'],
                    membershipType: data['cursorAuth/stripeMembershipType'],
                }
            }
        }
    } catch {
        // Intentionally swallowed: bun:sqlite unavailable or failed
    }

    // 2. Fallback to sqlite3 CLI
    try {
        const redirect = process.platform === 'win32' ? '2>NUL' : '2>/dev/null'
        const output = execSync(
            `sqlite3 "${dbPath}" "SELECT key, value FROM ItemTable WHERE key LIKE 'cursorAuth/%';" ${redirect}`,
            { encoding: 'utf-8', timeout: 2000, stdio: ['pipe', 'pipe', 'ignore'] }
        )

        const lines = output.split('\n')
        const data: Record<string, string> = {}
        for (const line of lines) {
            const separatorIdx = line.indexOf('|')
            if (separatorIdx !== -1) {
                const k = line.slice(0, separatorIdx).trim()
                const v = line.slice(separatorIdx + 1).trim()
                data[k] = v
            }
        }

        if (data['cursorAuth/accessToken']) {
            return {
                accessToken: data['cursorAuth/accessToken'],
                refreshToken: data['cursorAuth/refreshToken'],
                email: data['cursorAuth/cachedEmail'],
                membershipType: data['cursorAuth/stripeMembershipType'],
            }
        }
    } catch {
        // Intentionally swallowed: sqlite3 CLI not found or failed
    }

    return null
}

export const cursorAdapter: SubscriptionAdapter = {
    provider: 'cursor',
    displayName: 'Cursor Pro (Experimental)',

    async detectLocal(): Promise<SubscriptionTokenBundle | null> {
        // 1. Check environment variables
        const envToken =
            process.env.CURSOR_TOKEN || process.env.CURSOR_AUTH_TOKEN || process.env.CURSOR_API_KEY

        if (envToken) {
            const payload = decodeJwtPayload(envToken)
            return {
                provider: 'cursor',
                accessToken: envToken,
                subscriptionType: 'cursor_pro',
                email: payload?.email,
                source: 'env',
                updatedAt: Date.now(),
                endpoint: DEFAULT_ENDPOINT,
            }
        }

        const home = process.env.HOME || os.homedir()

        // 2. Check JSON configuration files (~/.cursor/auth.json, storage.json)
        const jsonCandidatePaths = [
            path.join(home, '.cursor', 'auth.json'),
            path.join(home, '.cursor.json'),
            path.join(home, '.config', 'Cursor', 'User', 'globalStorage', 'storage.json'),
            path.join(
                home,
                'Library',
                'Application Support',
                'Cursor',
                'User',
                'globalStorage',
                'storage.json'
            ),
        ]

        for (const filePath of jsonCandidatePaths) {
            try {
                const raw = await fs.readFile(filePath, 'utf-8')
                const parsed = JSON.parse(raw)
                const accessToken =
                    parsed.accessToken ||
                    parsed.access_token ||
                    parsed.token ||
                    parsed['cursorAuth/accessToken']

                if (accessToken) {
                    const payload = decodeJwtPayload(accessToken)
                    const email = parsed.email || parsed['cursorAuth/cachedEmail'] || payload?.email
                    const membership =
                        parsed.membershipType || parsed['cursorAuth/stripeMembershipType'] || 'pro'

                    return {
                        provider: 'cursor',
                        accessToken,
                        refreshToken:
                            parsed.refreshToken ||
                            parsed.refresh_token ||
                            parsed['cursorAuth/refreshToken'],
                        expiresAt:
                            parsed.expiresAt || (payload?.exp ? payload.exp * 1000 : undefined),
                        email,
                        subscriptionType:
                            membership === 'business' ? 'cursor_business' : 'cursor_pro',
                        source: 'local_import',
                        updatedAt: Date.now(),
                        endpoint: DEFAULT_ENDPOINT,
                        extra: { filePath },
                    }
                }
            } catch {
                // Intentionally swallowed: JSON file not readable
            }
        }

        // 3. Check Cursor SQLite state database (state.vscdb)
        const sqliteCandidatePaths = [
            path.join(home, '.config', 'Cursor', 'User', 'globalStorage', 'state.vscdb'),
            path.join(
                home,
                'Library',
                'Application Support',
                'Cursor',
                'User',
                'globalStorage',
                'state.vscdb'
            ),
            path.join(home, 'AppData', 'Roaming', 'Cursor', 'User', 'globalStorage', 'state.vscdb'),
        ]

        for (const dbPath of sqliteCandidatePaths) {
            try {
                const extracted = await extractFromSqlite(dbPath)
                if (extracted?.accessToken) {
                    const payload = decodeJwtPayload(extracted.accessToken)
                    return {
                        provider: 'cursor',
                        accessToken: extracted.accessToken,
                        refreshToken: extracted.refreshToken,
                        expiresAt: payload?.exp ? payload.exp * 1000 : undefined,
                        email: extracted.email || payload?.email,
                        subscriptionType:
                            extracted.membershipType === 'business'
                                ? 'cursor_business'
                                : 'cursor_pro',
                        source: 'local_import',
                        updatedAt: Date.now(),
                        endpoint: DEFAULT_ENDPOINT,
                        extra: { dbPath },
                    }
                }
            } catch {
                // Intentionally swallowed: database extraction failure
            }
        }

        return null
    },

    async refreshToken(bundle: SubscriptionTokenBundle): Promise<SubscriptionTokenBundle> {
        if (!bundle.refreshToken) {
            return bundle
        }

        // Attempt refreshing token against Cursor auth endpoint if available
        try {
            const res = await fetch('https://authenticator.cursor.sh/auth/refresh', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ refresh_token: bundle.refreshToken }),
            })

            if (res.ok) {
                const data = (await res.json()) as any
                const newAccessToken = data.accessToken || data.access_token
                const newRefreshToken =
                    data.refreshToken || data.refresh_token || bundle.refreshToken
                const payload = decodeJwtPayload(newAccessToken)

                return {
                    ...bundle,
                    accessToken: newAccessToken,
                    refreshToken: newRefreshToken,
                    expiresAt: payload?.exp ? payload.exp * 1000 : undefined,
                    updatedAt: Date.now(),
                }
            }
        } catch {
            // Intentionally swallowed: refresh fallback handled
        }

        return bundle
    },

    async loginOAuth(
        onCode?: (code: string, uri: string) => void
    ): Promise<SubscriptionTokenBundle> {
        // Cursor does not expose a public OAuth authorization portal.
        // Prompt user with login instructions or local import detection.
        const localDetected = await this.detectLocal()
        if (localDetected) {
            return localDetected
        }

        const loginUrl = 'https://www.cursor.com/settings'
        if (onCode) {
            onCode('CURSOR-AUTH', loginUrl)
        }

        throw new Error(
            'Cursor Pro does not provide a public OAuth portal. Please log into Cursor desktop app, or set CURSOR_TOKEN in your environment.'
        )
    },

    async verifyToken(bundle?: SubscriptionTokenBundle | null): Promise<boolean> {
        if (!bundle || !bundle.accessToken) return false
        if (bundle.expiresAt && bundle.expiresAt < Date.now() && !bundle.refreshToken) {
            return false
        }
        return true
    },
}
