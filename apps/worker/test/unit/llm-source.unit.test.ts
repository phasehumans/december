import { prisma } from '@december/database'
import { encryptText } from '@december/shared/crypto'
import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test'

import { processGrpcStream } from '../../src/listener'
import {
    loadOwnKeyProvider,
    normalizeBillingSource,
    OwnKeyUnavailableError,
    resolveSecretsEncKey,
    tagOwnKeyErrors,
} from '../../src/llm-source'

const KEY_HEX = 'c3'.repeat(32)

const original = {
    credentialFindUnique: prisma.providerCredential.findUnique,
    credentialUpdate: prisma.providerCredential.update,
    usageCreate: prisma.usageEvent.create,
    sessionFindUnique: prisma.session.findUnique,
    sessionUpdate: prisma.session.update,
    userUpdate: prisma.user.update,
    messageCreate: prisma.message.create,
    messageFindFirst: prisma.message.findFirst,
    transaction: prisma.$transaction,
}
let savedKeyHex: string | undefined

beforeEach(() => {
    savedKeyHex = process.env.SECRETS_ENC_KEY
    process.env.SECRETS_ENC_KEY = KEY_HEX
    prisma.providerCredential.update = mock(async () => ({})) as any
})

afterEach(() => {
    if (savedKeyHex === undefined) delete process.env.SECRETS_ENC_KEY
    else process.env.SECRETS_ENC_KEY = savedKeyHex
    prisma.providerCredential.findUnique = original.credentialFindUnique
    prisma.providerCredential.update = original.credentialUpdate
    prisma.usageEvent.create = original.usageCreate
    prisma.session.findUnique = original.sessionFindUnique
    prisma.session.update = original.sessionUpdate
    prisma.user.update = original.userUpdate
    prisma.message.create = original.messageCreate
    prisma.message.findFirst = original.messageFindFirst
    prisma.$transaction = original.transaction
})

describe('normalizeBillingSource', () => {
    it('only OWN_KEY means own key; anything else is credits', () => {
        expect(normalizeBillingSource('OWN_KEY')).toBe('OWN_KEY')
        expect(normalizeBillingSource('CREDITS')).toBe('CREDITS')
        expect(normalizeBillingSource(undefined)).toBe('CREDITS')
        expect(normalizeBillingSource('own_key')).toBe('CREDITS')
    })
})

describe('loadOwnKeyProvider', () => {
    it('decrypts the saved key and builds a client for that provider', async () => {
        prisma.providerCredential.findUnique = mock(async () => ({
            encryptedKey: encryptText({ text: 'gsk_user_key_1234', keyHex: KEY_HEX }),
            defaultModel: 'llama-3.3-70b-versatile',
        })) as any
        const ownKey = await loadOwnKeyProvider({ userId: 'u1', provider: 'groq' })
        expect(ownKey.llm.id).toBe('groq')
        expect(typeof ownKey.llm.stream).toBe('function')
        // a run that names no model uses this, never december's default model
        expect(ownKey.defaultModel).toBe('llama-3.3-70b-versatile')
    })

    it('fails clearly when the key is gone, never falling back', async () => {
        prisma.providerCredential.findUnique = mock(async () => null) as any
        const error = await loadOwnKeyProvider({ userId: 'u1', provider: 'groq' }).catch((e) => e)
        expect(error).toBeInstanceOf(OwnKeyUnavailableError)
        expect(error.message).toContain('Groq key is no longer saved')
    })

    it('fails clearly when the saved key cannot be decrypted', async () => {
        prisma.providerCredential.findUnique = mock(async () => ({
            encryptedKey: encryptText({ text: 'gsk_user_key', keyHex: 'd4'.repeat(32) }),
        })) as any
        const error = await loadOwnKeyProvider({ userId: 'u1', provider: 'groq' }).catch((e) => e)
        expect(error).toBeInstanceOf(OwnKeyUnavailableError)
        expect(error.message).toContain('cannot be read')
    })

    it('needs a user and a provider', async () => {
        await expect(loadOwnKeyProvider({ userId: 'u1' })).rejects.toBeInstanceOf(
            OwnKeyUnavailableError
        )
    })
})

describe('resolveSecretsEncKey', () => {
    const withEnv = (env: { key?: string; nodeEnv?: string }, run: () => void) => {
        const saved = { key: process.env.SECRETS_ENC_KEY, nodeEnv: process.env.NODE_ENV }
        if (env.key === undefined) delete process.env.SECRETS_ENC_KEY
        else process.env.SECRETS_ENC_KEY = env.key
        process.env.NODE_ENV = env.nodeEnv
        try {
            run()
        } finally {
            if (saved.key === undefined) delete process.env.SECRETS_ENC_KEY
            else process.env.SECRETS_ENC_KEY = saved.key
            process.env.NODE_ENV = saved.nodeEnv
        }
    }

    it('uses the same development default as the server', () => {
        withEnv({ nodeEnv: 'development' }, () => {
            expect(resolveSecretsEncKey()).toBe('0'.repeat(64))
        })
    })

    it('needs a real key in production', () => {
        withEnv({ nodeEnv: 'production' }, () => {
            expect(resolveSecretsEncKey()).toBeUndefined()
        })
        withEnv({ nodeEnv: 'production', key: '0'.repeat(64) }, () => {
            expect(resolveSecretsEncKey()).toBeUndefined()
        })
        withEnv({ nodeEnv: 'production', key: KEY_HEX }, () => {
            expect(resolveSecretsEncKey()).toBe(KEY_HEX)
        })
    })
})

describe('tagOwnKeyErrors', () => {
    const collect = async (events: object[]) => {
        async function* source() {
            for (const e of events) yield { data: JSON.stringify(e) }
        }
        const out: any[] = []
        for await (const e of tagOwnKeyErrors(source(), 'groq')) out.push(JSON.parse(e.data))
        return out
    }

    it('marks key failures as BYOK_KEY_FAILED', async () => {
        const out = await collect([
            { type: 'AgentError', code: 'BAD_KEY', error: 'rejected' },
            { type: 'AgentError', code: 'NO_CREDITS', error: 'no credits' },
            { type: 'AgentError', code: 'FORBIDDEN', error: 'refused' },
        ])
        expect(out.map((e) => e.code)).toEqual([
            'BYOK_KEY_FAILED',
            'BYOK_KEY_FAILED',
            'BYOK_KEY_FAILED',
        ])
        expect(out.map((e) => e.keyFailure)).toEqual(['bad_key', 'no_credits', 'forbidden'])
        expect(out[0]).toMatchObject({ provider: 'groq', billingSource: 'OWN_KEY' })
    })

    it('leaves other events and other errors unchanged', async () => {
        const out = await collect([
            { type: 'StreamChunk', content: 'hi' },
            { type: 'AgentError', code: 'MODEL_UNAVAILABLE', error: 'no model' },
        ])
        expect(out[0]).toEqual({ type: 'StreamChunk', content: 'hi' })
        expect(out[1].code).toBe('MODEL_UNAVAILABLE')
    })
})

describe('usage billing by source', () => {
    let usageCreate: ReturnType<typeof mock>
    let userUpdate: ReturnType<typeof mock>

    beforeEach(() => {
        usageCreate = mock(async (args: any) => ({ id: 'usage-1', ...args.data }))
        userUpdate = mock(async () => ({}))
        prisma.usageEvent.create = usageCreate as any
        prisma.user.update = userUpdate as any
        prisma.session.findUnique = mock(async () => ({ userId: 'user-1' })) as any
        prisma.session.update = mock(async () => ({})) as any
        prisma.message.create = mock(async (args: any) => ({ id: 'm1', ...args.data })) as any
        prisma.message.findFirst = mock(async () => ({ sequence: 1 })) as any
        prisma.$transaction = mock(async (cb: any) => cb(prisma)) as any
    })

    async function* usageStream() {
        yield {
            data: JSON.stringify({
                type: 'AgentUsage',
                promptTokens: 1000,
                completionTokens: 500,
                model: 'llama-3.3-70b-versatile',
            }),
        }
        yield { data: JSON.stringify({ type: 'AgentEnd' }) }
    }

    it('charges the wallet on credits', async () => {
        await processGrpcStream('s-credits', usageStream(), undefined, {
            billingSource: 'CREDITS',
        })
        expect(userUpdate).toHaveBeenCalledTimes(1)
        expect(usageCreate.mock.calls[0]![0].data.billingSource).toBe('CREDITS')
    })

    it('records own-key usage without touching the wallet', async () => {
        await processGrpcStream('s-own-key', usageStream(), undefined, {
            billingSource: 'OWN_KEY',
        })
        expect(userUpdate).not.toHaveBeenCalled()
        const data = usageCreate.mock.calls[0]![0].data
        expect(data.billingSource).toBe('OWN_KEY')
        expect(data.costInCents).toBeGreaterThan(0)
        expect(data.totalTokens).toBe(1500)
    })
})
