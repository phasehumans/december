import { decryptText } from '@december/shared/crypto'
import { describe, expect, it } from 'bun:test'

import { env } from '../../src/env'
import { byokRepository } from '../../src/modules/byok/byok.repository'
import { byokService } from '../../src/modules/byok/byok.service'
import { buildKeyHint, byokUtils } from '../../src/modules/byok/byok.utils'
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
        update?: (data: any) => Promise<any>
        deleteCount?: number
    },
    run: (calls: { upserts: any[]; verifies: any[] }) => Promise<void>
) => {
    const calls = { upserts: [] as any[], verifies: [] as any[] }
    const original = {
        verifyKey: byokUtils.verifyKey,
        upsertCredential: byokRepository.upsertCredential,
        findCredentialSummary: byokRepository.findCredentialSummary,
        findCredentialWithKey: byokRepository.findCredentialWithKey,
        updateVerification: byokRepository.updateVerification,
        deleteCredential: byokRepository.deleteCredential,
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
    byokRepository.updateVerification = (async (data: any) =>
        stubs.update ? stubs.update(data) : summaryRow(data)) as any
    byokRepository.deleteCredential = (async () => stubs.deleteCount ?? 1) as any
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
            expect(buildKeyHint('watsonx', 'ibmkeyWXYZ:6f1c2a9e-1111-4222-8333-944455556666')).toBe(
                'WXYZ'
            )
            expect(buildKeyHint('openai', 'abc')).toBe('')
        })
    })
})
