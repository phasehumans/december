import { prisma } from '@december/database'
import { describe, it, expect, beforeAll, afterAll } from 'bun:test'
import request from 'supertest'

import app from '../../src/app'
import { secretsService } from '../../src/modules/secrets/secrets.service'
import { cleanupTestUser, createSignedInUser } from '../helpers'

describe('Secrets Module API Endpoints', () => {
    let testUserId: string
    let testEmail: string
    let accessToken: string

    beforeAll(async () => {
        testEmail = `secretstest-${Date.now()}@example.com`

        const user = await prisma.user.create({
            data: {
                name: 'Secrets Test User',
                email: testEmail,
                emailVerified: true,
            },
        })
        testUserId = user.id

        const { generateAccessToken } = await import('../../src/modules/auth/auth.utils')
        const session = await prisma.authSession.create({
            data: {
                userId: testUserId,
                refreshTokenHash: 'test-hash-' + Date.now(),
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            },
        })

        accessToken = generateAccessToken({ userId: testUserId, sessionId: session.id })
    })

    afterAll(async () => {
        if (testUserId) {
            await prisma.secret.deleteMany({ where: { userId: testUserId } }).catch(() => {
                // Intentionally swallowed: test cleanup fallback
            })
            await prisma.authSession.deleteMany({ where: { userId: testUserId } }).catch(() => {
                // Intentionally swallowed: test cleanup fallback
            })
            await prisma.user.delete({ where: { id: testUserId } }).catch(() => {
                // Intentionally swallowed: test cleanup fallback
            })
        }
    })

    it('GET /api/v1/secrets - returns empty array initially', async () => {
        const res = await request(app)
            .get('/api/v1/secrets')
            .set('Authorization', `Bearer ${accessToken}`)

        expect(res.status).toBe(200)
        expect(res.body.data.secrets).toEqual([])
    })

    it('POST /api/v1/secrets - creates a secret', async () => {
        const res = await request(app)
            .post('/api/v1/secrets')
            .set('Authorization', `Bearer ${accessToken}`)
            .send({
                name: 'OPENAI_API_KEY',
                value: 'sk-proj-test12345',
                note: 'Test OpenAI key',
            })

        expect(res.status).toBe(201)
        expect(res.body.data.secret.name).toBe('OPENAI_API_KEY')
        expect(res.body.data.secret.note).toBe('Test OpenAI key')

        // Verify DB value is encrypted and not plain text
        const dbSecret = await prisma.secret.findUnique({
            where: {
                userId_name_repoFullName: {
                    userId: testUserId,
                    name: 'OPENAI_API_KEY',
                    repoFullName: '',
                },
            },
        })
        expect(dbSecret).not.toBeNull()
        expect(dbSecret?.value).not.toBe('sk-proj-test12345')
        expect(dbSecret?.value).toContain(':')
    })

    it('GET /api/v1/secrets - fetches secrets list', async () => {
        const res = await request(app)
            .get('/api/v1/secrets')
            .set('Authorization', `Bearer ${accessToken}`)

        expect(res.status).toBe(200)
        expect(res.body.data.secrets.length).toBe(1)
        expect(res.body.data.secrets[0].name).toBe('OPENAI_API_KEY')
        expect(res.body.data.secrets[0].note).toBe('Test OpenAI key')
        expect(res.body.data.secrets[0].value).toBeUndefined()
    })

    it('GET /api/v1/secrets/:name/value - decrypts and retrieves secret value', async () => {
        const res = await request(app)
            .get('/api/v1/secrets/OPENAI_API_KEY/value')
            .set('Authorization', `Bearer ${accessToken}`)

        expect(res.status).toBe(200)
        expect(res.body.data.secret.name).toBe('OPENAI_API_KEY')
        expect(res.body.data.secret.value).toBe('sk-proj-test12345')
    })

    it('POST /api/v1/secrets/bulk - imports multiple secrets', async () => {
        const res = await request(app)
            .post('/api/v1/secrets/bulk')
            .set('Authorization', `Bearer ${accessToken}`)
            .send({
                secrets: [
                    { name: 'ANTHROPIC_API_KEY', value: 'sk-ant-test', note: 'Claude key' },
                    {
                        name: 'DATABASE_URL',
                        value: 'postgres://localhost:5432/db',
                        note: 'DB connection',
                    },
                ],
            })

        expect(res.status).toBe(201)

        const secretsRes = await request(app)
            .get('/api/v1/secrets')
            .set('Authorization', `Bearer ${accessToken}`)

        expect(secretsRes.status).toBe(200)
        expect(secretsRes.body.data.secrets.length).toBe(3)
    })

    it('DELETE /api/v1/secrets/:name - deletes a secret', async () => {
        const res = await request(app)
            .delete('/api/v1/secrets/ANTHROPIC_API_KEY')
            .set('Authorization', `Bearer ${accessToken}`)

        expect(res.status).toBe(200)

        const secretsRes = await request(app)
            .get('/api/v1/secrets')
            .set('Authorization', `Bearer ${accessToken}`)

        expect(secretsRes.status).toBe(200)
        expect(secretsRes.body.data.secrets.length).toBe(2)
        const names = secretsRes.body.data.secrets.map((s: { name: string }) => s.name)
        expect(names).not.toContain('ANTHROPIC_API_KEY')
    })
})

// #637 section 5: a secret for all repositories, or for one repository
describe('Secrets for one repository', () => {
    const stamp = Date.now()
    const ownerEmail = `secrets-repo-owner-${stamp}@example.com`
    const otherEmail = `secrets-repo-other-${stamp}@example.com`
    let owner: { userId: string; token: string }
    let other: { userId: string; token: string }

    const api = (method: 'get' | 'post' | 'delete', path: string, token = owner.token) =>
        request(app)[method](`/api/v1/secrets${path}`).set('Authorization', `Bearer ${token}`)

    const newSession = (userId: string, repo: { owner: string; name: string } | null) =>
        prisma.session.create({
            data: {
                userId,
                title: 'secrets test session',
                ...(repo
                    ? {
                          githubRepoOwner: repo.owner,
                          githubRepoName: repo.name,
                          repoUrl: `https://github.com/${repo.owner}/${repo.name}`,
                      }
                    : {}),
            },
        })

    beforeAll(async () => {
        owner = await createSignedInUser({ email: ownerEmail })
        other = await createSignedInUser({ email: otherEmail })
    })

    afterAll(async () => {
        for (const user of [owner, other]) {
            if (!user) continue
            await prisma.session.deleteMany({ where: { userId: user.userId } })
            await prisma.secret.deleteMany({ where: { userId: user.userId } })
            await cleanupTestUser({ id: user.userId })
        }
    })

    it('keeps one name once for all repositories and once for a repository', async () => {
        const forAll = await api('post', '').send({ name: 'API_URL', value: 'https://all.test' })
        expect(forAll.status).toBe(201)
        expect(forAll.body.data.secret.repoFullName).toBeNull()

        const forRepo = await api('post', '').send({
            name: 'API_URL',
            value: 'https://web.test',
            repoFullName: 'acme/web',
        })
        expect(forRepo.status).toBe(201)
        expect(forRepo.body.data.secret.repoFullName).toBe('acme/web')

        const list = await api('get', '')
        expect(list.status).toBe(200)
        const rows = list.body.data.secrets
            .map((row: { name: string; repoFullName: string | null }) => [
                row.name,
                row.repoFullName,
            ])
            .sort((a: [string, string | null], b: [string, string | null]) =>
                String(a[1]).localeCompare(String(b[1]))
            )
        expect(rows).toEqual([
            ['API_URL', 'acme/web'],
            ['API_URL', null],
        ])
    })

    it('never puts a value in the list answer', async () => {
        const list = await api('get', '')
        const text = JSON.stringify(list.body)
        expect(text).not.toContain('https://all.test')
        expect(text).not.toContain('https://web.test')
        for (const row of list.body.data.secrets) {
            expect(row.value).toBeUndefined()
        }
    })

    it('saves the same name and repository again as an update, in any letter case', async () => {
        const again = await api('post', '').send({
            name: 'API_URL',
            value: 'https://web-2.test',
            repoFullName: 'Acme/Web',
        })
        expect(again.status).toBe(201)

        const list = await api('get', '')
        expect(list.body.data.secrets.length).toBe(2)

        const value = await api('get', '/API_URL/value?repo=ACME/web')
        expect(value.status).toBe(200)
        expect(value.body.data.secret.value).toBe('https://web-2.test')
        expect(value.body.data.secret.repoFullName).toBe('acme/web')
    })

    it('reads the "all repositories" value when the call names no repository', async () => {
        const value = await api('get', '/API_URL/value')
        expect(value.status).toBe(200)
        expect(value.body.data.secret.value).toBe('https://all.test')
        expect(value.body.data.secret.repoFullName).toBeNull()
    })

    it('takes null and an empty text as "all repositories"', async () => {
        const withNull = await api('post', '').send({
            name: 'REGION',
            value: 'eu',
            repoFullName: null,
        })
        expect(withNull.status).toBe(201)
        expect(withNull.body.data.secret.repoFullName).toBeNull()

        const withEmpty = await api('post', '').send({
            name: 'REGION',
            value: 'us',
            repoFullName: '',
        })
        expect(withEmpty.status).toBe(201)

        const value = await api('get', '/REGION/value')
        expect(value.body.data.secret.value).toBe('us')
        await api('delete', '/REGION')
    })

    it('refuses a repository that is not owner/name', async () => {
        for (const repoFullName of ['web', 'acme/', '/web', 'acme/web repo', '../web', 'a/b;c']) {
            const res = await api('post', '').send({ name: 'BAD', value: 'x', repoFullName })
            expect(res.status).toBe(400)
        }
        const read = await api('get', '/API_URL/value?repo=web')
        expect(read.status).toBe(400)
        const removed = await api('delete', '/API_URL?repo=web')
        expect(removed.status).toBe(400)
    })

    it('gives a session the value of its repository, and the "all" value elsewhere', async () => {
        const web = await newSession(owner.userId, { owner: 'Acme', name: 'Web' })
        const docs = await newSession(owner.userId, { owner: 'acme', name: 'docs' })
        const none = await newSession(owner.userId, null)

        const forWeb = await secretsService.getAllDecryptedSecrets({
            userId: owner.userId,
            sessionId: web.id,
        })
        expect(forWeb).toEqual([{ key: 'API_URL', value: 'https://web-2.test' }])

        const forDocs = await secretsService.getAllDecryptedSecrets({
            userId: owner.userId,
            sessionId: docs.id,
        })
        expect(forDocs).toEqual([{ key: 'API_URL', value: 'https://all.test' }])

        const forNone = await secretsService.getAllDecryptedSecrets({
            userId: owner.userId,
            sessionId: none.id,
        })
        expect(forNone).toEqual([{ key: 'API_URL', value: 'https://all.test' }])

        const byName = await secretsService.getAllDecryptedSecrets({
            userId: owner.userId,
            repoFullName: 'ACME/WEB',
        })
        expect(byName).toEqual([{ key: 'API_URL', value: 'https://web-2.test' }])
    })

    it('gives a secret of one repository only to that repository', async () => {
        const res = await api('post', '').send({
            name: 'WEB_ONLY',
            value: 'web-only-value',
            repoFullName: 'acme/web',
        })
        expect(res.status).toBe(201)

        const forWeb = await secretsService.getAllDecryptedSecrets({
            userId: owner.userId,
            repoFullName: 'acme/web',
        })
        expect(forWeb.map((item) => item.key).sort()).toEqual(['API_URL', 'WEB_ONLY'])

        const forDocs = await secretsService.getAllDecryptedSecrets({
            userId: owner.userId,
            repoFullName: 'acme/docs',
        })
        expect(forDocs.map((item) => item.key)).toEqual(['API_URL'])

        const forNone = await secretsService.getAllDecryptedSecrets({ userId: owner.userId })
        expect(forNone.map((item) => item.key)).toEqual(['API_URL'])

        // the old read with no repository does not find a secret of one repository
        const read = await api('get', '/WEB_ONLY/value')
        expect(read.status).toBe(404)
    })

    it("never reads another user's secret", async () => {
        const read = await api('get', '/API_URL/value?repo=acme/web', other.token)
        expect(read.status).toBe(404)
        const readAll = await api('get', '/API_URL/value', other.token)
        expect(readAll.status).toBe(404)
        const removed = await api('delete', '/API_URL?repo=acme/web', other.token)
        expect(removed.status).toBe(404)
        const list = await api('get', '', other.token)
        expect(list.body.data.secrets).toEqual([])

        // the same repository name under another user gets nothing of the owner
        const forOther = await secretsService.getAllDecryptedSecrets({
            userId: other.userId,
            repoFullName: 'acme/web',
        })
        expect(forOther).toEqual([])

        // a session of the owner, asked for by another user, gives no repository to that user
        await api('post', '', other.token).send({ name: 'API_URL', value: 'https://other.test' })
        const ownerSession = await newSession(owner.userId, { owner: 'acme', name: 'web' })
        const crossed = await secretsService.getAllDecryptedSecrets({
            userId: other.userId,
            sessionId: ownerSession.id,
        })
        expect(crossed).toEqual([{ key: 'API_URL', value: 'https://other.test' }])
    })

    it('deletes the row of one repository and keeps the other', async () => {
        const removed = await api('delete', '/API_URL?repo=acme/web')
        expect(removed.status).toBe(200)

        const gone = await api('get', '/API_URL/value?repo=acme/web')
        expect(gone.status).toBe(404)
        const kept = await api('get', '/API_URL/value')
        expect(kept.status).toBe(200)
        expect(kept.body.data.secret.value).toBe('https://all.test')

        const again = await api('delete', '/API_URL?repo=acme/web')
        expect(again.status).toBe(404)
    })

    it('deletes the "all repositories" row with the old call and keeps the repository row', async () => {
        await api('post', '').send({
            name: 'API_URL',
            value: 'https://web-3.test',
            repoFullName: 'acme/web',
        })
        const removed = await api('delete', '/API_URL')
        expect(removed.status).toBe(200)

        const kept = await api('get', '/API_URL/value?repo=acme/web')
        expect(kept.status).toBe(200)
        expect(kept.body.data.secret.value).toBe('https://web-3.test')
        const gone = await api('get', '/API_URL/value')
        expect(gone.status).toBe(404)
    })

    it('imports many secrets for one repository, or each with its own', async () => {
        const res = await api('post', '/bulk').send({
            repoFullName: 'acme/api',
            secrets: [
                { name: 'BULK_ONE', value: 'one' },
                { name: 'BULK_TWO', value: 'two', repoFullName: 'acme/docs' },
                { name: 'BULK_THREE', value: 'three', repoFullName: null },
            ],
        })
        expect(res.status).toBe(201)

        const list = await api('get', '')
        const repoOf = (name: string) =>
            list.body.data.secrets.find((row: { name: string }) => row.name === name)?.repoFullName
        expect(repoOf('BULK_ONE')).toBe('acme/api')
        expect(repoOf('BULK_TWO')).toBe('acme/docs')
        expect(repoOf('BULK_THREE')).toBeNull()

        const old = await api('post', '/bulk').send({
            secrets: [{ name: 'BULK_OLD', value: 'old' }],
        })
        expect(old.status).toBe(201)
        const value = await api('get', '/BULK_OLD/value')
        expect(value.body.data.secret.value).toBe('old')
    })
})
