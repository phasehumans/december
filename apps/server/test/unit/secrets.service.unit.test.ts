import { SECRETS_PER_USER_MAX } from '@december/shared/secrets'
import { afterEach, beforeEach, describe, expect, it } from 'bun:test'

import { auditService } from '../../src/modules/audit/audit.service'
import { secretsRepository } from '../../src/modules/secrets/secrets.repository'
import { secretsService } from '../../src/modules/secrets/secrets.service'
import { AppError } from '../../src/shared/appError'

type AuditCall = Parameters<typeof auditService.recordForUser>[0]

// stand-ins for the repository and the audit log, put back after each test
const restores: Array<() => void> = []
const stub = <T extends object, K extends keyof T>(target: T, key: K, impl: unknown) => {
    const original = target[key]
    target[key] = impl as T[K]
    restores.push(() => {
        target[key] = original
    })
}

let audits: AuditCall[]

beforeEach(() => {
    audits = []
    stub(auditService, 'recordForUser', async (data: AuditCall) => {
        audits.push(data)
    })
})

afterEach(() => {
    while (restores.length) restores.pop()?.()
})

const at = new Date('2026-11-25T00:00:00.000Z')
const summary = (name: string, repoFullName = '', id = `id-${name}-${repoFullName}`) => ({
    id,
    name,
    note: null,
    repoFullName,
    createdAt: at,
    updatedAt: at,
})

describe('secrets service', () => {
    describe('encrypt and decrypt', () => {
        it('encrypts a value and opens it again', () => {
            const encrypted = secretsService.encrypt({ text: 'my-super-secret-api-key-12345' })
            expect(encrypted).not.toContain('my-super-secret')
            expect(encrypted.split(':')).toHaveLength(3)
            expect(secretsService.decrypt({ encryptedText: encrypted })).toBe(
                'my-super-secret-api-key-12345'
            )
        })

        it('uses a new iv each time, so the same value is stored two ways', () => {
            const a = secretsService.encrypt({ text: 'same' })
            const b = secretsService.encrypt({ text: 'same' })
            expect(a).not.toBe(b)
        })

        it('gives a 500 with no part of the row for a row that does not open', () => {
            const encrypted = secretsService.encrypt({ text: 'value' })
            const [iv, tag, body] = encrypted.split(':')
            const changed = `${iv}:${tag}:${body!.slice(0, -2)}${body!.endsWith('00') ? '11' : '00'}`
            const shortTag = `${iv}:${tag!.slice(0, 8)}:${body}`
            for (const encryptedText of [
                'invalid-format-without-colons',
                'part1:part2',
                changed,
                shortTag,
            ]) {
                let caught: unknown
                try {
                    secretsService.decrypt({ encryptedText })
                } catch (error) {
                    caught = error
                }
                expect(caught).toBeInstanceOf(AppError)
                expect((caught as AppError).statusCode).toBe(500)
                expect((caught as AppError).message).toBe(
                    'This secret could not be read. Save it again.'
                )
                expect((caught as AppError).message).not.toContain(encryptedText)
            }
        })
    })

    describe('createSecret', () => {
        it('stores the value encrypted, gives no value back, and logs a new secret', async () => {
            let saved: {
                name: string
                encryptedValue: string
                note: unknown
                repo: string
            } | null = null
            stub(secretsRepository, 'findSecretByName', async () => null)
            stub(secretsRepository, 'countSecretsByUser', async () => 0)
            stub(
                secretsRepository,
                'upsertSecret',
                async (
                    _userId: string,
                    name: string,
                    encryptedValue: string,
                    note: unknown,
                    repo: string
                ) => {
                    saved = { name, encryptedValue, note, repo }
                    return { ...summary(name, repo), note: (note as string) ?? null }
                }
            )

            const res = await secretsService.createSecret({
                userId: 'user-1',
                name: 'API_KEY',
                value: 'plain-secret-value',
                note: 'Production',
                repoFullName: 'Acme/Web',
            })

            expect(saved!.name).toBe('API_KEY')
            expect(saved!.repo).toBe('acme/web')
            expect(saved!.encryptedValue).not.toContain('plain-secret-value')
            expect(secretsService.decrypt({ encryptedText: saved!.encryptedValue })).toBe(
                'plain-secret-value'
            )
            expect(res).toEqual({ ...summary('API_KEY', 'acme/web'), note: 'Production' })
            expect(JSON.stringify(res)).not.toContain('plain-secret-value')
            expect(audits).toEqual([
                {
                    userId: 'user-1',
                    action: 'secret.created',
                    target: 'API_KEY',
                    metadata: { repo: 'acme/web' },
                },
            ])
        })

        it('logs a save of a name that is there as an update, and gives null for all repos', async () => {
            stub(secretsRepository, 'findSecretByName', async () => ({ id: 'old' }))
            let counted = false
            stub(secretsRepository, 'countSecretsByUser', async () => {
                counted = true
                return SECRETS_PER_USER_MAX
            })
            stub(secretsRepository, 'upsertSecret', async () => summary('API_KEY'))

            const res = await secretsService.createSecret({
                userId: 'user-1',
                name: 'API_KEY',
                value: 'v2',
            })
            // an update never counts against the limit, even at the limit
            expect(counted).toBe(false)
            expect(res.repoFullName).toBeNull()
            expect(audits[0]?.action).toBe('secret.updated')
            expect(audits[0]?.metadata).toEqual({ repo: null })
        })

        it('refuses a new secret past the limit and saves nothing', async () => {
            let upserted = false
            stub(secretsRepository, 'findSecretByName', async () => null)
            stub(secretsRepository, 'countSecretsByUser', async () => SECRETS_PER_USER_MAX)
            stub(secretsRepository, 'upsertSecret', async () => {
                upserted = true
            })

            await expect(
                secretsService.createSecret({ userId: 'user-1', name: 'NEW_ONE', value: 'v' })
            ).rejects.toThrow(
                new AppError(
                    `You can keep up to ${SECRETS_PER_USER_MAX} secrets. Delete one to add another.`,
                    400
                )
            )
            expect(upserted).toBe(false)
            expect(audits).toEqual([])
        })
    })

    describe('bulkCreateSecrets', () => {
        it('encrypts each value, takes the repository of the import, and counts new and updated', async () => {
            let items: Array<{ name: string; encryptedValue: string; repoFullName: string }> = []
            stub(secretsRepository, 'findSecretsByUser', async () => [summary('K2', 'acme/web')])
            stub(secretsRepository, 'bulkUpsertSecrets', async (_userId: string, list: any[]) => {
                items = list
                return list.map((item) => summary(item.name, item.repoFullName))
            })

            const res = await secretsService.bulkCreateSecrets({
                userId: 'user-1',
                repoFullName: 'ACME/WEB',
                secrets: [
                    { name: 'K1', value: 'v1' },
                    { name: 'K2', value: 'v2' },
                    { name: 'K3', value: 'v3', repoFullName: null },
                ],
            })

            expect(items.map((item) => [item.name, item.repoFullName])).toEqual([
                ['K1', 'acme/web'],
                ['K2', 'acme/web'],
                ['K3', ''],
            ])
            for (const item of items) expect(item.encryptedValue).not.toMatch(/^v\d$/)
            expect(res).toEqual({ created: 2, updated: 1, saved: 3 })
            expect(audits.map((call) => [call.action, call.target])).toEqual([
                ['secret.created', 'K1, K3'],
                ['secret.updated', 'K2'],
            ])
        })

        it('refuses a name two times for one repository', async () => {
            let saved = false
            stub(secretsRepository, 'findSecretsByUser', async () => [])
            stub(secretsRepository, 'bulkUpsertSecrets', async () => {
                saved = true
                return []
            })
            await expect(
                secretsService.bulkCreateSecrets({
                    userId: 'user-1',
                    repoFullName: 'acme/web',
                    secrets: [
                        { name: 'DUP', value: 'a' },
                        { name: 'DUP', value: 'b', repoFullName: 'Acme/Web' },
                    ],
                })
            ).rejects.toThrow(new AppError('DUP is in the list more than one time.', 400))
            expect(saved).toBe(false)
        })

        it('takes one name for two repositories', async () => {
            stub(secretsRepository, 'findSecretsByUser', async () => [])
            stub(secretsRepository, 'bulkUpsertSecrets', async (_u: string, list: any[]) => list)
            const res = await secretsService.bulkCreateSecrets({
                userId: 'user-1',
                secrets: [
                    { name: 'SAME', value: 'a' },
                    { name: 'SAME', value: 'b', repoFullName: 'acme/web' },
                ],
            })
            expect(res.created).toBe(2)
        })

        it('refuses an import that goes past the limit, and saves none of it', async () => {
            let saved = false
            const existing = Array.from({ length: SECRETS_PER_USER_MAX - 1 }, (_, i) =>
                summary(`OLD_${i}`)
            )
            stub(secretsRepository, 'findSecretsByUser', async () => existing)
            stub(secretsRepository, 'bulkUpsertSecrets', async () => {
                saved = true
                return []
            })
            await expect(
                secretsService.bulkCreateSecrets({
                    userId: 'user-1',
                    secrets: [
                        { name: 'NEW_1', value: 'a' },
                        { name: 'NEW_2', value: 'b' },
                    ],
                })
            ).rejects.toThrow(AppError)
            expect(saved).toBe(false)
        })

        it('lets an import of updates through at the limit', async () => {
            const existing = Array.from({ length: SECRETS_PER_USER_MAX }, (_, i) =>
                summary(`OLD_${i}`)
            )
            stub(secretsRepository, 'findSecretsByUser', async () => existing)
            stub(secretsRepository, 'bulkUpsertSecrets', async (_u: string, list: any[]) => list)
            const res = await secretsService.bulkCreateSecrets({
                userId: 'user-1',
                secrets: [{ name: 'OLD_0', value: 'new' }],
            })
            expect(res).toEqual({ created: 0, updated: 1, saved: 1 })
        })

        it('logs nothing when the transaction fails', async () => {
            stub(secretsRepository, 'findSecretsByUser', async () => [])
            stub(secretsRepository, 'bulkUpsertSecrets', async () => {
                throw new Error('db down')
            })
            await expect(
                secretsService.bulkCreateSecrets({
                    userId: 'user-1',
                    secrets: [{ name: 'A', value: 'a' }],
                })
            ).rejects.toThrow('db down')
            expect(audits).toEqual([])
        })
    })

    describe('getSecrets', () => {
        it('gives names, notes and repositories, with null for all repositories', async () => {
            stub(secretsRepository, 'findSecretsByUser', async () => [
                { ...summary('API_KEY'), note: 'test note' },
                summary('API_KEY', 'acme/web'),
            ])
            const res = await secretsService.getSecrets({ userId: 'user-1' })
            expect(res).toEqual([
                { ...summary('API_KEY'), note: 'test note', repoFullName: null },
                { ...summary('API_KEY', 'acme/web'), repoFullName: 'acme/web' },
            ])
        })
    })

    describe('getSecretValue', () => {
        it('gives a 404 for a name the user does not have, and logs nothing', async () => {
            stub(secretsRepository, 'findSecretByName', async () => null)
            await expect(
                secretsService.getSecretValue({ userId: 'user-1', name: 'UNKNOWN_KEY' })
            ).rejects.toThrow(new AppError('Secret not found', 404))
            expect(audits).toEqual([])
        })

        it('reads the row of the repository asked for, and logs the read', async () => {
            let asked: unknown[] = []
            stub(secretsRepository, 'findSecretByName', async (...args: unknown[]) => {
                asked = args
                return {
                    ...summary('MY_TOKEN', 'acme/web', 'secret-1'),
                    note: 'My token note',
                    value: secretsService.encrypt({ text: 'my-decrypted-secret-token' }),
                }
            })

            const res = await secretsService.getSecretValue({
                userId: 'user-1',
                name: 'MY_TOKEN',
                repoFullName: 'Acme/Web',
                ip: '10.0.0.1',
            })

            expect(asked).toEqual(['user-1', 'MY_TOKEN', 'acme/web'])
            expect(res).toEqual({
                id: 'secret-1',
                name: 'MY_TOKEN',
                value: 'my-decrypted-secret-token',
                note: 'My token note',
                repoFullName: 'acme/web',
                createdAt: at,
                updatedAt: at,
            })
            expect(audits).toEqual([
                {
                    userId: 'user-1',
                    action: 'secret.revealed',
                    target: 'MY_TOKEN',
                    ip: '10.0.0.1',
                    metadata: { repo: 'acme/web' },
                },
            ])
            // the log keeps the name, never the value
            expect(JSON.stringify(audits)).not.toContain('my-decrypted-secret-token')
        })

        it('gives a 500 for a row that does not open, and logs no read', async () => {
            stub(secretsRepository, 'findSecretByName', async () => ({
                ...summary('BROKEN'),
                value: 'aa:bb:cc',
            }))
            await expect(
                secretsService.getSecretValue({ userId: 'user-1', name: 'BROKEN' })
            ).rejects.toThrow(new AppError('This secret could not be read. Save it again.', 500))
            expect(audits).toEqual([])
        })
    })

    describe('deleteSecret', () => {
        it('gives a 404 when no row was deleted, and logs nothing', async () => {
            stub(secretsRepository, 'deleteSecret', async () => 0)
            await expect(
                secretsService.deleteSecret({ userId: 'user-1', name: 'UNKNOWN' })
            ).rejects.toThrow(new AppError('Secret not found', 404))
            expect(audits).toEqual([])
        })

        it('deletes the row of the repository asked for and logs it', async () => {
            let asked: unknown[] = []
            stub(secretsRepository, 'deleteSecret', async (...args: unknown[]) => {
                asked = args
                return 1
            })
            await secretsService.deleteSecret({
                userId: 'user-1',
                name: 'TO_DELETE',
                repoFullName: 'ACME/web',
            })
            expect(asked).toEqual(['user-1', 'TO_DELETE', 'acme/web'])
            expect(audits).toEqual([
                {
                    userId: 'user-1',
                    action: 'secret.deleted',
                    target: 'TO_DELETE',
                    metadata: { repo: 'acme/web' },
                },
            ])
        })

        it('deletes the "all repositories" row when no repository is given', async () => {
            let asked: unknown[] = []
            stub(secretsRepository, 'deleteSecret', async (...args: unknown[]) => {
                asked = args
                return 1
            })
            await secretsService.deleteSecret({ userId: 'user-1', name: 'X' })
            expect(asked).toEqual(['user-1', 'X', ''])
        })
    })

    describe('getAllDecryptedSecrets', () => {
        const row = (name: string, text: string | null, repoFullName = '') => ({
            name,
            repoFullName,
            value: text === null ? 'invalid:corrupted:text' : secretsService.encrypt({ text }),
        })

        it('gives the open values and leaves out a row that does not open', async () => {
            stub(secretsRepository, 'findSecretsWithValuesByUser', async () => [
                row('SECRET_ONE', 'secret-val-1'),
                row('SECRET_TWO', 'secret-val-2'),
                row('CORRUPTED_SECRET', null),
            ])
            const res = await secretsService.getAllDecryptedSecrets({ userId: 'user-1' })
            expect(res).toEqual([
                { key: 'SECRET_ONE', value: 'secret-val-1' },
                { key: 'SECRET_TWO', value: 'secret-val-2' },
            ])
        })

        it('leaves out an old row with a system name or a name a shell cannot export', async () => {
            stub(secretsRepository, 'findSecretsWithValuesByUser', async () => [
                row('PATH', '/evil'),
                row('LD_PRELOAD', '/evil.so'),
                row('DECEMBER_TOKEN', 'x'),
                row('E2B_API_KEY', 'x'),
                row('BAD NAME', 'x'),
                row('1BAD', 'x'),
                row('lower_ok', 'yes'),
                row('GOOD', 'yes'),
            ])
            const res = await secretsService.getAllDecryptedSecrets({ userId: 'user-1' })
            expect(res.map((item) => item.key)).toEqual(['lower_ok', 'GOOD'])
        })

        it('gives the value of the repository when a name is in both (#637)', async () => {
            let askedRepo: string | undefined
            stub(
                secretsRepository,
                'findSecretsWithValuesByUser',
                async (_userId: string, repoFullName?: string) => {
                    askedRepo = repoFullName
                    return [
                        row('API_URL', 'https://all.test'),
                        row('API_URL', 'https://web.test', 'acme/web'),
                        row('REGION', 'eu'),
                    ]
                }
            )
            const res = await secretsService.getAllDecryptedSecrets({
                userId: 'user-1',
                repoFullName: 'Acme/Web',
            })
            expect(askedRepo).toBe('acme/web')
            expect(res).toEqual([
                { key: 'API_URL', value: 'https://web.test' },
                { key: 'REGION', value: 'eu' },
            ])
        })

        it('reads the repository of the session when no repository is given', async () => {
            let askedSession: unknown[] = []
            let askedRepo: string | undefined
            stub(secretsRepository, 'findSessionRepo', async (...args: unknown[]) => {
                askedSession = args
                return {
                    githubRepoOwner: 'Acme',
                    githubRepoName: 'Web',
                    repoUrl: null,
                    githubRepoUrl: null,
                }
            })
            stub(
                secretsRepository,
                'findSecretsWithValuesByUser',
                async (_userId: string, repoFullName?: string) => {
                    askedRepo = repoFullName
                    return []
                }
            )
            await secretsService.getAllDecryptedSecrets({ userId: 'user-1', sessionId: 's-1' })
            expect(askedSession).toEqual(['user-1', 's-1'])
            expect(askedRepo).toBe('acme/web')
        })

        it('does not fall back to the "all" value when the repository value is broken', async () => {
            stub(secretsRepository, 'findSecretsWithValuesByUser', async () => [
                row('API_URL', 'https://all.test'),
                row('API_URL', null, 'acme/web'),
            ])
            const res = await secretsService.getAllDecryptedSecrets({
                userId: 'user-1',
                repoFullName: 'acme/web',
            })
            expect(res).toEqual([])
        })
    })
})
