import { prisma } from '@december/database'
import { decryptText } from '@december/shared/crypto'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'bun:test'
import request from 'supertest'

import app from '../../src/app'
import { env } from '../../src/env'
import { cleanupTestUser, getRandomIP, signInWithEmailCode } from '../helpers'

const realFetch = globalThis.fetch
const gitlabCalls: { url: string; init?: RequestInit }[] = []

// answers gitlab.com and lets every other request through
const stubGitlab = (answer: (url: string, init?: RequestInit) => Response) => {
    globalThis.fetch = (async (input: any, init?: RequestInit) => {
        const url = String(input)
        if (!url.startsWith('https://gitlab.com')) return realFetch(input, init)
        gitlabCalls.push({ url, init })
        return answer(url, init)
    }) as typeof fetch
}

const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
    })

const signedInUser = async (label: string) => {
    const email = `gitlab-${label}-${Date.now()}@example.com`
    const user = await prisma.user.create({
        data: { email, name: 'GitLab Test', emailVerified: true },
    })
    const res = await signInWithEmailCode(app, email)
    return { user, auth: `Bearer ${res.body.data.accessToken as string}` }
}

const stateCookie = (res: request.Response) => {
    const cookies = ([] as string[]).concat(res.headers['set-cookie'] ?? [])
    return cookies.find((c) => c.startsWith('gitlab_oauth_state='))
}

describe('GitLab connection (#627)', () => {
    let alice: Awaited<ReturnType<typeof signedInUser>>
    let bob: Awaited<ReturnType<typeof signedInUser>>
    const savedEnv = {
        id: env.GITLAB_CLIENT_ID,
        secret: env.GITLAB_CLIENT_SECRET,
    }

    beforeAll(async () => {
        alice = await signedInUser('alice')
        bob = await signedInUser('bob')
    })

    afterEach(() => {
        globalThis.fetch = realFetch
        gitlabCalls.length = 0
        env.GITLAB_CLIENT_ID = 'gl-client-id'
        env.GITLAB_CLIENT_SECRET = 'gl-client-secret'
    })

    afterAll(async () => {
        env.GITLAB_CLIENT_ID = savedEnv.id
        env.GITLAB_CLIENT_SECRET = savedEnv.secret
        await cleanupTestUser({ id: alice.user.id })
        await cleanupTestUser({ id: bob.user.id })
    })

    it('reports gitlab as unavailable until the oauth app is set', async () => {
        env.GITLAB_CLIENT_ID = undefined
        env.GITLAB_CLIENT_SECRET = undefined

        const status = await request(app)
            .get('/api/v1/integrations/gitlab')
            .set('x-forwarded-for', getRandomIP())
            .set('Authorization', alice.auth)
        expect(status.status).toBe(200)
        expect(status.body.data).toEqual({ available: false, connected: false, username: null })

        const start = await request(app)
            .get('/api/v1/integrations/gitlab/start')
            .set('x-forwarded-for', getRandomIP())
            .set('Authorization', alice.auth)
        expect(start.status).toBe(503)
    })

    it('sends a signed-out user to login', async () => {
        env.GITLAB_CLIENT_ID = 'gl-client-id'
        env.GITLAB_CLIENT_SECRET = 'gl-client-secret'

        const res = await request(app)
            .get('/api/v1/integrations/gitlab/start?redirect=/onboarding')
            .set('x-forwarded-for', getRandomIP())

        expect(res.status).toBe(302)
        expect(res.headers.location).toBe(`${env.APP_URL}/login?redirect=%2Fonboarding`)
    })

    it('starts the oauth flow with a state that only this browser can finish', async () => {
        const res = await request(app)
            .get('/api/v1/integrations/gitlab/start?redirect=/onboarding')
            .set('x-forwarded-for', getRandomIP())
            .set('Authorization', alice.auth)

        expect(res.status).toBe(302)
        const location = new URL(res.headers.location as string)
        expect(location.origin + location.pathname).toBe('https://gitlab.com/oauth/authorize')
        expect(location.searchParams.get('client_id')).toBe('gl-client-id')
        expect(location.searchParams.get('redirect_uri')).toBe(
            `${env.SERVER_URL}/api/v1/integrations/gitlab/callback`
        )
        expect(location.searchParams.get('scope')).toBe('api read_user')

        const state = location.searchParams.get('state') as string
        expect(state.endsWith(':/onboarding')).toBe(true)
        const cookie = stateCookie(res)
        expect(cookie).toContain('HttpOnly')
        expect(cookie).toContain(`gitlab_oauth_state=${state.split(':')[0]}`)
    })

    it('refuses a callback whose state does not match the cookie', async () => {
        stubGitlab(() => json({}, 500))

        const res = await request(app)
            .get('/api/v1/integrations/gitlab/callback?code=c1&state=forged:/onboarding')
            .set('x-forwarded-for', getRandomIP())
            .set('Authorization', alice.auth)
            .set('Cookie', 'gitlab_oauth_state=other')

        expect(res.status).toBe(302)
        expect(res.headers.location).toBe(`${env.APP_URL}/onboarding?gitlab=error`)
        expect(gitlabCalls).toHaveLength(0)
        expect(await prisma.gitConnection.count({ where: { userId: alice.user.id } })).toBe(0)
    })

    it('connects gitlab, keeps the tokens encrypted and never returns them', async () => {
        stubGitlab((url) =>
            url.endsWith('/oauth/token')
                ? json({
                      access_token: 'gl-access-1',
                      refresh_token: 'gl-refresh-1',
                      expires_in: 7200,
                  })
                : json({ id: 9001, username: 'alice-gl' })
        )

        const res = await request(app)
            .get('/api/v1/integrations/gitlab/callback?code=c1&state=n1:/onboarding')
            .set('x-forwarded-for', getRandomIP())
            .set('Authorization', alice.auth)
            .set('Cookie', 'gitlab_oauth_state=n1')

        expect(res.status).toBe(302)
        expect(res.headers.location).toBe(`${env.APP_URL}/onboarding`)
        expect(stateCookie(res)).toContain('gitlab_oauth_state=;')

        const tokenCall = gitlabCalls.find((c) => c.url.endsWith('/oauth/token'))
        expect(JSON.parse(String(tokenCall?.init?.body))).toMatchObject({
            code: 'c1',
            grant_type: 'authorization_code',
            redirect_uri: `${env.SERVER_URL}/api/v1/integrations/gitlab/callback`,
        })

        const row = await prisma.gitConnection.findUnique({
            where: { userId_provider: { userId: alice.user.id, provider: 'GITLAB' } },
        })
        expect(row?.externalId).toBe('9001')
        expect(row?.username).toBe('alice-gl')
        expect(row?.encryptedAccessToken).not.toContain('gl-access-1')
        expect(
            decryptText({
                encryptedText: row!.encryptedAccessToken,
                keyHex: env.SECRETS_ENC_KEY,
            })
        ).toBe('gl-access-1')
        expect(row?.expiresAt).toBeInstanceOf(Date)

        const status = await request(app)
            .get('/api/v1/integrations/gitlab')
            .set('x-forwarded-for', getRandomIP())
            .set('Authorization', alice.auth)
        expect(status.body.data).toEqual({ available: true, connected: true, username: 'alice-gl' })
        expect(JSON.stringify(status.body)).not.toContain('gl-access-1')

        const onboarding = await request(app)
            .get('/api/v1/setting/onboarding')
            .set('x-forwarded-for', getRandomIP())
            .set('Authorization', alice.auth)
        expect(onboarding.body.data.steps.github).toBe(true)
        expect(onboarding.body.data.gitlab).toEqual({ username: 'alice-gl' })
    })

    it('does not link a gitlab account that another december user holds', async () => {
        stubGitlab((url) =>
            url.endsWith('/oauth/token')
                ? json({ access_token: 'gl-access-b', refresh_token: 'r', expires_in: 7200 })
                : json({ id: 9001, username: 'alice-gl' })
        )

        const res = await request(app)
            .get('/api/v1/integrations/gitlab/callback?code=c2&state=n2:/settings/repositories')
            .set('x-forwarded-for', getRandomIP())
            .set('Authorization', bob.auth)
            .set('Cookie', 'gitlab_oauth_state=n2')

        expect(res.headers.location).toBe(`${env.APP_URL}/settings/repositories?gitlab=in_use`)
        expect(await prisma.gitConnection.count({ where: { userId: bob.user.id } })).toBe(0)
    })

    it('lists gitlab projects with the stored token', async () => {
        stubGitlab(() =>
            json([
                {
                    id: 5,
                    path: 'app',
                    path_with_namespace: 'acme/app',
                    visibility: 'private',
                    default_branch: 'main',
                    web_url: 'https://gitlab.com/acme/app',
                    http_url_to_repo: 'https://gitlab.com/acme/app.git',
                    namespace: { full_path: 'acme' },
                },
            ])
        )

        const res = await request(app)
            .get('/api/v1/platform/gitlab/repos?search=app')
            .set('x-forwarded-for', getRandomIP())
            .set('Authorization', alice.auth)

        expect(res.status).toBe(200)
        expect(res.body.data).toEqual([
            expect.objectContaining({ id: 5, fullName: 'acme/app', provider: 'GITLAB' }),
        ])
        const headers = gitlabCalls[0]?.init?.headers as Record<string, string>
        expect(headers.Authorization).toBe('Bearer gl-access-1')
    })

    it('refreshes an expired token before it lists projects', async () => {
        await prisma.gitConnection.update({
            where: { userId_provider: { userId: alice.user.id, provider: 'GITLAB' } },
            data: { expiresAt: new Date(Date.now() - 1000) },
        })
        stubGitlab((url) =>
            url.endsWith('/oauth/token')
                ? json({
                      access_token: 'gl-access-2',
                      refresh_token: 'gl-refresh-2',
                      expires_in: 7200,
                  })
                : json([])
        )

        const res = await request(app)
            .get('/api/v1/platform/gitlab/repos')
            .set('x-forwarded-for', getRandomIP())
            .set('Authorization', alice.auth)

        expect(res.status).toBe(200)
        const projectsCall = gitlabCalls.find((c) => c.url.includes('/projects'))
        expect((projectsCall?.init?.headers as Record<string, string>).Authorization).toBe(
            'Bearer gl-access-2'
        )
        const row = await prisma.gitConnection.findUnique({
            where: { userId_provider: { userId: alice.user.id, provider: 'GITLAB' } },
        })
        expect(
            decryptText({ encryptedText: row!.encryptedRefreshToken!, keyHex: env.SECRETS_ENC_KEY })
        ).toBe('gl-refresh-2')
    })

    it('answers 401 for the gitlab repo list when gitlab is not connected', async () => {
        const res = await request(app)
            .get('/api/v1/platform/gitlab/repos')
            .set('x-forwarded-for', getRandomIP())
            .set('Authorization', bob.auth)
        expect(res.status).toBe(401)
    })

    it('starts a session on a gitlab repo as a gitlab session', async () => {
        // starting a session needs credits
        await prisma.user.update({ where: { id: alice.user.id }, data: { creditBalance: 500 } })

        const res = await request(app)
            .post('/api/v1/sessions')
            .set('x-forwarded-for', getRandomIP())
            .set('Authorization', alice.auth)
            .send({ repoUrl: 'https://gitlab.com/acme/tools/importer', title: 'gitlab run' })

        expect(res.status).toBe(201)
        const session = await prisma.session.findUnique({ where: { id: res.body.data.session.id } })
        expect(session?.gitProvider).toBe('GITLAB')
        expect(session?.githubRepoOwner).toBe('acme/tools')
        expect(session?.githubRepoName).toBe('importer')
    })

    it('disconnects gitlab', async () => {
        const res = await request(app)
            .delete('/api/v1/integrations/gitlab')
            .set('x-forwarded-for', getRandomIP())
            .set('Authorization', alice.auth)

        expect(res.status).toBe(200)
        expect(await prisma.gitConnection.count({ where: { userId: alice.user.id } })).toBe(0)
    })
})
