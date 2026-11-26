import { prisma } from '@december/database'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'bun:test'
import request from 'supertest'

import app from '../../src/app'
import { authCookieToken, cleanupTestUser, getRandomIP, signInWithEmailCode } from '../helpers'

const realFetch = globalThis.fetch
const githubCalls: { url: string; authorization: string | null }[] = []

// answers api.github.com and lets every other request through
const stubGithub = (answer: (url: string) => Response) => {
    globalThis.fetch = (async (input: any, init?: RequestInit) => {
        const url = String(input)
        if (!url.startsWith('https://api.github.com')) return realFetch(input, init)
        githubCalls.push({ url, authorization: new Headers(init?.headers).get('authorization') })
        return answer(url)
    }) as typeof fetch
}

const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
    })

// issue 637: the prompt box asks if the default base branch is in the picked repository
describe('GET /platform/repos/branch (#637)', () => {
    const email = `branchcheck-${Date.now()}@example.com`
    const noGitEmail = `branchcheck-nogit-${Date.now()}@example.com`
    let token: string
    let noGitToken: string

    const check = (query: Record<string, string>, bearer = token) =>
        request(app)
            .get('/api/v1/platform/repos/branch')
            .query(query)
            .set('x-forwarded-for', getRandomIP())
            .set('Authorization', `Bearer ${bearer}`)

    beforeAll(async () => {
        await prisma.user.create({
            data: {
                email,
                name: 'Branch Check',
                emailVerified: true,
                githubConnected: true,
                githubToken: 'gho_branch_check_token',
            },
        })
        await prisma.user.create({
            data: { email: noGitEmail, name: 'No Git', emailVerified: true },
        })
        token = authCookieToken(await signInWithEmailCode(app, email))
        noGitToken = authCookieToken(await signInWithEmailCode(app, noGitEmail))
    })

    afterEach(() => {
        globalThis.fetch = realFetch
        githubCalls.length = 0
    })

    afterAll(async () => {
        await cleanupTestUser({ email })
        await cleanupTestUser({ email: noGitEmail })
    })

    it('says a branch of the repository exists', async () => {
        stubGithub(() => json({ name: 'release/2.0' }))

        const res = await check({ repository: 'acme/web', branch: 'release/2.0' })
        expect(res.status).toBe(200)
        expect(res.body.data).toEqual({ exists: true })
        expect(githubCalls).toEqual([
            {
                url: 'https://api.github.com/repos/acme/web/branches/release/2.0',
                authorization: 'Bearer gho_branch_check_token',
            },
        ])
    })

    it('says a branch that is not in the repository does not exist', async () => {
        stubGithub(() => json({ message: 'Branch not found' }, 404))

        const res = await check({ repository: 'acme/web', branch: 'develop' })
        expect(res.status).toBe(200)
        expect(res.body.data).toEqual({ exists: false })
    })

    it('rejects a bad repository or branch, and a request with no sign-in', async () => {
        stubGithub(() => json({ name: 'main' }))

        expect((await check({ repository: 'web', branch: 'main' })).status).toBe(400)
        expect((await check({ repository: 'acme/web', branch: 'a b' })).status).toBe(400)
        expect((await check({ repository: 'acme/web' })).status).toBe(400)
        expect(
            (await check({ repository: 'acme/web', branch: 'main', provider: 'BITBUCKET' })).status
        ).toBe(400)
        expect(githubCalls).toEqual([])

        const anonymous = await request(app)
            .get('/api/v1/platform/repos/branch')
            .query({ repository: 'acme/web', branch: 'main' })
            .set('x-forwarded-for', getRandomIP())
        expect(anonymous.status).toBe(401)
    })

    // review B5: a part of dots only would point the request at another path of the host
    it('refuses a repository with a part of dots only, with no request to the host', async () => {
        const githubCalls: string[] = []
        stubGithub((url) => {
            githubCalls.push(url)
            return json({ name: 'main' })
        })
        for (const repository of ['../x', 'acme/..', 'acme/./web']) {
            expect((await check({ repository, branch: 'main' })).status).toBe(400)
        }
        expect(githubCalls).toEqual([])
    })

    it('fails for a user with no git host connected, and when the host fails', async () => {
        stubGithub(() => json({ message: 'boom' }, 500))

        const noGit = await check({ repository: 'acme/web', branch: 'main' }, noGitToken)
        expect(noGit.status).toBe(400)
        expect(githubCalls).toEqual([])

        const hostDown = await check({ repository: 'acme/web', branch: 'main' })
        expect(hostDown.status).toBe(502)
    })
})
