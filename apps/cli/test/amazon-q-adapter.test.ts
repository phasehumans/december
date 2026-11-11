import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import { amazonQAdapter } from '../src/auth/subscriptions/adapters/amazon-q'

describe('Amazon Q Adapter (TDD)', () => {
    let originalEnv: NodeJS.ProcessEnv
    let originalFetch: typeof globalThis.fetch
    let tempDir: string

    beforeEach(async () => {
        originalFetch = globalThis.fetch
        originalEnv = { ...process.env }
        tempDir = path.join(os.tmpdir(), `december-q-test-${Date.now()}-${Math.random()}`)
        await fs.mkdir(tempDir, { recursive: true })
        process.env.HOME = tempDir
        delete process.env.AWS_SSO_ACCESS_TOKEN
        delete process.env.AMAZON_Q_TOKEN
        delete process.env.AWS_BEARER_TOKEN
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
        it('detects credentials from ~/.aws/sso/cache/*.json', async () => {
            const ssoCacheDir = path.join(tempDir, '.aws', 'sso', 'cache')
            await fs.mkdir(ssoCacheDir, { recursive: true })

            const expiresAtIso = new Date(Date.now() + 3600 * 1000).toISOString()
            const cacheContent = JSON.stringify({
                startUrl: 'https://view.awsapps.com/start',
                region: 'us-east-1',
                accessToken: 'aws-sso-token-xyz-123',
                refreshToken: 'aws-sso-refresh-xyz-456',
                clientId: 'aws-client-id-789',
                clientSecret: 'aws-client-secret-abc',
                expiresAt: expiresAtIso,
            })

            await fs.writeFile(path.join(ssoCacheDir, 'test-session.json'), cacheContent, 'utf-8')

            const detected = await amazonQAdapter.detectLocal()

            expect(detected).not.toBeNull()
            expect(detected?.provider).toBe('amazon-q')
            expect(detected?.accessToken).toBe('aws-sso-token-xyz-123')
            expect(detected?.refreshToken).toBe('aws-sso-refresh-xyz-456')
            expect(detected?.subscriptionType).toBe('amazon_q_pro')
            expect(detected?.source).toBe('local_import')
            expect(detected?.extra?.region).toBe('us-east-1')
        })

        it('detects credentials from AMAZON_Q_TOKEN environment variable', async () => {
            process.env.AMAZON_Q_TOKEN = 'aws-env-token-999'

            const detected = await amazonQAdapter.detectLocal()

            expect(detected).not.toBeNull()
            expect(detected?.provider).toBe('amazon-q')
            expect(detected?.accessToken).toBe('aws-env-token-999')
            expect(detected?.source).toBe('env')
        })

        it('returns null when no AWS SSO cache or env variables exist', async () => {
            const detected = await amazonQAdapter.detectLocal()
            expect(detected).toBeNull()
        })
    })

    describe('Seam 2: Token Refresh & Expiry', () => {
        it('refreshes AWS SSO token using OIDC token endpoint', async () => {
            const bundle = {
                provider: 'amazon-q',
                accessToken: 'old-access-token',
                refreshToken: 'valid-refresh-token',
                expiresAt: Date.now() - 1000,
                extra: {
                    clientId: 'test-client-id',
                    clientSecret: 'test-client-secret',
                    region: 'us-east-1',
                },
            }

            const fetchMock = vi.fn().mockResolvedValue({
                ok: true,
                json: async () => ({
                    accessToken: 'new-refreshed-token-999',
                    refreshToken: 'new-refresh-token-888',
                    expiresIn: 28800,
                }),
            })
            globalThis.fetch = fetchMock as any

            const refreshed = await amazonQAdapter.refreshToken!(bundle)

            expect(refreshed.accessToken).toBe('new-refreshed-token-999')
            expect(refreshed.refreshToken).toBe('new-refresh-token-888')
            expect(refreshed.expiresAt).toBeGreaterThan(Date.now() + 28000 * 1000)
            expect(fetchMock).toHaveBeenCalled()
        })

        it('returns bundle unchanged if no refreshToken is available', async () => {
            const bundle = {
                provider: 'amazon-q',
                accessToken: 'static-access-token',
            }

            const refreshed = await amazonQAdapter.refreshToken!(bundle)
            expect(refreshed.accessToken).toBe('static-access-token')
        })

        it('returns bundle unchanged gracefully when OIDC refresh fails', async () => {
            const bundle = {
                provider: 'amazon-q',
                accessToken: 'old-access-token',
                refreshToken: 'failing-refresh-token',
                extra: { clientId: 'c', clientSecret: 's' },
            }

            globalThis.fetch = vi.fn().mockResolvedValue({
                ok: false,
                status: 400,
                text: async () => 'Invalid grant',
            }) as any

            const refreshed = await amazonQAdapter.refreshToken!(bundle)
            expect(refreshed.accessToken).toBe('old-access-token')
        })
    })

    describe('Seam 3: Interactive Login & Device Authorization', () => {
        it('performs AWS SSO device authorization flow and exchanges device code for token', async () => {
            const onCodeMock = vi.fn()

            let callCount = 0
            globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
                if (url.includes('/client/register')) {
                    return {
                        ok: true,
                        json: async () => ({
                            clientId: 'mock-client-id',
                            clientSecret: 'mock-client-secret',
                        }),
                    }
                }
                if (url.includes('/device_authorization')) {
                    return {
                        ok: true,
                        json: async () => ({
                            deviceCode: 'mock-device-code',
                            userCode: 'AWS-1234',
                            verificationUriComplete:
                                'https://device.sso.us-east-1.amazonaws.com/?user_code=AWS-1234',
                            interval: 0.05,
                            expiresIn: 300,
                        }),
                    }
                }
                if (url.includes('/token')) {
                    callCount++
                    if (callCount === 1) {
                        return {
                            ok: false,
                            status: 400,
                            json: async () => ({ error: 'authorization_pending' }),
                        }
                    }
                    return {
                        ok: true,
                        json: async () => ({
                            accessToken: 'aws-new-auth-token-555',
                            refreshToken: 'aws-new-refresh-token-555',
                            expiresIn: 28800,
                        }),
                    }
                }
                return { ok: false, status: 404 }
            }) as any

            const bundle = await amazonQAdapter.loginOAuth!(onCodeMock)

            expect(bundle.provider).toBe('amazon-q')
            expect(bundle.accessToken).toBe('aws-new-auth-token-555')
            expect(bundle.refreshToken).toBe('aws-new-refresh-token-555')
            expect(bundle.source).toBe('oauth_login')
            expect(onCodeMock).toHaveBeenCalledWith('AWS-1234', expect.stringContaining('AWS-1234'))
        })
    })
})
