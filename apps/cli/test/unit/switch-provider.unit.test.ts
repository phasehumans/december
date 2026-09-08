import { describe, expect, it } from 'bun:test'

import {
    getConfiguredProviders,
    resolveSwitchTarget,
    applyProviderSwitch,
    type DecemberConfig,
} from '../../src/config'

describe('Provider Switch Logic (Unit)', () => {
    it('lists all configured providers across subscriptions, wallet, and BYOK', () => {
        const config: DecemberConfig = {
            activeProvider: 'anthropic',
            activeModel: 'claude-sonnet-4.6',
            authPriority: 'byok',
            lastUsedModels: {
                anthropic: 'claude-sonnet-4.6',
                openai: 'gpt-5.5',
            },
            subscriptions: {
                claude: {
                    provider: 'claude',
                    accessToken: 'token-claude',
                    subscriptionType: 'claude-pro',
                    email: 'dev@example.com',
                },
            },
            decemberToken: 'dec-token-123',
            email: 'user@example.com',
            providers: {
                anthropic: 'sk-ant-123',
                openai: 'sk-openai-123',
            },
        }

        const items = getConfiguredProviders(config)
        expect(items).toHaveLength(4)

        const subItem = items.find((i) => i.value === 'subscription:claude')
        expect(subItem).toBeDefined()
        expect(subItem?.type).toBe('subscription')
        expect(subItem?.label).toBe('Claude (Subscription)')
        expect(subItem?.label).not.toContain('[claude_pro]')
        expect(subItem?.isActive).toBe(false)

        const walletItem = items.find((i) => i.value === 'decemberToken')
        expect(walletItem).toBeDefined()
        expect(walletItem?.type).toBe('december')
        expect(walletItem?.label).toBe('December (Cloud Wallet)')
        expect(walletItem?.isActive).toBe(false)

        const antItem = items.find((i) => i.value === 'provider:anthropic')
        expect(antItem).toBeDefined()
        expect(antItem?.type).toBe('byok')
        expect(antItem?.label).toBe('Anthropic')
        expect(antItem?.label).not.toContain('(API Key)')
        expect(antItem?.isActive).toBe(true)
        expect(antItem?.model).toBe('claude-sonnet-4.6')

        const oaiItem = items.find((i) => i.value === 'provider:openai')
        expect(oaiItem).toBeDefined()
        expect(oaiItem?.type).toBe('byok')
        expect(oaiItem?.isActive).toBe(false)
        expect(oaiItem?.model).toBe('gpt-5.5')
    })

    it('resolves direct switch input prioritizing subscription over BYOK when ambiguous (Option A)', () => {
        const config: DecemberConfig = {
            activeProvider: 'openai',
            authPriority: 'byok',
            subscriptions: {
                claude: {
                    provider: 'claude',
                    accessToken: 'token-claude',
                },
            },
            providers: {
                anthropic: 'sk-ant-123',
                openai: 'sk-openai-123',
            },
        }

        // 'anthropic' query when both claude subscription and anthropic BYOK exist -> should pick claude subscription (Option A)
        const resolvedAnthropic = resolveSwitchTarget(config, 'anthropic')
        expect(resolvedAnthropic).toBeDefined()
        expect(resolvedAnthropic?.authPriority).toBe('subscription')
        expect(resolvedAnthropic?.provider).toBe('claude')

        // Direct 'claude' query -> subscription
        const resolvedClaude = resolveSwitchTarget(config, 'claude')
        expect(resolvedClaude?.authPriority).toBe('subscription')
        expect(resolvedClaude?.provider).toBe('claude')

        // 'openai' query when only BYOK exists -> byok
        const resolvedOpenAI = resolveSwitchTarget(config, 'openai')
        expect(resolvedOpenAI?.authPriority).toBe('byok')
        expect(resolvedOpenAI?.provider).toBe('openai')

        // 'december' when not configured -> undefined
        expect(resolveSwitchTarget(config, 'december')).toBeUndefined()
    })

    it('resolves explicit prefix switch values like subscription:xxx and provider:xxx', () => {
        const config: DecemberConfig = {
            activeProvider: 'claude',
            authPriority: 'subscription',
            subscriptions: {
                claude: { provider: 'claude', accessToken: 't' },
            },
            providers: {
                anthropic: 'sk-ant',
            },
            decemberToken: 'dec-123',
        }

        const byokDirect = resolveSwitchTarget(config, 'provider:anthropic')
        expect(byokDirect?.authPriority).toBe('byok')
        expect(byokDirect?.provider).toBe('anthropic')

        const subDirect = resolveSwitchTarget(config, 'subscription:claude')
        expect(subDirect?.authPriority).toBe('subscription')
        expect(subDirect?.provider).toBe('claude')

        const walletDirect = resolveSwitchTarget(config, 'decemberToken')
        expect(walletDirect?.authPriority).toBe('december')
        expect(walletDirect?.provider).toBe('december_proxy')
    })

    it('applies switch, restoring lastUsedModels when valid and updating activeProvider & authPriority', () => {
        const config: DecemberConfig = {
            activeProvider: 'openai',
            activeModel: 'gpt-4o',
            authPriority: 'byok',
            lastUsedModels: {
                anthropic: 'claude-sonnet-4.6',
                openai: 'gpt-4o',
            },
            providers: {
                anthropic: 'sk-ant',
                openai: 'sk-openai',
            },
        }

        const result = applyProviderSwitch(config, {
            provider: 'anthropic',
            authPriority: 'byok',
        })

        expect(result.config.activeProvider).toBe('anthropic')
        expect(result.config.authPriority).toBe('byok')
        expect(result.config.activeModel).toBe('claude-sonnet-4.6')
        expect(result.config.lastUsedModels?.anthropic).toBe('claude-sonnet-4.6')
    })

    it('falls back to default model if lastUsedModel is missing or invalid for provider', () => {
        const config: DecemberConfig = {
            activeProvider: 'anthropic',
            activeModel: 'claude-sonnet-4.6',
            authPriority: 'byok',
            lastUsedModels: {
                anthropic: 'claude-sonnet-4.6',
                openai: 'invalid-model-name-xyz',
            },
            providers: {
                anthropic: 'sk-ant',
                openai: 'sk-openai',
            },
        }

        const result = applyProviderSwitch(config, {
            provider: 'openai',
            authPriority: 'byok',
        })

        expect(result.config.activeProvider).toBe('openai')
        expect(result.config.activeModel).toBe('gpt-5.6-sol') // default model for openai
        expect(result.config.lastUsedModels?.openai).toBe('gpt-5.6-sol')
    })
})
