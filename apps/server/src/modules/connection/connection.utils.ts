import { decryptText, encryptText } from '@december/shared/crypto'

import { env } from '../../env'

import type { McpHeader } from './connection.types'

type StoredMcpServer = {
    name: string
    url: string
    transport: string
    auth: string
    headerKeys: string[]
    enabled: boolean
    disabledTools: string[]
    status: string
    lastError: string | null
    tools: string[]
    checkedAt: Date | null
}

/** an mcp server as the web sees it: header names only, never their values */
export const toPublicMcpServer = (server: StoredMcpServer) => ({
    name: server.name,
    url: server.url,
    transport: server.transport,
    auth: server.auth,
    headerKeys: server.headerKeys,
    enabled: server.enabled,
    disabledTools: server.disabledTools,
    status: server.status,
    lastError: server.lastError,
    tools: server.tools,
    checkedAt: server.checkedAt,
})

export const readHeaders = (encrypted: string | null): Record<string, string> => {
    if (!encrypted) return {}
    try {
        const parsed = JSON.parse(
            decryptText({ encryptedText: encrypted, keyHex: env.SECRETS_ENC_KEY })
        )
        return parsed && typeof parsed === 'object' ? parsed : {}
    } catch (error) {
        console.error('[Connection] saved mcp headers could not be read', error)
        return {}
    }
}

/**
 * The headers to save: an empty value keeps the saved value of that header, a header
 * left out is removed. Returns the encrypted json and the names.
 */
export const mergeHeaders = (
    headers: McpHeader[],
    savedEncrypted: string | null
): { encryptedHeaders: string | null; headerKeys: string[] } => {
    const saved = readHeaders(savedEncrypted)
    const merged: Record<string, string> = {}
    for (const header of headers) {
        const value = header.value || saved[header.key]
        if (value) merged[header.key] = value
    }
    const headerKeys = Object.keys(merged)
    if (headerKeys.length === 0) return { encryptedHeaders: null, headerKeys }
    return {
        encryptedHeaders: encryptText({
            text: JSON.stringify(merged),
            keyHex: env.SECRETS_ENC_KEY,
        }),
        headerKeys,
    }
}
