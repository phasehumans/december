import { decryptText, encryptText } from '../crypto'

import { gitlabProvider } from './gitlab'
import { GitProviderError } from './types'

import type { GitProvider, GitProviderName, OAuthApp } from './types'

// a GitConnection row as the server and the worker read it
export interface StoredGitConnection {
    provider: GitProviderName
    encryptedAccessToken: string
    encryptedRefreshToken: string | null
    expiresAt: Date | null
}

export interface GitConnectionTokenUpdate {
    encryptedAccessToken: string
    encryptedRefreshToken: string | null
    expiresAt: Date | null
}

// refresh this long before the token expires, so a clone or push does not start with a
// token that stops working halfway
const REFRESH_MARGIN_MS = 60 * 1000

const refreshers: Partial<Record<GitProviderName, GitProvider>> = {
    GITLAB: gitlabProvider,
}

const isFresh = (connection: StoredGitConnection, now: Date) =>
    !connection.expiresAt || connection.expiresAt.getTime() - REFRESH_MARGIN_MS > now.getTime()

const reconnect = (provider: GitProviderName) =>
    new GitProviderError(`The ${provider.toLowerCase()} connection expired. Connect it again.`, 401)

/**
 * The plain access token of a git connection. A token that expires within a minute is
 * refreshed first and the new pair is saved (encrypted) through `save`. A refresh token
 * works once, so when the server and the worker refresh at the same time one of them loses:
 * that one reads the row again through `reload` and uses the token the other one saved.
 */
export const resolveAccessToken = async (data: {
    connection: StoredGitConnection
    keyHex: string
    oauthApp?: OAuthApp
    save: (update: GitConnectionTokenUpdate) => Promise<void>
    reload?: () => Promise<StoredGitConnection | null>
    now?: Date
}): Promise<string> => {
    const { connection, keyHex, oauthApp, save, reload, now = new Date() } = data
    const decrypt = (encryptedText: string) => decryptText({ encryptedText, keyHex })

    if (isFresh(connection, now)) {
        return decrypt(connection.encryptedAccessToken)
    }

    const provider = refreshers[connection.provider]
    if (!provider || !oauthApp || !connection.encryptedRefreshToken) {
        throw reconnect(connection.provider)
    }

    try {
        const tokens = await provider.refreshToken({
            ...oauthApp,
            refreshToken: decrypt(connection.encryptedRefreshToken),
        })
        await save({
            encryptedAccessToken: encryptText({ text: tokens.accessToken, keyHex }),
            encryptedRefreshToken: tokens.refreshToken
                ? encryptText({ text: tokens.refreshToken, keyHex })
                : null,
            expiresAt: tokens.expiresAt,
        })
        return tokens.accessToken
    } catch (error) {
        const latest = reload ? await reload() : null
        if (latest && isFresh(latest, now)) {
            return decrypt(latest.encryptedAccessToken)
        }
        if (error instanceof GitProviderError) throw reconnect(connection.provider)
        throw error
    }
}
