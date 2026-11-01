import {
    openaiProvider,
    anthropicProvider,
    geminiProvider,
    openrouterProvider,
    copilotProvider,
    antigravityProvider,
    codexResponsesProvider,
    getDynamicEndpoint,
} from '@december/providers'

import { resolveSubscriptionToken } from '../auth/subscriptions/subscription-manager'

import type { SubscriptionTokenBundle } from '../auth/subscriptions/types'

export interface InstantiateProviderOptions {
    authMethod?: 'byok' | 'december' | 'env' | 'subscription'
    subscription?: SubscriptionTokenBundle
    headers?: Record<string, string>
    baseURL?: string
}

function withProviderId(provider: any, id: string): any {
    return typeof provider === 'object' && provider !== null ? { ...provider, id } : provider
}

export function instantiateProvider(
    provider: string,
    apiKey: string,
    options?: InstantiateProviderOptions
): any {
    const normalized = (provider || '').toLowerCase().trim()
    switch (normalized) {
        case 'copilot':
        case 'github_copilot':
        case 'github': {
            const endpoint = options?.baseURL || options?.subscription?.endpoint
            const subscription = options?.subscription
            const getToken = subscription
                ? async () => {
                      try {
                          const refreshed = await resolveSubscriptionToken('copilot', subscription)
                          if (refreshed?.accessToken) {
                              subscription.accessToken = refreshed.accessToken
                              subscription.expiresAt = refreshed.expiresAt
                              subscription.endpoint = refreshed.endpoint
                              return refreshed.accessToken
                          }
                      } catch {
                          // Intentionally swallowed: fallback to current token if dynamic refresh fails
                      }
                      return subscription.accessToken
                  }
                : undefined

            return copilotProvider(apiKey, {
                endpoint,
                headers: options?.headers,
                getToken,
            })
        }
        case 'codex':
        case 'chatgpt': {
            if (options?.authMethod === 'subscription' || options?.subscription) {
                const endpoint = options?.baseURL || options?.subscription?.endpoint
                const accountId = options?.subscription?.extra?.accountId
                return codexResponsesProvider(apiKey, {
                    endpoint,
                    accountId,
                    headers: options?.headers,
                })
            }
            if (options?.baseURL || options?.headers) {
                return openaiProvider(options?.baseURL, apiKey, options?.headers)
            }
            return openaiProvider(undefined, apiKey)
        }
        case 'openai': {
            if (options?.baseURL || options?.headers) {
                return openaiProvider(options?.baseURL, apiKey, options?.headers)
            }
            return openaiProvider(undefined, apiKey)
        }
        case 'antigravity': {
            const subscription = options?.subscription
            const getToken = subscription
                ? async () => {
                      try {
                          const refreshed = await resolveSubscriptionToken('gemini', subscription)
                          if (refreshed?.accessToken) {
                              subscription.accessToken = refreshed.accessToken
                              subscription.expiresAt = refreshed.expiresAt
                              subscription.endpoint = refreshed.endpoint
                              return refreshed.accessToken
                          }
                      } catch {
                          // Intentionally swallowed: fallback to current token if dynamic refresh fails
                      }
                      return subscription.accessToken
                  }
                : undefined

            return antigravityProvider(apiKey, {
                endpoint: options?.baseURL,
                headers: options?.headers,
                getToken,
            })
        }
        case 'claude':
        case 'anthropic': {
            if (options?.authMethod === 'subscription' || options?.subscription) {
                const endpoint = options?.baseURL || options?.subscription?.endpoint
                return anthropicProvider(endpoint, apiKey, {
                    ...options?.headers,
                    'anthropic-beta': 'claude-code-20250219,oauth-2024-06-20',
                })
            }
            if (options?.baseURL || options?.headers) {
                return anthropicProvider(options?.baseURL, apiKey, options?.headers)
            }
            return anthropicProvider(undefined, apiKey)
        }
        case 'gemini':
        case 'google': {
            if (options?.authMethod === 'subscription' || options?.subscription) {
                const endpoint = options?.baseURL || options?.subscription?.endpoint
                const subscription = options?.subscription
                const getToken = subscription
                    ? async () => {
                          try {
                              const refreshed = await resolveSubscriptionToken(
                                  'gemini',
                                  subscription
                              )
                              if (refreshed?.accessToken) {
                                  subscription.accessToken = refreshed.accessToken
                                  subscription.expiresAt = refreshed.expiresAt
                                  subscription.endpoint = refreshed.endpoint
                                  return refreshed.accessToken
                              }
                          } catch {
                              // Intentionally swallowed: fallback to current token if dynamic refresh fails
                          }
                          return subscription.accessToken
                      }
                    : undefined

                return antigravityProvider(apiKey, {
                    endpoint,
                    headers: options?.headers,
                    getToken,
                })
            }
            return geminiProvider(apiKey)
        }
        case 'openrouter':
            return openrouterProvider(apiKey)
        case 'kimi':
            return withProviderId(anthropicProvider('https://api.kimi.com/coding', apiKey), 'kimi')
        case 'thinkingmachines':
        case 'tinker':
        case 'inkling':
            return withProviderId(
                anthropicProvider(
                    'https://tinker.thinkingmachines.dev/services/tinker-prod/anthropic/api',
                    apiKey,
                    { 'anthropic-beta': 'oauth-2024-11-18' }
                ),
                'thinkingmachines'
            )
        default: {
            const dynamicEndpoint = getDynamicEndpoint(normalized)
            if (dynamicEndpoint) {
                const headers =
                    dynamicEndpoint.defaultHeaders || options?.headers
                        ? { ...dynamicEndpoint.defaultHeaders, ...options?.headers }
                        : undefined
                const baseURL = options?.baseURL || dynamicEndpoint.baseURL
                const resolvedApiKey =
                    apiKey ||
                    (dynamicEndpoint.envVar ? process.env[dynamicEndpoint.envVar] : undefined)

                return withProviderId(
                    headers !== undefined
                        ? openaiProvider(baseURL, resolvedApiKey, headers)
                        : openaiProvider(baseURL, resolvedApiKey),
                    normalized
                )
            }

            const serverUrl =
                process.env.SERVER_URL ||
                (process.env.NODE_ENV !== 'production' && process.env.SERVER_PORT
                    ? `http://localhost:${process.env.SERVER_PORT}`
                    : 'https://api.trydecember.com')
            const proxyUrl = `${serverUrl.replace(/\/+$/, '')}/api/v1/cli`
            return openaiProvider(proxyUrl, apiKey)
        }
    }
}
