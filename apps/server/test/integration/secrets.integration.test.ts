import { prisma } from '@december/database'
import { SECRET_VALUE_MAX, SECRETS_BULK_MAX, SECRETS_PER_USER_MAX } from '@december/shared/secrets'
import { describe, it, expect, beforeAll, afterAll } from 'bun:test'
import request from 'supertest'

import app from '../../src/app'
import { secretsRepository } from '../../src/modules/secrets/secrets.repository'
import { secretsService } from '../../src/modules/secrets/secrets.service'
import { cleanupTestUser, createSignedInUser } from '../helpers'

type TestUser = { userId: string; token: string }
type Method = 'get' | 'post' | 'delete'

const stamp = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`
const created: TestUser[] = []

const newUser = async (label: string) => {
    const user = await createSignedInUser({ email: `secrets-${label}-${stamp}@example.com` })
    created.push(user)
    return user
}

const call = (user: TestUser | null, method: Method, path: string) => {
    const req = request(app)[method](`/api/v1/secrets${path}`)
    return user ? req.set('Authorization', `Bearer ${user.token}`) : req
}

const auditActions = (userId: string) =>
    prisma.auditEvent.findMany({
        where: { actorId: userId },
        orderBy: { createdAt: 'asc' },
        select: { action: true, target: true, metadata: true },
    })

afterAll(async () => {
    for (const user of created) {
        await prisma.session.deleteMany({ where: { userId: user.userId } })
        await prisma.secret.deleteMany({ where: { userId: user.userId } })
        await cleanupTestUser({ id: user.userId })
    }
})

describe('secrets api: sign-in', () => {
    it('refuses every route without a token', async () => {
        const routes: Array<[Method, string]> = [
            ['get', ''],
            ['get', '/API_KEY/value'],
            ['post', ''],
            ['post', '/bulk'],
            ['delete', '/API_KEY'],
        ]
        for (const [method, path] of routes) {
            const res = await call(null, method, path).send({ name: 'A', value: 'b' })
            expect(res.status).toBe(401)
        }
    })

    it('refuses a token that is not good', async () => {
        const res = await request(app)
            .get('/api/v1/secrets')
            .set('Authorization', 'Bearer not-a-token')
        expect(res.status).toBe(401)
    })
})

describe('secrets api: the basic routes', () => {
    let user: TestUser

    beforeAll(async () => {
        user = await newUser('basic')
    })

    it('gives an empty list at first', async () => {
        const res = await call(user, 'get', '')
        expect(res.status).toBe(200)
        expect(res.body.data.secrets).toEqual([])
    })

    it('creates a secret, stores it encrypted, and gives no value back', async () => {
        const res = await call(user, 'post', '').send({
            name: 'OPENAI_API_KEY',
            value: 'sk-proj-test12345',
            note: 'Test OpenAI key',
        })
        expect(res.status).toBe(201)
        expect(res.body.data.secret).toMatchObject({
            name: 'OPENAI_API_KEY',
            note: 'Test OpenAI key',
            repoFullName: null,
        })
        expect(JSON.stringify(res.body)).not.toContain('sk-proj-test12345')

        const row = await prisma.secret.findUnique({
            where: {
                userId_name_repoFullName: {
                    userId: user.userId,
                    name: 'OPENAI_API_KEY',
                    repoFullName: '',
                },
            },
        })
        expect(row?.value).not.toContain('sk-proj-test12345')
        expect(row?.value.split(':')).toHaveLength(3)
    })

    it('lists names and notes, never a value or the stored cipher text', async () => {
        const res = await call(user, 'get', '')
        expect(res.status).toBe(200)
        expect(res.body.data.secrets).toHaveLength(1)
        const [secret] = res.body.data.secrets
        expect(Object.keys(secret).sort()).toEqual(
            ['createdAt', 'id', 'name', 'note', 'repoFullName', 'updatedAt'].sort()
        )
        const row = await prisma.secret.findFirst({ where: { userId: user.userId } })
        const text = JSON.stringify(res.body)
        expect(text).not.toContain('sk-proj-test12345')
        expect(text).not.toContain(row!.value)
    })

    it('reads the value, with no-store, and logs the read', async () => {
        const res = await call(user, 'get', '/OPENAI_API_KEY/value')
        expect(res.status).toBe(200)
        expect(res.headers['cache-control']).toBe('no-store')
        expect(res.body.data.secret).toMatchObject({
            name: 'OPENAI_API_KEY',
            value: 'sk-proj-test12345',
            repoFullName: null,
        })

        const events = await auditActions(user.userId)
        expect(events.map((event) => event.action)).toEqual(['secret.created', 'secret.revealed'])
        // the audit log keeps the name, never the value
        expect(JSON.stringify(events)).not.toContain('sk-proj-test12345')
    })

    it('gives a 404 for a name the user does not have', async () => {
        const res = await call(user, 'get', '/NOT_THERE/value')
        expect(res.status).toBe(404)
    })

    it('saves a name again as an update: one row, the new value, the note kept', async () => {
        const res = await call(user, 'post', '').send({
            name: 'OPENAI_API_KEY',
            value: 'sk-proj-new',
        })
        expect(res.status).toBe(201)
        expect(res.body.data.secret.note).toBe('Test OpenAI key')
        const list = await call(user, 'get', '')
        expect(list.body.data.secrets).toHaveLength(1)
        const value = await call(user, 'get', '/OPENAI_API_KEY/value')
        expect(value.body.data.secret.value).toBe('sk-proj-new')
        const events = await auditActions(user.userId)
        expect(events.at(-1)?.action).toBe('secret.revealed')
        expect(events.map((event) => event.action)).toContain('secret.updated')
    })

    it('clears the note with an empty note', async () => {
        const res = await call(user, 'post', '').send({
            name: 'OPENAI_API_KEY',
            value: 'sk-proj-new',
            note: '',
        })
        expect(res.status).toBe(201)
        expect(res.body.data.secret.note).toBeNull()
    })

    it('imports many secrets in one call and says how many are new', async () => {
        const res = await call(user, 'post', '/bulk').send({
            secrets: [
                { name: 'ANTHROPIC_API_KEY', value: 'sk-ant-test', note: 'Claude key' },
                { name: 'DATABASE_URL', value: 'postgres://localhost:5432/db' },
                { name: 'OPENAI_API_KEY', value: 'sk-proj-bulk' },
            ],
        })
        expect(res.status).toBe(201)
        expect(res.body.data).toEqual({ created: 2, updated: 1, saved: 3 })
        expect(JSON.stringify(res.body)).not.toContain('sk-ant-test')

        const list = await call(user, 'get', '')
        expect(list.body.data.secrets).toHaveLength(3)
    })

    it('deletes a secret, then gives a 404 for a second delete', async () => {
        const res = await call(user, 'delete', '/ANTHROPIC_API_KEY')
        expect(res.status).toBe(200)

        const list = await call(user, 'get', '')
        const names = list.body.data.secrets.map((s: { name: string }) => s.name)
        expect(names).not.toContain('ANTHROPIC_API_KEY')
        expect(names).toHaveLength(2)

        const again = await call(user, 'delete', '/ANTHROPIC_API_KEY')
        expect(again.status).toBe(404)
        const events = await auditActions(user.userId)
        expect(events.filter((event) => event.action === 'secret.deleted')).toHaveLength(1)
    })

    it('can still read and delete an old row whose name breaks the new rules', async () => {
        await prisma.secret.create({
            data: {
                userId: user.userId,
                name: 'old name',
                value: secretsService.encrypt({ text: 'old' }),
            },
        })
        const read = await call(user, 'get', `/${encodeURIComponent('old name')}/value`)
        expect(read.status).toBe(200)
        expect(read.body.data.secret.value).toBe('old')
        const removed = await call(user, 'delete', `/${encodeURIComponent('old name')}`)
        expect(removed.status).toBe(200)
    })

    it('gives a 500 with a plain message for a row that does not open', async () => {
        await prisma.secret.create({
            data: { userId: user.userId, name: 'BROKEN_ROW', value: 'aa:bb:cc' },
        })
        const res = await call(user, 'get', '/BROKEN_ROW/value')
        expect(res.status).toBe(500)
        expect(res.body.message).toBe('This secret could not be read. Save it again.')
        expect(JSON.stringify(res.body)).not.toContain('aa:bb:cc')
        await call(user, 'delete', '/BROKEN_ROW')
    })
})

describe('secrets api: bodies that are refused', () => {
    let user: TestUser

    beforeAll(async () => {
        user = await newUser('bodies')
    })

    const expect400 = async (path: string, body: unknown) => {
        const res = await call(user, 'post', path).send(body as object)
        expect(res.status).toBe(400)
        return res
    }

    it('refuses missing, empty and wrong-type fields', async () => {
        await expect400('', {})
        await expect400('', { name: 'KEY' })
        await expect400('', { value: 'v' })
        await expect400('', { name: '', value: 'v' })
        await expect400('', { name: 'KEY', value: '' })
        await expect400('', { name: 42, value: 'v' })
        await expect400('', { name: 'KEY', value: { a: 1 } })
        await expect400('', { name: 'KEY', value: 'v', note: 42 })
        await expect400('', { name: ['KEY'], value: 'v' })
    })

    it('refuses fields it does not know (no userId, no id from the body)', async () => {
        const other = await newUser('bodies-other')
        await expect400('', { name: 'KEY', value: 'v', userId: other.userId })
        await expect400('', { name: 'KEY', value: 'v', id: 'x' })
        await expect400('/bulk', { secrets: [{ name: 'KEY', value: 'v' }], userId: other.userId })
        await expect400('/bulk', { secrets: [{ name: 'KEY', value: 'v', userId: other.userId }] })
        const list = await call(other, 'get', '')
        expect(list.body.data.secrets).toEqual([])
    })

    it('refuses bad names and says why', async () => {
        const lower = await expect400('', { name: 'api_key', value: 'v' })
        expect(lower.body.errors.name).toEqual(['Use only A-Z, 0-9 and _ in the name.'])
        for (const name of ['1KEY', 'API KEY', 'API-KEY', 'KEY=1', 'KEY;ls', 'X'.repeat(129)]) {
            await expect400('', { name, value: 'v' })
        }
    })

    it('refuses the system names of the sandbox', async () => {
        for (const name of ['PATH', 'HOME', 'LD_PRELOAD', 'BASH_ENV', 'DECEMBER_X', 'E2B_KEY']) {
            const res = await expect400('', { name, value: 'v' })
            expect(res.body.errors.name).toEqual([
                `${name} is a system name. Use a different name.`,
            ])
        }
        await expect400('/bulk', { secrets: [{ name: 'LD_LIBRARY_PATH', value: 'v' }] })
    })

    it('refuses a value that is too long, only spaces, or has a NUL', async () => {
        await expect400('', { name: 'BIG', value: 'a'.repeat(SECRET_VALUE_MAX + 1) })
        await expect400('', { name: 'BLANK', value: '   ' })
        await expect400('', { name: 'NUL', value: 'a\u0000b' })
        const atMax = await call(user, 'post', '').send({
            name: 'AT_MAX',
            value: 'a'.repeat(SECRET_VALUE_MAX),
        })
        expect(atMax.status).toBe(201)
    })

    it('refuses a note that is too long', async () => {
        await expect400('', { name: 'KEY', value: 'v', note: 'n'.repeat(201) })
    })

    it(`refuses an empty bulk list and one longer than ${SECRETS_BULK_MAX}`, async () => {
        await expect400('/bulk', { secrets: [] })
        await expect400('/bulk', {})
        await expect400('/bulk', {
            secrets: Array.from({ length: SECRETS_BULK_MAX + 1 }, (_, i) => ({
                name: `K_${i}`,
                value: 'v',
            })),
        })
    })

    it('saves none of a bulk list when one item is bad, or a name is there two times', async () => {
        await expect400('/bulk', {
            secrets: [
                { name: 'GOOD_ONE', value: 'v' },
                { name: 'PATH', value: 'v' },
            ],
        })
        const dup = await expect400('/bulk', {
            secrets: [
                { name: 'TWICE', value: 'a' },
                { name: 'TWICE', value: 'b' },
            ],
        })
        expect(dup.body.message).toBe('TWICE is in the list more than one time.')
        const list = await call(user, 'get', '')
        const names = list.body.data.secrets.map((s: { name: string }) => s.name)
        expect(names).not.toContain('GOOD_ONE')
        expect(names).not.toContain('TWICE')
    })

    it('refuses extra or bad query fields on the routes that take a name', async () => {
        expect((await call(user, 'get', '/AT_MAX/value?x=1')).status).toBe(400)
        expect((await call(user, 'get', '/AT_MAX/value?repo=a&repo=b')).status).toBe(400)
        expect((await call(user, 'delete', '/AT_MAX?x=1')).status).toBe(400)
        expect((await call(user, 'get', `/${'X'.repeat(300)}/value`)).status).toBe(400)
    })
})

describe('secrets api: the limit of secrets for each user', () => {
    let user: TestUser

    beforeAll(async () => {
        user = await newUser('limit')
        await prisma.secret.createMany({
            data: Array.from({ length: SECRETS_PER_USER_MAX - 1 }, (_, i) => ({
                userId: user.userId,
                name: `FILL_${i}`,
                value: secretsService.encrypt({ text: 'x' }),
            })),
        })
    })

    it('refuses a bulk list that goes past the limit, and saves none of it', async () => {
        const res = await call(user, 'post', '/bulk').send({
            secrets: [
                { name: 'NEW_A', value: 'a' },
                { name: 'NEW_B', value: 'b' },
            ],
        })
        expect(res.status).toBe(400)
        expect(await prisma.secret.count({ where: { userId: user.userId } })).toBe(
            SECRETS_PER_USER_MAX - 1
        )
    })

    it('takes the last new secret, then refuses one more', async () => {
        const last = await call(user, 'post', '').send({ name: 'LAST', value: 'v' })
        expect(last.status).toBe(201)
        const more = await call(user, 'post', '').send({ name: 'ONE_MORE', value: 'v' })
        expect(more.status).toBe(400)
        expect(more.body.message).toBe(
            `You can keep up to ${SECRETS_PER_USER_MAX} secrets. Delete one to add another.`
        )
    })

    it('still takes a new value for a name that is there', async () => {
        const res = await call(user, 'post', '').send({ name: 'FILL_0', value: 'new' })
        expect(res.status).toBe(201)
        const bulk = await call(user, 'post', '/bulk').send({
            secrets: [{ name: 'FILL_1', value: 'new' }],
        })
        expect(bulk.status).toBe(201)
    })
})

describe('secrets api: reading values is rate limited', () => {
    it('refuses the 61st read in 15 minutes for one user, and not for another user', async () => {
        const user = await newUser('rate')
        const other = await newUser('rate-other')
        await call(user, 'post', '').send({ name: 'RATE', value: 'v' })
        await call(other, 'post', '').send({ name: 'RATE', value: 'v' })
        const statuses: number[] = []
        for (let i = 0; i < 61; i++) {
            statuses.push((await call(user, 'get', '/RATE/value')).status)
        }
        expect(statuses.slice(0, 60).every((status) => status === 200)).toBe(true)
        expect(statuses[60]).toBe(429)
        // the list and the other user are not limited by these reads
        expect((await call(user, 'get', '')).status).toBe(200)
        expect((await call(other, 'get', '/RATE/value')).status).toBe(200)
    })
})

// #637 section 5: a secret for all repositories, or for one repository
describe('secrets api: a secret for one repository', () => {
    let owner: TestUser
    let other: TestUser

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
        owner = await newUser('repo-owner')
        other = await newUser('repo-other')
    })

    it('keeps one name once for all repositories and once for a repository', async () => {
        const forAll = await call(owner, 'post', '').send({
            name: 'API_URL',
            value: 'https://all.test',
        })
        expect(forAll.status).toBe(201)
        expect(forAll.body.data.secret.repoFullName).toBeNull()

        const forRepo = await call(owner, 'post', '').send({
            name: 'API_URL',
            value: 'https://web.test',
            repoFullName: 'acme/web',
        })
        expect(forRepo.status).toBe(201)
        expect(forRepo.body.data.secret.repoFullName).toBe('acme/web')

        const list = await call(owner, 'get', '')
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
        const list = await call(owner, 'get', '')
        const text = JSON.stringify(list.body)
        expect(text).not.toContain('https://all.test')
        expect(text).not.toContain('https://web.test')
        for (const row of list.body.data.secrets) expect(row.value).toBeUndefined()
    })

    it('saves the same name and repository again as an update, in any letter case', async () => {
        const again = await call(owner, 'post', '').send({
            name: 'API_URL',
            value: 'https://web-2.test',
            repoFullName: 'Acme/Web',
        })
        expect(again.status).toBe(201)

        const list = await call(owner, 'get', '')
        expect(list.body.data.secrets.length).toBe(2)

        const value = await call(owner, 'get', '/API_URL/value?repo=ACME/web')
        expect(value.status).toBe(200)
        expect(value.body.data.secret.value).toBe('https://web-2.test')
        expect(value.body.data.secret.repoFullName).toBe('acme/web')
    })

    it('reads the "all repositories" value when the call names no repository', async () => {
        const value = await call(owner, 'get', '/API_URL/value')
        expect(value.status).toBe(200)
        expect(value.body.data.secret.value).toBe('https://all.test')
        expect(value.body.data.secret.repoFullName).toBeNull()
    })

    it('takes null and an empty text as "all repositories"', async () => {
        const withNull = await call(owner, 'post', '').send({
            name: 'REGION',
            value: 'eu',
            repoFullName: null,
        })
        expect(withNull.status).toBe(201)
        expect(withNull.body.data.secret.repoFullName).toBeNull()

        const withEmpty = await call(owner, 'post', '').send({
            name: 'REGION',
            value: 'us',
            repoFullName: '',
        })
        expect(withEmpty.status).toBe(201)

        const value = await call(owner, 'get', '/REGION/value')
        expect(value.body.data.secret.value).toBe('us')
        await call(owner, 'delete', '/REGION')
    })

    it('refuses a repository that is not owner/name', async () => {
        for (const repoFullName of ['web', 'acme/', '/web', 'acme/web repo', '../web', 'a/b;c']) {
            const res = await call(owner, 'post', '').send({
                name: 'BAD',
                value: 'x',
                repoFullName,
            })
            expect(res.status).toBe(400)
        }
        expect((await call(owner, 'get', '/API_URL/value?repo=web')).status).toBe(400)
        expect((await call(owner, 'delete', '/API_URL?repo=web')).status).toBe(400)
    })

    it('gives a session the value of its repository, and the "all" value elsewhere', async () => {
        const web = await newSession(owner.userId, { owner: 'Acme', name: 'Web' })
        const docs = await newSession(owner.userId, { owner: 'acme', name: 'docs' })
        const none = await newSession(owner.userId, null)

        expect(
            await secretsService.getAllDecryptedSecrets({ userId: owner.userId, sessionId: web.id })
        ).toEqual([{ key: 'API_URL', value: 'https://web-2.test' }])
        expect(
            await secretsService.getAllDecryptedSecrets({
                userId: owner.userId,
                sessionId: docs.id,
            })
        ).toEqual([{ key: 'API_URL', value: 'https://all.test' }])
        expect(
            await secretsService.getAllDecryptedSecrets({
                userId: owner.userId,
                sessionId: none.id,
            })
        ).toEqual([{ key: 'API_URL', value: 'https://all.test' }])
        expect(
            await secretsService.getAllDecryptedSecrets({
                userId: owner.userId,
                repoFullName: 'ACME/WEB',
            })
        ).toEqual([{ key: 'API_URL', value: 'https://web-2.test' }])
    })

    it('gives a secret of one repository only to that repository', async () => {
        const res = await call(owner, 'post', '').send({
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

        // the read with no repository does not find a secret of one repository
        expect((await call(owner, 'get', '/WEB_ONLY/value')).status).toBe(404)
    })

    it('never gives an old row with a system name to a sandbox', async () => {
        await prisma.secret.create({
            data: {
                userId: owner.userId,
                name: 'LD_PRELOAD',
                value: secretsService.encrypt({ text: '/tmp/evil.so' }),
            },
        })
        const forNone = await secretsService.getAllDecryptedSecrets({ userId: owner.userId })
        expect(forNone.map((item) => item.key)).not.toContain('LD_PRELOAD')
        expect((await call(owner, 'delete', '/LD_PRELOAD')).status).toBe(200)
    })

    it("never reads, deletes or lists another user's secret", async () => {
        expect((await call(other, 'get', '/API_URL/value?repo=acme/web')).status).toBe(404)
        expect((await call(other, 'get', '/API_URL/value')).status).toBe(404)
        expect((await call(other, 'delete', '/API_URL?repo=acme/web')).status).toBe(404)
        expect((await call(other, 'delete', '/API_URL')).status).toBe(404)
        expect((await call(other, 'get', '')).body.data.secrets).toEqual([])

        // the owner's rows are all still there
        expect((await call(owner, 'get', '/API_URL/value')).status).toBe(200)

        // the same repository name under another user gets nothing of the owner
        expect(
            await secretsService.getAllDecryptedSecrets({
                userId: other.userId,
                repoFullName: 'acme/web',
            })
        ).toEqual([])

        // a session of the owner, asked for by another user, gives no repository to that user
        await call(other, 'post', '').send({ name: 'API_URL', value: 'https://other.test' })
        const ownerSession = await newSession(owner.userId, { owner: 'acme', name: 'web' })
        expect(
            await secretsService.getAllDecryptedSecrets({
                userId: other.userId,
                sessionId: ownerSession.id,
            })
        ).toEqual([{ key: 'API_URL', value: 'https://other.test' }])
    })

    it('a save by another user with the same name and repository makes a row of their own', async () => {
        const res = await call(other, 'post', '').send({
            name: 'API_URL',
            value: 'https://other-web.test',
            repoFullName: 'acme/web',
        })
        expect(res.status).toBe(201)
        const mine = await call(owner, 'get', '/API_URL/value?repo=acme/web')
        expect(mine.body.data.secret.value).toBe('https://web-2.test')
    })

    it('deletes the row of one repository and keeps the other', async () => {
        expect((await call(owner, 'delete', '/API_URL?repo=acme/web')).status).toBe(200)

        expect((await call(owner, 'get', '/API_URL/value?repo=acme/web')).status).toBe(404)
        const kept = await call(owner, 'get', '/API_URL/value')
        expect(kept.status).toBe(200)
        expect(kept.body.data.secret.value).toBe('https://all.test')

        expect((await call(owner, 'delete', '/API_URL?repo=acme/web')).status).toBe(404)
    })

    it('deletes the "all repositories" row with no repo and keeps the repository row', async () => {
        await call(owner, 'post', '').send({
            name: 'API_URL',
            value: 'https://web-3.test',
            repoFullName: 'acme/web',
        })
        expect((await call(owner, 'delete', '/API_URL')).status).toBe(200)

        const kept = await call(owner, 'get', '/API_URL/value?repo=acme/web')
        expect(kept.status).toBe(200)
        expect(kept.body.data.secret.value).toBe('https://web-3.test')
        expect((await call(owner, 'get', '/API_URL/value')).status).toBe(404)
    })

    it('imports many secrets for one repository, or each with its own', async () => {
        const res = await call(owner, 'post', '/bulk').send({
            repoFullName: 'acme/api',
            secrets: [
                { name: 'BULK_ONE', value: 'one' },
                { name: 'BULK_TWO', value: 'two', repoFullName: 'acme/docs' },
                { name: 'BULK_THREE', value: 'three', repoFullName: null },
            ],
        })
        expect(res.status).toBe(201)

        const list = await call(owner, 'get', '')
        const repoOf = (name: string) =>
            list.body.data.secrets.find((row: { name: string }) => row.name === name)?.repoFullName
        expect(repoOf('BULK_ONE')).toBe('acme/api')
        expect(repoOf('BULK_TWO')).toBe('acme/docs')
        expect(repoOf('BULK_THREE')).toBeNull()

        const old = await call(owner, 'post', '/bulk').send({
            secrets: [{ name: 'BULK_OLD', value: 'old' }],
        })
        expect(old.status).toBe(201)
        expect((await call(owner, 'get', '/BULK_OLD/value')).body.data.secret.value).toBe('old')
    })
})

describe('secrets repository', () => {
    let user: TestUser
    let other: TestUser

    beforeAll(async () => {
        user = await newUser('repo-layer')
        other = await newUser('repo-layer-other')
    })

    it('upserts a row: a note is kept with no note, and cleared with null', async () => {
        const first = await secretsRepository.upsertSecret(user.userId, 'R_KEY', 'enc-1', 'n1')
        expect(first).toMatchObject({ name: 'R_KEY', note: 'n1', repoFullName: '' })
        expect('value' in first).toBe(false)
        const kept = await secretsRepository.upsertSecret(user.userId, 'R_KEY', 'enc-2')
        expect(kept.note).toBe('n1')
        const cleared = await secretsRepository.upsertSecret(user.userId, 'R_KEY', 'enc-3', null)
        expect(cleared.note).toBeNull()
        expect(cleared.id).toBe(first.id)
        const row = await secretsRepository.findSecretByName(user.userId, 'R_KEY')
        expect(row?.value).toBe('enc-3')
    })

    it('saves a bulk list in one transaction, and none of it when one row fails', async () => {
        const saved = await secretsRepository.bulkUpsertSecrets(user.userId, [
            { name: 'R_A', encryptedValue: 'a', repoFullName: 'acme/web' },
            { name: 'R_B', encryptedValue: 'b' },
        ])
        expect(saved.map((row) => [row.name, row.repoFullName])).toEqual([
            ['R_A', 'acme/web'],
            ['R_B', ''],
        ])
        for (const row of saved) expect('value' in row).toBe(false)

        await expect(
            secretsRepository.bulkUpsertSecrets(user.userId, [
                { name: 'R_C', encryptedValue: 'c' },
                // Postgres refuses a NUL byte in a text column
                { name: 'R_D', encryptedValue: 'bad\u0000value' },
            ])
        ).rejects.toThrow()
        expect(await secretsRepository.findSecretByName(user.userId, 'R_C')).toBeNull()
    })

    it('lists and counts only the rows of the user, with no value', async () => {
        await secretsRepository.upsertSecret(other.userId, 'R_OTHER', 'x')
        const rows = await secretsRepository.findSecretsByUser(user.userId)
        expect(rows.map((row) => row.name).sort()).toEqual(['R_A', 'R_B', 'R_KEY'])
        for (const row of rows) expect('value' in row).toBe(false)
        expect(await secretsRepository.countSecretsByUser(user.userId)).toBe(3)
        expect(await secretsRepository.countSecretsByUser(other.userId)).toBe(1)
    })

    it('reads the "all repositories" rows, plus one repository when asked', async () => {
        const all = await secretsRepository.findSecretsWithValuesByUser(user.userId)
        expect(all.map((row) => row.name)).toEqual(['R_B', 'R_KEY'])
        const web = await secretsRepository.findSecretsWithValuesByUser(user.userId, 'acme/web')
        expect(web.map((row) => row.name)).toEqual(['R_A', 'R_B', 'R_KEY'])
        const api = await secretsRepository.findSecretsWithValuesByUser(user.userId, 'acme/api')
        expect(api.map((row) => row.name)).toEqual(['R_B', 'R_KEY'])
    })

    it('deletes by user, name and repository, and counts what it deleted', async () => {
        expect(await secretsRepository.deleteSecret(other.userId, 'R_A', 'acme/web')).toBe(0)
        expect(await secretsRepository.deleteSecret(user.userId, 'R_A')).toBe(0)
        expect(await secretsRepository.deleteSecret(user.userId, 'R_A', 'acme/web')).toBe(1)
        expect(await secretsRepository.deleteSecret(user.userId, 'R_A', 'acme/web')).toBe(0)
    })

    it('gives the repository of a session only to the user of the session', async () => {
        const session = await prisma.session.create({
            data: {
                userId: user.userId,
                title: 'repo layer session',
                githubRepoOwner: 'acme',
                githubRepoName: 'web',
            },
        })
        expect(await secretsRepository.findSessionRepo(user.userId, session.id)).toMatchObject({
            githubRepoOwner: 'acme',
            githubRepoName: 'web',
        })
        expect(await secretsRepository.findSessionRepo(other.userId, session.id)).toBeNull()
    })
})
