import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import { gitlabAdapter } from '../src/auth/subscriptions/adapters/gitlab'

describe('GitLab Duo Adapter (TDD)', () => {
    let originalEnv: NodeJS.ProcessEnv
    let originalFetch: typeof globalThis.fetch
    let tempDir: string

    beforeEach(async () => {
        originalFetch = globalThis.fetch
        originalEnv = { ...process.env }
        tempDir = path.join(os.tmpdir(), `december-gitlab-test-${Date.now()}-${Math.random()}`)
        await fs.mkdir(tempDir, { recursive: true })
        process.env.HOME = tempDir
        delete process.env.GITLAB_TOKEN
        delete process.env.GL_TOKEN
        delete process.env.GITLAB_DUO_TOKEN
    })

    afterEach(async () => {
        globalThis.fetch = originalFetch
        process.env = originalEnv
        vi.restoreAllMocks()
        try {
            await fs.rm(tempDir, { recursive: true, force: true })
        } catch {
            // Intentionally swallowed: test cleanup
        }
    })

    describe('Seam 1: Local Credential Detection', () => {
        it('detects credentials from ~/.config/glab-cli/config.yml', async () => {
            const glabConfigDir = path.join(tempDir, '.config', 'glab-cli')
            await fs.mkdir(glabConfigDir, { recursive: true })

            const yamlContent = `
hosts:
    gitlab.com:
        token: glpat-test-token-777
        user: duo_engineer
`
            await fs.writeFile(path.join(glabConfigDir, 'config.yml'), yamlContent, 'utf-8')

            const detected = await gitlabAdapter.detectLocal()

            expect(detected).not.toBeNull()
            expect(detected?.provider).toBe('gitlab')
            expect(detected?.accessToken).toBe('glpat-test-token-777')
            expect(detected?.accountName).toBe('duo_engineer')
            expect(detected?.subscriptionType).toBe('gitlab_duo_pro')
            expect(detected?.source).toBe('local_import')
        })

        it('detects credentials from GITLAB_TOKEN environment variable', async () => {
            process.env.GITLAB_TOKEN = 'glpat-env-secret-888'

            const detected = await gitlabAdapter.detectLocal()

            expect(detected).not.toBeNull()
            expect(detected?.provider).toBe('gitlab')
            expect(detected?.accessToken).toBe('glpat-env-secret-888')
            expect(detected?.source).toBe('env')
        })

        it('returns null when no GitLab config or env variables exist', async () => {
            const detected = await gitlabAdapter.detectLocal()
            expect(detected).toBeNull()
        })
    })

    describe('Seam 2: Token Refresh & Expiry', () => {
        it('refreshes OAuth token using GitLab /oauth/token endpoint', async () => {
            const bundle = {
                provider: 'gitlab',
                accessToken: 'old-access-token',
                refreshToken: 'old-refresh-token',
                expiresAt: Date.now() - 1000,
                extra: {
                    host: 'https://gitlab.com',
                    clientId: 'mock-gl-client-id',
                },
            }

            globalThis.fetch = vi.fn().mockResolvedValue({
                ok: true,
                json: async () => ({
                    access_token: 'new-gl-access-token',
                    refresh_token: 'new-gl-refresh-token',
                    expires_in: 7200,
                }),
            }) as any

            const refreshed = await gitlabAdapter.refreshToken!(bundle)

            expect(refreshed.accessToken).toBe('new-gl-access-token')
            expect(refreshed.refreshToken).toBe('new-gl-refresh-token')
            expect(refreshed.expiresAt).toBeGreaterThan(Date.now() + 7000 * 1000)
        })

        it('returns personal access token unchanged without attempting OAuth refresh', async () => {
            const bundle = {
                provider: 'gitlab',
                accessToken: 'glpat-permanent-token',
            }

            const refreshed = await gitlabAdapter.refreshToken!(bundle)
            expect(refreshed.accessToken).toBe('glpat-permanent-token')
        })
    })

    describe('Seam 3: Interactive Login & PKCE Flow', () => {
        it('performs OAuth authorization flow via local redirect server', async () => {
            const onCodeMock = vi.fn()

            globalThis.fetch = vi.fn().mockResolvedValue({
                ok: true,
                json: async () => ({
                    access_token: 'gl-oauth-token-123',
                    refresh_token: 'gl-oauth-refresh-456',
                    expires_in: 7200,
                }),
            }) as any

            // In test environment, loginOAuth falls back or triggers callback
            const bundle = await gitlabAdapter.loginOAuth!(onCodeMock)

            expect(bundle.provider).toBe('gitlab')
            expect(bundle.accessToken).toBeDefined()
            expect(bundle.source).toBe('oauth_login')
            expect(onCodeMock).toHaveBeenCalled()
        })
    })
})
