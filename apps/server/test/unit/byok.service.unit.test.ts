import { decryptText } from '@december/shared/crypto'
import { describe, expect, it } from 'bun:test'

import { env } from '../../src/env'
import { byokRepository } from '../../src/modules/byok/byok.repository'
import {
    providerParamSchema,
    refreshCredentialSchema,
    saveCredentialSchema,
} from '../../src/modules/byok/byok.schema'
import { byokService } from '../../src/modules/byok/byok.service'
import {
    MAX_MODELS,
    buildKeyHint,
    byokUtils,
    cleanModelIds,
    providerName,
    redactKey,
    toCredentialSummary,
    verifyFailureMessage,
} from '../../src/modules/byok/byok.utils'
import { AppError } from '../../src/shared/appError'

const summaryRow = (overrides: Record<string, unknown> = {}) => ({
    provider: 'groq',
    keyHint: 'abcd',
    models: ['llama-3.3-70b-versatile'],
    defaultModel: 'llama-3.3-70b-versatile',
    verifiedAt: new Date('2026-11-22T00:00:00Z'),
    lastUsedAt: null,
    ...overrides,
})

// replaces repository functions and the network check for one test
const withStubs = async (
    stubs: {
        verify?: (data: any) => Promise<any>
        upsert?: (data: any) => Promise<any>
        summary?: any
        withKey?: any
        update?: (data: any) => Promise<boolean>
        deleteCount?: number
        list?: any[]
    },
    run: (calls: { upserts: any[]; verifies: any[]; updates: any[] }) => Promise<void>
) => {
    const calls = { upserts: [] as any[], verifies: [] as any[], updates: [] as any[] }
    const original = {
        verifyKey: byokUtils.verifyKey,
        upsertCredential: byokRepository.upsertCredential,
        findCredentialSummary: byokRepository.findCredentialSummary,
        findCredentialWithKey: byokRepository.findCredentialWithKey,
        updateVerification: byokRepository.updateVerification,
        deleteCredential: byokRepository.deleteCredential,
        findCredentialsByUser: byokRepository.findCredentialsByUser,
    }
    byokUtils.verifyKey = (async (data: any) => {
        calls.verifies.push(data)
        return stubs.verify
            ? stubs.verify(data)
            : {
                  ok: true,
                  models: ['llama-3.3-70b-versatile'],
                  defaultModel: 'llama-3.3-70b-versatile',
              }
    }) as any
    byokRepository.upsertCredential = (async (data: any) => {
        calls.upserts.push(data)
        return stubs.upsert ? stubs.upsert(data) : summaryRow({ provider: data.provider })
    }) as any
    byokRepository.findCredentialSummary = (async () => stubs.summary ?? null) as any
    byokRepository.findCredentialWithKey = (async () => stubs.withKey ?? null) as any
    byokRepository.updateVerification = (async (data: any) => {
        calls.updates.push(data)
        return stubs.update ? stubs.update(data) : true
    }) as any
    byokRepository.deleteCredential = (async () => stubs.deleteCount ?? 1) as any
    byokRepository.findCredentialsByUser = (async () => stubs.list ?? []) as any
    try {
        await run(calls)
    } finally {
        Object.assign(byokUtils, { verifyKey: original.verifyKey })
        Object.assign(byokRepository, {
            upsertCredential: original.upsertCredential,
            findCredentialSummary: original.findCredentialSummary,
            findCredentialWithKey: original.findCredentialWithKey,
            updateVerification: original.updateVerification,
            deleteCredential: original.deleteCredential,
            findCredentialsByUser: original.findCredentialsByUser,
        })
    }
}

describe('byok service', () => {
    describe('saveCredential', () => {
        it('checks the key, then stores it encrypted with only a hint in clear text', async () => {
            await withStubs({}, async ({ upserts, verifies }) => {
                const result = await byokService.saveCredential({
                    userId: 'u1',
                    provider: 'groq',
                    apiKey: '  gsk_live_secret_1234  ',
                })

                expect(verifies).toHaveLength(1)
                expect(verifies[0]).toEqual({ provider: 'groq', apiKey: 'gsk_live_secret_1234' })
                expect(upserts).toHaveLength(1)
                const stored = upserts[0]
                expect(stored.encryptedKey).not.toContain('gsk_live_secret_1234')
                expect(
                    decryptText({ encryptedText: stored.encryptedKey, keyHex: env.SECRETS_ENC_KEY })
                ).toBe('gsk_live_secret_1234')
                expect(stored.keyHint).toBe('1234')
                expect(JSON.stringify(result)).not.toContain('gsk_live_secret_1234')
                expect('encryptedKey' in result).toBe(false)
            })
        })

        it('does not store a key that fails the check', async () => {
            await withStubs(
                { verify: async () => ({ ok: false, reason: 'bad_key', message: 'invalid' }) },
                async ({ upserts }) => {
                    const error = await byokService
                        .saveCredential({ userId: 'u1', provider: 'groq', apiKey: 'gsk_bad' })
                        .catch((e) => e)
                    expect(error).toBeInstanceOf(AppError)
                    expect(error.statusCode).toBe(400)
                    expect(error.message).toContain('Groq rejected this key')
                    expect(upserts).toHaveLength(0)
                }
            )
        })

        it('refuses a claude plan token before any network call', async () => {
            await withStubs({}, async ({ upserts, verifies }) => {
                const error = await byokService
                    .saveCredential({
                        userId: 'u1',
                        provider: 'anthropic',
                        apiKey: 'sk-ant-oat01-plan',
                    })
                    .catch((e) => e)
                expect(error).toBeInstanceOf(AppError)
                expect(error.message).toContain('Claude plan token')
                expect(verifies).toHaveLength(0)
                expect(upserts).toHaveLength(0)
            })
        })
    })

    describe('refreshCredential', () => {
        it('asks the user to add the key again when the saved key cannot be read', async () => {
            await withStubs(
                {
                    withKey: {
                        provider: 'groq',
                        encryptedKey: 'aabbccddeeff00112233aabb:0011:deadbeef',
                    },
                },
                async ({ verifies }) => {
                    const error = await byokService
                        .refreshCredential({ userId: 'u1', provider: 'groq' })
                        .catch((e) => e)
                    expect(error).toBeInstanceOf(AppError)
                    expect(error.statusCode).toBe(400)
                    expect(error.message).toBe('your saved Groq key cannot be read. add it again')
                    expect(verifies).toHaveLength(0)
                }
            )
        })

        it('reports a key that is not saved', async () => {
            await withStubs({ withKey: null }, async () => {
                await expect(
                    byokService.refreshCredential({ userId: 'u1', provider: 'groq' })
                ).rejects.toThrow('no Groq key saved')
            })
        })
    })

    describe('assertOwnKeyUsable returns the key default model', () => {
        it('so a run without a model uses the key default', async () => {
            await withStubs({ summary: summaryRow({ defaultModel: 'qwen-qwq-32b' }) }, async () => {
                const credential = await byokService.assertOwnKeyUsable({
                    userId: 'u1',
                    provider: 'groq',
                })
                expect(credential.defaultModel).toBe('qwen-qwq-32b')
            })
        })
    })

    describe('assertOwnKeyUsable', () => {
        it('needs a saved key for the provider', async () => {
            await withStubs({ summary: null }, async () => {
                await expect(
                    byokService.assertOwnKeyUsable({ userId: 'u1', provider: 'groq' })
                ).rejects.toThrow('add your Groq key in settings first')
            })
        })

        it('needs a model the key serves', async () => {
            await withStubs({ summary: summaryRow() }, async () => {
                await expect(
                    byokService.assertOwnKeyUsable({
                        userId: 'u1',
                        provider: 'groq',
                        model: 'gpt-5',
                    })
                ).rejects.toThrow('gpt-5 is not available with your Groq key')
                const ok = await byokService.assertOwnKeyUsable({
                    userId: 'u1',
                    provider: 'groq',
                    model: 'llama-3.3-70b-versatile',
                })
                expect(ok.provider).toBe('groq')
            })
        })

        it('needs a provider', async () => {
            await expect(byokService.assertOwnKeyUsable({ userId: 'u1' })).rejects.toThrow(
                'choose a provider for your own key'
            )
        })
    })

    describe('deleteCredential', () => {
        it('reports a missing key', async () => {
            await withStubs({ deleteCount: 0 }, async () => {
                await expect(
                    byokService.deleteCredential({ userId: 'u1', provider: 'groq' })
                ).rejects.toThrow('no Groq key saved')
            })
        })
    })

    describe('buildKeyHint', () => {
        it('shows the last 4 characters of the key part only', () => {
            expect(buildKeyHint('openai', 'sk-proj-abcdef9876')).toBe('9876')
            expect(
                buildKeyHint('watsonx', 'ibmapikeyvalueWXYZ:6f1c2a9e-1111-4222-8333-944455556666')
            ).toBe('WXYZ')
            expect(buildKeyHint('openai', 'abc')).toBe('')
        })

        it('shows no hint for a key shorter than 12 characters', () => {
            expect(buildKeyHint('openai', 'sk-12345678')).toBe('')
            expect(buildKeyHint('openai', 'sk-123456789')).toBe('6789')
            expect(buildKeyHint('watsonx', 'shortkey:6f1c2a9e-1111-4222-8333-944455556666')).toBe(
                ''
            )
        })
    })
})

describe('byok service: the key never leaves in a message', () => {
    const KEY = 'gsk_live_SECRET_value_9876'

    it('takes the key out of a provider message that repeats it', async () => {
        await withStubs(
            {
                verify: async ({ apiKey }) => ({
                    ok: false,
                    reason: 'bad_key',
                    message: `Invalid API Key: ${apiKey}`,
                }),
            },
            async ({ upserts }) => {
                const error = await byokService
                    .saveCredential({ userId: 'u1', provider: 'groq', apiKey: KEY })
                    .catch((e) => e)
                expect(error).toBeInstanceOf(AppError)
                expect(error.statusCode).toBe(400)
                expect(error.message).not.toContain(KEY)
                expect(error.message).toContain('[key]')
                expect(upserts).toHaveLength(0)
            }
        )
    })

    it('takes out the url-encoded key of a request url in a network error', async () => {
        const key = 'AIza+secret/key=value123'
        await withStubs(
            {
                verify: async () => ({
                    ok: false,
                    reason: 'network',
                    message: `fetch failed: https://example.test/models?key=${encodeURIComponent(key)}`,
                }),
            },
            async () => {
                const error = await byokService
                    .saveCredential({ userId: 'u1', provider: 'google', apiKey: key })
                    .catch((e) => e)
                expect(error.message).not.toContain(encodeURIComponent(key))
                expect(error.message).not.toContain(key)
                expect(error.message).toContain('December could not reach Google AI Studio')
            }
        )
    })

    it('gives a plain 502 for an unknown failure, without its text', async () => {
        await withStubs(
            {
                verify: async ({ apiKey }) => {
                    throw new Error(`socket hang up while sending Bearer ${apiKey}`)
                },
            },
            async () => {
                const error = await byokService
                    .saveCredential({ userId: 'u1', provider: 'groq', apiKey: KEY })
                    .catch((e) => e)
                expect(error).toBeInstanceOf(AppError)
                expect(error.statusCode).toBe(502)
                expect(error.message).toBe(
                    'December could not reach Groq to check the key. Try again.'
                )
            }
        )
    })

    it('a refresh takes the key out of the message too', async () => {
        const { encryptText } = await import('@december/shared/crypto')
        await withStubs(
            {
                withKey: {
                    ...summaryRow(),
                    encryptedKey: encryptText({ text: KEY, keyHex: env.SECRETS_ENC_KEY }),
                },
                verify: async ({ apiKey }) => ({
                    ok: false,
                    reason: 'forbidden',
                    message: `key ${apiKey} has no access`,
                }),
            },
            async ({ updates }) => {
                const error = await byokService
                    .refreshCredential({ userId: 'u1', provider: 'groq' })
                    .catch((e) => e)
                expect(error.message).not.toContain(KEY)
                expect(error.message).toContain('Groq accepted the key but refused access')
                expect(updates).toHaveLength(0)
            }
        )
    })
})

describe('byok service: the models of a key', () => {
    it('keeps clean model ids and a default that is in the list', async () => {
        await withStubs(
            {
                verify: async () => ({
                    ok: true,
                    models: ['b', 'a', 'b', 7, '', ' c ', 'x'.repeat(500)],
                    defaultModel: 'not-in-list',
                }),
            },
            async ({ upserts }) => {
                await byokService.saveCredential({
                    userId: 'u1',
                    provider: 'groq',
                    apiKey: 'gsk_live_secret_1234',
                })
                expect(upserts[0].models).toEqual(['b', 'a', 'c'])
                expect(upserts[0].defaultModel).toBe('b')
            }
        )
    })

    it('refuses a key whose list has no usable model', async () => {
        await withStubs(
            { verify: async () => ({ ok: true, models: [42, ''], defaultModel: '' }) },
            async ({ upserts }) => {
                const error = await byokService
                    .saveCredential({ userId: 'u1', provider: 'groq', apiKey: 'gsk_live_1234567' })
                    .catch((e) => e)
                expect(error.statusCode).toBe(400)
                expect(error.message).toContain('could not list the models')
                expect(upserts).toHaveLength(0)
            }
        )
    })
})

describe('byok service: check again', () => {
    const withSavedKey = async () => {
        const { encryptText } = await import('@december/shared/crypto')
        const encryptedKey = encryptText({
            text: 'gsk_saved_key_5555',
            keyHex: env.SECRETS_ENC_KEY,
        })
        return { ...summaryRow(), encryptedKey }
    }

    it('checks the saved key and saves the new models for that key only', async () => {
        const stored = await withSavedKey()
        await withStubs(
            {
                withKey: stored,
                verify: async () => ({ ok: true, models: ['m1', 'm2'], defaultModel: 'm2' }),
            },
            async ({ verifies, updates }) => {
                const result = await byokService.refreshCredential({
                    userId: 'u1',
                    provider: 'groq',
                })
                expect(verifies[0]).toEqual({ provider: 'groq', apiKey: 'gsk_saved_key_5555' })
                expect(updates[0]).toMatchObject({
                    userId: 'u1',
                    provider: 'groq',
                    encryptedKey: stored.encryptedKey,
                    models: ['m1', 'm2'],
                    defaultModel: 'm2',
                })
                expect(result.models).toEqual(['m1', 'm2'])
                expect(result.defaultModel).toBe('m2')
                expect('encryptedKey' in result).toBe(false)
                expect(JSON.stringify(result)).not.toContain('gsk_saved_key_5555')
            }
        )
    })

    it('a key replaced during the check: returns what is saved now', async () => {
        const stored = await withSavedKey()
        await withStubs(
            {
                withKey: stored,
                update: async () => false,
                summary: summaryRow({ keyHint: 'newk', models: ['fresh'], defaultModel: 'fresh' }),
            },
            async () => {
                const result = await byokService.refreshCredential({
                    userId: 'u1',
                    provider: 'groq',
                })
                expect(result.keyHint).toBe('newk')
                expect(result.models).toEqual(['fresh'])
            }
        )
    })

    it('a key removed during the check: 404, not a server error', async () => {
        const stored = await withSavedKey()
        await withStubs({ withKey: stored, update: async () => false, summary: null }, async () => {
            const error = await byokService
                .refreshCredential({ userId: 'u1', provider: 'groq' })
                .catch((e) => e)
            expect(error).toBeInstanceOf(AppError)
            expect(error.statusCode).toBe(404)
        })
    })
})

describe('byok service: list and delete', () => {
    it('lists every provider and the saved keys without the key', async () => {
        await withStubs({ list: [summaryRow({ encryptedKey: 'should-not-show' })] }, async () => {
            const result = await byokService.listCredentials({ userId: 'u1' })
            expect(result.providers.length).toBe(42)
            expect(result.credentials).toHaveLength(1)
            expect(JSON.stringify(result.credentials)).not.toContain('should-not-show')
        })
    })

    it('deletes a saved key', async () => {
        await withStubs({ deleteCount: 1 }, async () => {
            await expect(
                byokService.deleteCredential({ userId: 'u1', provider: 'groq' })
            ).resolves.toBeUndefined()
        })
    })
})

describe('byok utils', () => {
    it('redactKey takes out the key, its encoded form and each watsonx part, in any case', () => {
        expect(redactKey({ text: 'bad key sk-ABC123xyz!', apiKey: 'sk-ABC123xyz' })).toBe(
            'bad key [key]!'
        )
        expect(redactKey({ text: 'SK-ABC123XYZ', apiKey: 'sk-ABC123xyz' })).toBe('[key]')
        expect(redactKey({ text: 'url?key=a%2Fb%2Bcdef', apiKey: 'a/b+cdef' })).toBe(
            'url?key=[key]'
        )
        const watsonx = 'ibmkeyWXYZ:6f1c2a9e-1111-4222-8333-944455556666'
        expect(
            redactKey({
                text: 'apikey ibmkeyWXYZ project 6f1c2a9e-1111-4222-8333-944455556666',
                apiKey: watsonx,
            })
        ).toBe('apikey [key] project [key]')
        // short parts are left alone, so common words are not cut up
        expect(redactKey({ text: 'a b c', apiKey: 'a:b' })).toBe('a b c')
        expect(redactKey({ text: 'nothing here', apiKey: 'sk-secret-123' })).toBe('nothing here')
    })

    it('cleanModelIds keeps strings once, trimmed, short enough, up to the cap', () => {
        expect(cleanModelIds(null)).toEqual([])
        expect(cleanModelIds('a')).toEqual([])
        expect(cleanModelIds(['a', 'a', ' b ', 1, null, ''])).toEqual(['a', 'b'])
        const many = Array.from({ length: MAX_MODELS + 50 }, (_, i) => `m${i}`)
        expect(cleanModelIds(many)).toHaveLength(MAX_MODELS)
    })

    it('toCredentialSummary never has the key and survives a bad models value', () => {
        const summary = toCredentialSummary({
            ...summaryRow({ models: 'oops' }),
            encryptedKey: 'secret',
        } as any)
        expect(summary.models).toEqual([])
        expect(Object.keys(summary).sort()).toEqual(
            ['defaultModel', 'keyHint', 'lastUsedAt', 'models', 'provider', 'verifiedAt'].sort()
        )
    })

    it('providerName uses the display name, or the id for an unknown one', () => {
        expect(providerName('openai')).toBe('OpenAI')
        expect(providerName('nope')).toBe('nope')
    })

    it('verifyFailureMessage has one message for each reason and cuts a long detail', () => {
        const base = { providerName: 'Groq' }
        expect(verifyFailureMessage({ ...base, reason: 'bad_key' })).toContain('rejected this key')
        expect(verifyFailureMessage({ ...base, reason: 'forbidden' })).toContain('refused access')
        expect(verifyFailureMessage({ ...base, reason: 'no_credits' })).toContain('no credits')
        expect(verifyFailureMessage({ ...base, reason: 'no_endpoint' })).toContain(
            'could not list the models'
        )
        expect(verifyFailureMessage({ ...base, reason: 'network' })).toContain('could not reach')
        const long = verifyFailureMessage({ ...base, reason: 'bad_key', message: 'x'.repeat(1000) })
        expect(long.match(/x+/)![0].length).toBe(300)
        expect(verifyFailureMessage({ ...base, reason: 'bad_key', message: '  ' })).not.toContain(
            '('
        )
    })
})

describe('byok schemas', () => {
    it('the provider must be a byok id, exactly', () => {
        expect(providerParamSchema.parse({ provider: 'groq' })).toEqual({ provider: 'groq' })
        for (const provider of ['Groq', 'GROQ', ' groq', 'groq ', 'claude', '', '../groq']) {
            expect(providerParamSchema.safeParse({ provider }).success).toBe(false)
        }
        expect(providerParamSchema.safeParse({}).success).toBe(false)
    })

    it('the key body is strict, trimmed, printable and at most 4096 characters', () => {
        expect(saveCredentialSchema.parse({ apiKey: '  sk-abc  ' })).toEqual({ apiKey: 'sk-abc' })
        expect(saveCredentialSchema.parse({ apiKey: 'k'.repeat(4096) }).apiKey).toHaveLength(4096)
        const bad: unknown[] = [
            {},
            { apiKey: '' },
            { apiKey: '   ' },
            { apiKey: 123 },
            { apiKey: null },
            { apiKey: 'k'.repeat(4097) },
            { apiKey: 'sk-abc def' },
            { apiKey: 'sk-abc\ndef' },
            { apiKey: 'sk-abc\u0000' },
            { apiKey: 'sk-ключ' },
            { apiKey: 'sk-abc', provider: 'openai' },
        ]
        for (const body of bad) {
            expect({ body, ok: saveCredentialSchema.safeParse(body).success }).toEqual({
                body,
                ok: false,
            })
        }
    })

    it('check again takes no body fields', () => {
        expect(refreshCredentialSchema.safeParse({}).success).toBe(true)
        expect(refreshCredentialSchema.safeParse({ apiKey: 'x' }).success).toBe(false)
    })
})
