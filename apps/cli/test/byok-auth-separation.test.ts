import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { describe, it, expect, beforeEach, afterEach } from 'bun:test'

import { useAuthHandlers } from '../src/hooks/use-auth-handlers'
import { useCliStore } from '../src/store'

describe('BYOK Provider Selection vs Subscription Selection (Unit)', () => {
    const originalEnv = { ...process.env }
    let testConfigDir: string

    beforeEach(async () => {
        testConfigDir = path.join(os.tmpdir(), `december-byok-test-${Date.now()}-${Math.random()}`)
        await fs.mkdir(testConfigDir, { recursive: true })
        process.env = { ...originalEnv }
        process.env.HOME = testConfigDir
        process.env.USERPROFILE = testConfigDir
        process.env.DECEMBER_CONFIG_DIR = testConfigDir

        // Reset store state
        useCliStore.setState({
            authMode: 'none',
            selectedProvider: '',
            authMethod: undefined,
            isAuthenticated: false,
        })
    })

    afterEach(async () => {
        process.env = { ...originalEnv }
        try {
            await fs.rm(testConfigDir, { recursive: true, force: true })
        } catch {
            // Intentionally swallowed: cleanup test dir
        }
    })

    it('navigates to byok_provider menu when BYOK is selected from auth menu', async () => {
        const handlers = useAuthHandlers(null)
        await handlers.handleAuthMenuSelect({ value: 'byok' })
        expect(useCliStore.getState().authMode).toBe('byok_provider')
    })

    it('navigates to subscription_select menu when subscriptions is selected from auth menu', async () => {
        const handlers = useAuthHandlers(null)
        await handlers.handleAuthMenuSelect({ value: 'subscriptions' })
        expect(useCliStore.getState().authMode).toBe('subscription_select')
    })

    it('prompts for API key (byok_key) when selecting Anthropic in BYOK mode even if subscription credentials exist', async () => {
        // Even if local Claude credentials exist on disk
        const claudeDir = path.join(testConfigDir, '.claude')
        await fs.mkdir(claudeDir, { recursive: true })
        await fs.writeFile(
            path.join(claudeDir, '.credentials.json'),
            JSON.stringify({
                claudeAiOauth: {
                    accessToken: 'sk-ant-test-token',
                    subscriptionType: 'claude_pro',
                },
            }),
            'utf-8'
        )

        const handlers = useAuthHandlers(null)
        await handlers.handleProviderSelect({ label: 'Anthropic', value: 'anthropic' })

        // Must NOT auto-verify subscription or change authMethod to subscription
        expect(useCliStore.getState().authMode).toBe('byok_key')
        expect(useCliStore.getState().selectedProvider).toBe('anthropic')
        expect(useCliStore.getState().authMethod).not.toBe('subscription')
    })

    it('prompts for API key (byok_key) when selecting Google in BYOK mode', async () => {
        const handlers = useAuthHandlers(null)
        await handlers.handleProviderSelect({ label: 'Google AI Studio', value: 'google' })

        expect(useCliStore.getState().authMode).toBe('byok_key')
        expect(useCliStore.getState().selectedProvider).toBe('google')
        expect(useCliStore.getState().authMethod).not.toBe('subscription')
    })

    it('prompts for API key (byok_key) when selecting OpenAI in BYOK mode', async () => {
        const handlers = useAuthHandlers(null)
        await handlers.handleProviderSelect({ label: 'OpenAI', value: 'openai' })

        expect(useCliStore.getState().authMode).toBe('byok_key')
        expect(useCliStore.getState().selectedProvider).toBe('openai')
        expect(useCliStore.getState().authMethod).not.toBe('subscription')
    })

    it('prompts for API key (byok_key) when selecting AgentRouter in BYOK mode', async () => {
        const handlers = useAuthHandlers(null)
        await handlers.handleProviderSelect({ label: 'AgentRouter', value: 'agentrouter' })

        expect(useCliStore.getState().authMode).toBe('byok_key')
        expect(useCliStore.getState().selectedProvider).toBe('agentrouter')
        expect(useCliStore.getState().authMethod).not.toBe('subscription')
    })

    it('verifies local subscription credentials when handleSubscriptionSelect is used', async () => {
        // Setup local Claude credentials
        const claudeDir = path.join(testConfigDir, '.claude')
        await fs.mkdir(claudeDir, { recursive: true })
        await fs.writeFile(
            path.join(claudeDir, '.credentials.json'),
            JSON.stringify({
                claudeAiOauth: {
                    accessToken: 'sk-ant-test-token',
                    subscriptionType: 'claude_pro',
                },
            }),
            'utf-8'
        )

        const handlers = useAuthHandlers({
            setLLM: () => {},
            modelOptions: {},
        })
        await handlers.handleSubscriptionSelect({ label: 'Claude Code', value: 'claude' })

        // Subscription select should verify local subscription
        expect(useCliStore.getState().authMethod).toBe('subscription')
        expect(useCliStore.getState().selectedProvider).toBe('claude')
        expect(useCliStore.getState().authMode).toBe('none')
    })

    it('saves deepgram key without modifying activeProvider or authPriority', async () => {
        const { loadConfig, saveConfig } = await import('../src/config')
        const initialConfig = await loadConfig()
        initialConfig.activeProvider = 'gemini'
        initialConfig.authPriority = 'subscription'
        await saveConfig(initialConfig)

        useCliStore.setState({ selectedProvider: 'deepgram', authMode: 'byok_key' })

        const originalFetch = globalThis.fetch
        globalThis.fetch = (async (url: string) => {
            if (url.includes('deepgram.com')) {
                return new Response(JSON.stringify({ projects: [] }), { status: 200 })
            }
            return new Response('Not Found', { status: 404 })
        }) as any

        try {
            const handlers = useAuthHandlers(null)
            await handlers.handleKeySubmit('test-deepgram-key')

            expect(useCliStore.getState().authMode).toBe('none')
            const updatedConfig = await loadConfig()
            expect(updatedConfig.providers?.deepgram).toBe('test-deepgram-key')
            expect(updatedConfig.activeProvider).toBe('gemini')
            expect(updatedConfig.authPriority).toBe('subscription')
        } finally {
            globalThis.fetch = originalFetch
        }
    })

    it('successfully saves provider key when initial config on disk has no providers property', async () => {
        const configDir = path.join(testConfigDir, '.december')
        await fs.mkdir(configDir, { recursive: true })
        await fs.writeFile(
            path.join(configDir, 'config.json'),
            JSON.stringify({ activeProvider: 'december', decemberToken: 'tok123' }),
            'utf-8'
        )

        useCliStore.setState({ selectedProvider: 'agnes', authMode: 'byok_key' })

        const originalFetch = globalThis.fetch
        globalThis.fetch = (async () => {
            const stream = new ReadableStream({
                start(controller) {
                    controller.enqueue(
                        new TextEncoder().encode(
                            'data: {"choices":[{"delta":{"content":"Hi"}}]}\n\ndata: [DONE]\n\n'
                        )
                    )
                    controller.close()
                },
            })
            return new Response(stream, {
                status: 200,
                headers: { 'Content-Type': 'text/event-stream' },
            })
        }) as any

        try {
            const handlers = useAuthHandlers(null)
            await handlers.handleKeySubmit('sk-rXxBGNXzrkUu6DoS55avUxGDo605Q8TremjbFhgHSkxZVLH2')

            expect(useCliStore.getState().authError).toBeNull()
            expect(useCliStore.getState().authMode).toBe('none')
            expect(useCliStore.getState().isAuthenticated).toBe(true)

            const { loadConfig } = await import('../src/config')
            const updatedConfig = await loadConfig()
            expect(updatedConfig.providers?.agnes).toBe(
                'sk-rXxBGNXzrkUu6DoS55avUxGDo605Q8TremjbFhgHSkxZVLH2'
            )
            expect(updatedConfig.activeProvider).toBe('agnes')
        } finally {
            globalThis.fetch = originalFetch
        }
    })

    it('prompts for byok_key when forceNewKey is true even if provider already has configured key', async () => {
        const { loadConfig, saveConfig } = await import('../src/config')
        const initialConfig = await loadConfig()
        initialConfig.providers = { anthropic: 'sk-ant-existing-key' }
        await saveConfig(initialConfig)

        const handlers = useAuthHandlers(null)
        await handlers.handleProviderSelect({
            label: 'Anthropic',
            value: 'anthropic',
            forceNewKey: true,
        })

        expect(useCliStore.getState().authMode).toBe('byok_key')
        expect(useCliStore.getState().selectedProvider).toBe('anthropic')
    })

    it('unlinks subscription on handleDeleteProvider and excludes it from auto-detection', async () => {
        const { loadConfig, saveConfig, getProviderConfig } = await import('../src/config')
        const configDir = path.join(testConfigDir, '.claude')
        await fs.mkdir(configDir, { recursive: true })
        await fs.writeFile(
            path.join(configDir, '.credentials.json'),
            JSON.stringify({
                claudeAiOauth: {
                    accessToken: 'sk-ant-test-token',
                    subscriptionType: 'claude_pro',
                },
            }),
            'utf-8'
        )

        const initialConfig = await loadConfig()
        initialConfig.subscriptions = {
            claude: {
                provider: 'claude',
                accessToken: 'sk-ant-test-token',
            },
        }
        initialConfig.activeProvider = 'claude'
        await saveConfig(initialConfig)

        const handlers = useAuthHandlers(null)
        await handlers.handleDeleteProvider('subscription:claude')

        const updatedConfig = await loadConfig()
        expect(updatedConfig.subscriptions?.claude).toBeUndefined()
        expect(updatedConfig.unlinkedSubscriptions).toContain('claude')

        // getProviderConfig should not auto-detect claude when unlinked
        const detectedProvider = await getProviderConfig()
        expect(detectedProvider).toBeUndefined()
    })

    it('unlinks gemini subscription and all aliases on handleDeleteProvider and skips auto-detection in verifyAndResolveSubscription', async () => {
        const { loadConfig, saveConfig } = await import('../src/config')
        const { verifyAndResolveSubscription } =
            await import('../src/auth/subscriptions/subscription-manager')

        // Mock local gemini credentials on disk
        const antigravityDir = path.join(testConfigDir, '.gemini', 'antigravity-cli')
        await fs.mkdir(antigravityDir, { recursive: true })
        await fs.writeFile(
            path.join(antigravityDir, 'auth.json'),
            JSON.stringify({
                token: {
                    access_token: 'ya29.test-local-token',
                    refresh_token: '1//test-refresh-token',
                },
            }),
            'utf-8'
        )

        const initialConfig = await loadConfig()
        initialConfig.subscriptions = {
            gemini: {
                provider: 'gemini',
                accessToken: 'ya29.test-local-token',
            },
        }
        initialConfig.activeProvider = 'gemini'
        await saveConfig(initialConfig)

        const handlers = useAuthHandlers(null)
        await handlers.handleDeleteProvider('subscription:gemini')

        const updatedConfig = await loadConfig()
        expect(updatedConfig.subscriptions?.gemini).toBeUndefined()
        expect(updatedConfig.unlinkedSubscriptions).toContain('gemini')
        expect(updatedConfig.unlinkedSubscriptions).toContain('google')
        expect(updatedConfig.unlinkedSubscriptions).toContain('antigravity')

        // verifyAndResolveSubscription must return null (not silently re-link local token)
        const verified = await verifyAndResolveSubscription('gemini')
        expect(verified).toBeNull()
    })

    it('geminiAdapter.loginOAuth launches OAuth flow with select_account consent instead of returning local detected token', async () => {
        const { geminiAdapter } = await import('../src/auth/subscriptions/adapters/gemini')

        // Setup local gemini token that would previously have short-circuited
        const antigravityDir = path.join(testConfigDir, '.gemini', 'antigravity-cli')
        await fs.mkdir(antigravityDir, { recursive: true })
        await fs.writeFile(
            path.join(antigravityDir, 'auth.json'),
            JSON.stringify({
                token: {
                    access_token: 'ya29.test-local-token',
                },
            }),
            'utf-8'
        )

        let capturedCode = ''
        let capturedUrl = ''

        // Start loginOAuth and catch via onCode callback
        const loginPromise = geminiAdapter.loginOAuth!((code, uri) => {
            capturedCode = code
            capturedUrl = uri
        })

        // Give it a brief moment to generate the URL and trigger onCode
        await new Promise((r) => setTimeout(r, 100))

        expect(capturedCode).toBe('GOOGLE-AUTH')
        expect(capturedUrl).toContain('accounts.google.com/o/oauth2/v2/auth')
        expect(capturedUrl).toContain('select_account')

        // Clean up: loginPromise will time out or reject when done, so swallow error
        loginPromise.catch(() => {
            // Intentionally swallowed: test cleanup for hanging oauth server
        })
    })
})
