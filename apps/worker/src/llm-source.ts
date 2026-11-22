import { prisma } from '@december/database'
import { BYOK_PROVIDERS, ByokError, createByokProvider } from '@december/providers'
import { decryptText } from '@december/shared/crypto'

import type { LLMProvider } from '@december/providers'

/**
 * How a cloud run pays for model tokens. CREDITS uses december's env keys and the
 * user's wallet. OWN_KEY uses the user's saved key: it is loaded and decrypted here,
 * kept in memory only, and never put in job data, logs or the sandbox.
 */
export type BillingSource = 'CREDITS' | 'OWN_KEY'

export const normalizeBillingSource = (value: unknown): BillingSource =>
    value === 'OWN_KEY' ? 'OWN_KEY' : 'CREDITS'

export class OwnKeyUnavailableError extends Error {
    constructor(message: string) {
        super(message)
        this.name = 'OwnKeyUnavailableError'
    }
}

// same rules as SECRETS_ENC_KEY in apps/server/src/env.ts, so a key the server saved can
// always be read here: a development default outside production, a real key in production
const DEV_SECRETS_ENC_KEY = '0'.repeat(64)

export const resolveSecretsEncKey = (): string | undefined => {
    const configured = process.env.SECRETS_ENC_KEY?.trim()
    if (process.env.NODE_ENV === 'production') {
        return configured && configured !== DEV_SECRETS_ENC_KEY ? configured : undefined
    }
    return configured || DEV_SECRETS_ENC_KEY
}

const providerName = (provider: string) =>
    BYOK_PROVIDERS.find((p) => p.id === provider)?.name || provider

export type OwnKeyClient = {
    llm: LLMProvider
    /** the model the key was checked with; used when a run names no model */
    defaultModel: string
}

export const loadOwnKeyProvider = async (data: {
    userId?: string
    provider?: string
}): Promise<OwnKeyClient> => {
    const { userId, provider } = data
    if (!userId || !provider) {
        throw new OwnKeyUnavailableError('Pick a model from your own keys to run on your key.')
    }

    const credential = await prisma.providerCredential.findUnique({
        where: { userId_provider: { userId, provider } },
        select: { encryptedKey: true, defaultModel: true },
    })
    if (!credential) {
        throw new OwnKeyUnavailableError(
            `Your ${providerName(provider)} key is no longer saved. Add it again in Settings, Model keys.`
        )
    }

    const keyHex = resolveSecretsEncKey()
    if (!keyHex) {
        throw new OwnKeyUnavailableError('Own keys are not configured on this server.')
    }

    let apiKey: string
    try {
        apiKey = decryptText({ encryptedText: credential.encryptedKey, keyHex })
    } catch {
        throw new OwnKeyUnavailableError(
            `Your saved ${providerName(provider)} key cannot be read. Add it again in Settings, Model keys.`
        )
    }

    let client: LLMProvider
    try {
        client = createByokProvider({ provider, apiKey })
    } catch (error) {
        if (error instanceof ByokError) throw new OwnKeyUnavailableError(error.message)
        throw error
    }

    prisma.providerCredential
        .update({
            where: { userId_provider: { userId, provider } },
            data: { lastUsedAt: new Date() },
        })
        .catch(() => {
            // Intentionally swallowed: lastUsedAt is informational only
        })

    return { llm: client, defaultModel: credential.defaultModel }
}

// agent-loop error codes that mean the user's key itself failed
const KEY_FAILURE_CODES: Record<string, 'bad_key' | 'forbidden' | 'no_credits'> = {
    BAD_KEY: 'bad_key',
    FORBIDDEN: 'forbidden',
    NO_CREDITS: 'no_credits',
}

/**
 * Marks key failures on an own-key run as BYOK_KEY_FAILED, so the web app can offer
 * "switch to december credits". The run is never switched automatically.
 */
export async function* tagOwnKeyErrors(
    stream: AsyncIterable<{ data: string }>,
    provider: string
): AsyncGenerator<{ data: string }> {
    for await (const event of stream) {
        let parsed: any
        try {
            parsed = JSON.parse(event.data)
        } catch {
            yield event
            continue
        }
        const keyFailure =
            parsed?.type === 'AgentError' ? KEY_FAILURE_CODES[parsed.code] : undefined
        if (!keyFailure) {
            yield event
            continue
        }
        yield {
            data: JSON.stringify({
                ...parsed,
                code: 'BYOK_KEY_FAILED',
                keyFailure,
                provider,
                billingSource: 'OWN_KEY',
            }),
        }
    }
}
