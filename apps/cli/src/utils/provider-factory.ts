import {
    openaiProvider,
    anthropicProvider,
    geminiProvider,
    openrouterProvider,
    copilotProvider,
    antigravityProvider,
    codexResponsesProvider,
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
        case 'deepseek':
            return withProviderId(openaiProvider('https://api.deepseek.com', apiKey), 'deepseek')
        case 'groq':
            return withProviderId(openaiProvider('https://api.groq.com/openai/v1', apiKey), 'groq')
        case 'huggingface':
            return withProviderId(
                openaiProvider('https://router.huggingface.co/v1', apiKey),
                'huggingface'
            )
        case 'kimi':
            return withProviderId(anthropicProvider('https://api.kimi.com/coding', apiKey), 'kimi')
        case 'moonshot':
        case 'moonshoot':
        case 'moonshotai':
        case 'moonshot-ai':
            return withProviderId(openaiProvider('https://api.moonshot.ai/v1', apiKey), 'moonshot')
        case 'mistral':
        case 'mistralai':
        case 'mistral-ai':
            return withProviderId(openaiProvider('https://api.mistral.ai/v1', apiKey), 'mistral')
        case 'xai':
            if (options?.baseURL || options?.headers) {
                return withProviderId(
                    openaiProvider(
                        options?.baseURL || 'https://api.x.ai/v1',
                        apiKey,
                        options?.headers
                    ),
                    'xai'
                )
            }
            return withProviderId(openaiProvider('https://api.x.ai/v1', apiKey), 'xai')
        case 'xiaomi':
        case 'mimo':
            if (options?.baseURL || options?.headers) {
                return withProviderId(
                    openaiProvider(
                        options?.baseURL || 'https://api.xiaomimimo.com/v1',
                        apiKey,
                        options?.headers
                    ),
                    'xiaomi'
                )
            }
            return withProviderId(openaiProvider('https://api.xiaomimimo.com/v1', apiKey), 'xiaomi')
        case 'zai-coding-plan':
            return withProviderId(
                openaiProvider('https://api.z.ai/api/coding/paas/v4', apiKey, options?.headers),
                'zai-coding-plan'
            )
        case 'zai-paas':
            return withProviderId(
                openaiProvider('https://api.z.ai/api/paas/v4', apiKey, options?.headers),
                'zai-paas'
            )
        case 'zai':
        case 'zhipu':
        case 'zhipuai':
            if (options?.baseURL || options?.headers) {
                return withProviderId(
                    openaiProvider(
                        options?.baseURL || 'https://api.z.ai/api/coding/paas/v4',
                        apiKey,
                        options?.headers
                    ),
                    'zai'
                )
            }
            return withProviderId(
                openaiProvider('https://api.z.ai/api/coding/paas/v4', apiKey),
                'zai'
            )
        case 'nvidia':
        case 'nim':
            return withProviderId(
                openaiProvider('https://integrate.api.nvidia.com/v1', apiKey),
                'nvidia'
            )
        case 'sambanova':
            return withProviderId(
                openaiProvider('https://api.sambanova.ai/v1', apiKey),
                'sambanova'
            )
        case 'cerebras':
            return withProviderId(openaiProvider('https://api.cerebras.ai/v1', apiKey), 'cerebras')
        case 'siliconflow':
        case 'siliconcloud':
            if (options?.baseURL || options?.headers) {
                return withProviderId(
                    openaiProvider(
                        options?.baseURL || 'https://api.siliconflow.cn/v1',
                        apiKey,
                        options?.headers
                    ),
                    'siliconflow'
                )
            }
            return withProviderId(
                openaiProvider('https://api.siliconflow.cn/v1', apiKey),
                'siliconflow'
            )
        case 'siliconflow-com':
        case 'siliconflow-intl':
            return withProviderId(
                openaiProvider('https://api.siliconflow.com/v1', apiKey, options?.headers),
                'siliconflow-com'
            )
        case 'siliconflow-cn':
            return withProviderId(
                openaiProvider('https://api.siliconflow.cn/v1', apiKey, options?.headers),
                'siliconflow-cn'
            )
        case 'together':
        case 'togetherai':
            return withProviderId(openaiProvider('https://api.together.xyz/v1', apiKey), 'together')
        case 'hyperbolic':
            return withProviderId(
                openaiProvider('https://api.hyperbolic.xyz/v1', apiKey),
                'hyperbolic'
            )
        case 'fireworks':
        case 'fireworksai':
            return withProviderId(
                openaiProvider('https://api.fireworks.ai/inference/v1', apiKey),
                'fireworks'
            )
        case 'perplexity':
            return withProviderId(openaiProvider('https://api.perplexity.ai', apiKey), 'perplexity')
        case 'cohere':
            return withProviderId(openaiProvider('https://api.cohere.com/v2', apiKey), 'cohere')
        case 'agentrouter':
        case 'agentrouter.org':
            return withProviderId(
                openaiProvider('https://agentrouter.org/v1', apiKey, {
                    'User-Agent': 'claude-cli/2.1.0 (external, sdk-cli)',
                }),
                'agentrouter'
            )
        case 'minimax-anthropic':
            return withProviderId(
                anthropicProvider('https://api.minimax.io/anthropic', apiKey, options?.headers),
                'minimax-anthropic'
            )
        case 'minimax':
        case 'minimaxai':
        case 'minimax-ai':
            if (options?.baseURL || options?.headers) {
                return withProviderId(
                    openaiProvider(
                        options?.baseURL || 'https://api.minimax.io/v1',
                        apiKey,
                        options?.headers
                    ),
                    'minimax'
                )
            }
            return withProviderId(openaiProvider('https://api.minimax.io/v1', apiKey), 'minimax')
        case 'arcee':
        case 'arceeai':
        case 'arcee-ai':
            return withProviderId(openaiProvider('https://api.arcee.ai/api/v1', apiKey), 'arcee')
        case 'meta':
        case 'metaai':
        case 'meta-ai':
            return withProviderId(openaiProvider('https://api.meta.ai/v1', apiKey), 'meta')
        case 'sakana':
        case 'sakanaai':
        case 'sakana-ai':
            return withProviderId(openaiProvider('https://api.sakana.ai/v1', apiKey), 'sakana')
        case 'sarvam':
        case 'sarvamai':
        case 'sarvam-ai':
            return withProviderId(openaiProvider('https://api.sarvam.ai/v1', apiKey), 'sarvam')
        case 'stepfun':
        case 'stepfunai':
        case 'stepfun-ai':
            return withProviderId(openaiProvider('https://api.stepfun.ai/v1', apiKey), 'stepfun')
        case 'upstage':
        case 'upstageai':
        case 'solar':
            return withProviderId(
                openaiProvider('https://api.upstage.ai/v1/solar', apiKey),
                'upstage'
            )
        case 'abliteration':
        case 'abliterationai':
        case 'abliteration-ai':
            if (options?.baseURL || options?.headers) {
                return withProviderId(
                    openaiProvider(
                        options?.baseURL || 'https://api.abliteration.ai/v1',
                        apiKey,
                        options?.headers
                    ),
                    'abliteration'
                )
            }
            return withProviderId(
                openaiProvider('https://api.abliteration.ai/v1', apiKey),
                'abliteration'
            )
        case 'agnes':
        case 'agnesai':
        case 'agnes-ai':
            if (options?.baseURL || options?.headers) {
                return withProviderId(
                    openaiProvider(
                        options?.baseURL || 'https://apihub.agnes-ai.com/v1',
                        apiKey,
                        options?.headers
                    ),
                    'agnes'
                )
            }
            return withProviderId(openaiProvider('https://apihub.agnes-ai.com/v1', apiKey), 'agnes')

        case 'aiand':
            if (options?.baseURL || options?.headers) {
                return withProviderId(
                    openaiProvider(
                        options?.baseURL || 'https://api.aiand.com/v1',
                        apiKey,
                        options?.headers
                    ),
                    'aiand'
                )
            }
            return withProviderId(openaiProvider('https://api.aiand.com/v1', apiKey), 'aiand')
        case 'aki':
        case 'aki-io':
        case 'akiio':
            if (options?.baseURL || options?.headers) {
                return withProviderId(
                    openaiProvider(
                        options?.baseURL || 'https://aki.io/v1',
                        apiKey,
                        options?.headers
                    ),
                    'aki'
                )
            }
            return withProviderId(openaiProvider('https://aki.io/v1', apiKey), 'aki')
        case 'ambient':
            if (options?.baseURL || options?.headers) {
                return withProviderId(
                    openaiProvider(
                        options?.baseURL || 'https://api.ambient.xyz/v1',
                        apiKey,
                        options?.headers
                    ),
                    'ambient'
                )
            }
            return withProviderId(openaiProvider('https://api.ambient.xyz/v1', apiKey), 'ambient')
        case 'auriko':
        case 'aurikoai':
        case 'auriko-ai':
            if (options?.baseURL || options?.headers) {
                return withProviderId(
                    openaiProvider(
                        options?.baseURL || 'https://api.auriko.ai/v1',
                        apiKey,
                        options?.headers
                    ),
                    'auriko'
                )
            }
            return withProviderId(openaiProvider('https://api.auriko.ai/v1', apiKey), 'auriko')
        case 'baseten':
        case 'basetenco':
        case 'baseten-co':
            if (options?.baseURL || options?.headers) {
                return withProviderId(
                    openaiProvider(
                        options?.baseURL || 'https://inference.baseten.co/v1',
                        apiKey,
                        options?.headers
                    ),
                    'baseten'
                )
            }
            return withProviderId(
                openaiProvider('https://inference.baseten.co/v1', apiKey),
                'baseten'
            )
        case 'abacus':
            return withProviderId(
                openaiProvider('https://routellm.abacus.ai/v1', apiKey, options?.headers),
                'abacus'
            )
        case 'above':
            return withProviderId(
                openaiProvider('https://api.above.dev/v1', apiKey, options?.headers),
                'above'
            )
        case 'ai21':
            return withProviderId(
                openaiProvider('https://api.ai21.com/studio/v1', apiKey, options?.headers),
                'ai21'
            )
        case 'amd':
            return withProviderId(
                openaiProvider(
                    'https://developer.amd.com.cn/radeon/api/v1',
                    apiKey,
                    options?.headers
                ),
                'amd'
            )
        case 'anyapi':
            return withProviderId(
                openaiProvider('https://api.anyapi.ai/v1', apiKey, options?.headers),
                'anyapi'
            )
        case 'berget':
            return withProviderId(
                openaiProvider('https://api.berget.ai/v1', apiKey, options?.headers),
                'berget'
            )
        case 'blueclaw':
            return withProviderId(
                openaiProvider('https://openai.blueclaw.network/v1', apiKey, options?.headers),
                'blueclaw'
            )
        case 'chutes':
            return withProviderId(
                openaiProvider('https://llm.chutes.ai/v1', apiKey, options?.headers),
                'chutes'
            )
        case 'clarifai':
            return withProviderId(
                openaiProvider(
                    'https://api.clarifai.com/v2/ext/openai/v1',
                    apiKey,
                    options?.headers
                ),
                'clarifai'
            )
        case 'cloudferro-sherlock':
            return withProviderId(
                openaiProvider(
                    'https://api-sherlock.cloudferro.com/openai/v1/',
                    apiKey,
                    options?.headers
                ),
                'cloudferro-sherlock'
            )
        case 'cloudflare-ai-gateway':
            return withProviderId(
                openaiProvider('https://gateway.ai.cloudflare.com/v1', apiKey, options?.headers),
                'cloudflare-ai-gateway'
            )
        case 'coralbricks':
            return withProviderId(
                openaiProvider('https://inference.coralbricks.ai/v1', apiKey, options?.headers),
                'coralbricks'
            )
        case 'cortecs':
            return withProviderId(
                openaiProvider('https://api.cortecs.ai/v1', apiKey, options?.headers),
                'cortecs'
            )
        case 'crusoe':
            return withProviderId(
                openaiProvider(
                    'https://api.inference.crusoecloud.com/v1',
                    apiKey,
                    options?.headers
                ),
                'crusoe'
            )
        case 'deepinfra':
            return withProviderId(
                openaiProvider('https://api.deepinfra.com/v1/openai', apiKey, options?.headers),
                'deepinfra'
            )
        case 'digitalocean':
            return withProviderId(
                openaiProvider('https://inference.do-ai.run/v1', apiKey, options?.headers),
                'digitalocean'
            )
        case 'dinference':
            return withProviderId(
                openaiProvider('https://api.dinference.com/v1', apiKey, options?.headers),
                'dinference'
            )
        case 'drun':
            return withProviderId(
                openaiProvider('https://chat.d.run/v1', apiKey, options?.headers),
                'drun'
            )
        case 'edenai':
            return withProviderId(
                openaiProvider('https://api.edenai.run/v3', apiKey, options?.headers),
                'edenai'
            )
        case 'empiriolabs':
            return withProviderId(
                openaiProvider('https://api.empiriolabs.ai/v1', apiKey, options?.headers),
                'empiriolabs'
            )
        case 'evroc':
            return withProviderId(
                openaiProvider('https://models.think.evroc.com/v1', apiKey, options?.headers),
                'evroc'
            )
        case 'fastrouter':
            return withProviderId(
                openaiProvider('https://go.fastrouter.ai/api/v1', apiKey, options?.headers),
                'fastrouter'
            )
        case 'friendli':
            return withProviderId(
                openaiProvider('https://api.friendli.ai/serverless/v1', apiKey, options?.headers),
                'friendli'
            )
        case 'helicone':
            return withProviderId(
                openaiProvider('https://ai-gateway.helicone.ai/v1', apiKey, options?.headers),
                'helicone'
            )
        case 'hetzner':
            return withProviderId(
                openaiProvider('https://inference.hetzner.com/api/v1', apiKey, options?.headers),
                'hetzner'
            )
        case 'hpc-ai':
            return withProviderId(
                openaiProvider('https://api.hpc-ai.com/inference/v1', apiKey, options?.headers),
                'hpc-ai'
            )
        case 'hyper':
            return withProviderId(
                openaiProvider('https://hyper.charm.land/v1', apiKey, options?.headers),
                'hyper'
            )
        case 'inception':
            return withProviderId(
                openaiProvider('https://api.inceptionlabs.ai/v1/', apiKey, options?.headers),
                'inception'
            )
        case 'inco':
            return withProviderId(
                openaiProvider('https://api.inco.ai/v1', apiKey, options?.headers),
                'inco'
            )
        case 'io-net':
            return withProviderId(
                openaiProvider(
                    'https://api.intelligence.io.solutions/api/v1',
                    apiKey,
                    options?.headers
                ),
                'io-net'
            )
        case 'iteracompute':
            return withProviderId(
                openaiProvider('https://api.iteracompute.com/v1', apiKey, options?.headers),
                'iteracompute'
            )
        case 'kilo':
            return withProviderId(
                openaiProvider('https://api.kilo.ai/api/gateway', apiKey, options?.headers),
                'kilo'
            )
        case 'kimi-code-plan-cn':
            return withProviderId(
                openaiProvider('https://api.kimi.com/coding/v1', apiKey, options?.headers),
                'kimi-code-plan-cn'
            )
        case 'kimi-code-plan-global':
            return withProviderId(
                openaiProvider('https://api.kimi.ai/coding/v1', apiKey, options?.headers),
                'kimi-code-plan-global'
            )
        case 'kosmik':
            return withProviderId(
                openaiProvider('https://api.koscompute.com/v1', apiKey, options?.headers),
                'kosmik'
            )
        case 'llmgateway':
            return withProviderId(
                openaiProvider('https://api.llmgateway.io/v1', apiKey, options?.headers),
                'llmgateway'
            )
        case 'merge-gateway':
            return withProviderId(
                openaiProvider('https://api-gateway.merge.dev/v1/ai-sdk', apiKey, options?.headers),
                'merge-gateway'
            )
        case 'modal':
            return withProviderId(
                openaiProvider(
                    'https://inference.us-west.modal.direct/v1',
                    apiKey,
                    options?.headers
                ),
                'modal'
            )
        case 'modelscope':
            return withProviderId(
                openaiProvider('https://api-inference.modelscope.cn/v1', apiKey, options?.headers),
                'modelscope'
            )
        case 'morph':
            return withProviderId(
                openaiProvider('https://api.morphllm.com/v1', apiKey, options?.headers),
                'morph'
            )
        case 'nano-gpt':
            return withProviderId(
                openaiProvider('https://nano-gpt.com/api/v1', apiKey, options?.headers),
                'nano-gpt'
            )
        case 'nearai':
            return withProviderId(
                openaiProvider('https://cloud-api.near.ai/v1', apiKey, options?.headers),
                'nearai'
            )
        case 'nebius':
            return withProviderId(
                openaiProvider('https://api.tokenfactory.nebius.com/v1', apiKey, options?.headers),
                'nebius'
            )
        case 'novita-ai':
            return withProviderId(
                openaiProvider('https://api.novita.ai/openai', apiKey, options?.headers),
                'novita-ai'
            )
        case 'opencode':
            return withProviderId(
                openaiProvider('https://opencode.ai/zen/v1', apiKey, options?.headers),
                'opencode'
            )
        case 'opencode-go':
            return withProviderId(
                openaiProvider('https://opencode.ai/zen/go/v1', apiKey, options?.headers),
                'opencode-go'
            )
        case 'openreason':
            return withProviderId(
                openaiProvider('https://api.openreason.app/v1', apiKey, options?.headers),
                'openreason'
            )
        case 'opper':
            return withProviderId(
                openaiProvider('https://api.opper.ai/v3/compat', apiKey, options?.headers),
                'opper'
            )
        case 'orcarouter':
            return withProviderId(
                openaiProvider('https://api.orcarouter.ai/v1', apiKey, options?.headers),
                'orcarouter'
            )
        case 'ovhcloud':
            return withProviderId(
                openaiProvider(
                    'https://oai.endpoints.kepler.ai.cloud.ovh.net/v1',
                    apiKey,
                    options?.headers
                ),
                'ovhcloud'
            )
        case 'pendra':
            return withProviderId(
                openaiProvider('https://api.pendra.ai/api/v1', apiKey, options?.headers),
                'pendra'
            )
        case 'perplexity-agent':
            return withProviderId(
                openaiProvider('https://api.perplexity.ai/v1', apiKey, options?.headers),
                'perplexity-agent'
            )
        case 'poe':
            return withProviderId(
                openaiProvider('https://api.poe.com/v1', apiKey, options?.headers),
                'poe'
            )
        case 'qiniu-ai':
            return withProviderId(
                openaiProvider('https://api.qnaigc.com/v1', apiKey, options?.headers),
                'qiniu-ai'
            )
        case 'regolo-ai':
            return withProviderId(
                openaiProvider('https://api.regolo.ai/v1', apiKey, options?.headers),
                'regolo-ai'
            )
        case 'requesty':
            return withProviderId(
                openaiProvider('https://router.requesty.ai/v1', apiKey, options?.headers),
                'requesty'
            )
        case 'runinfra':
            return withProviderId(
                openaiProvider('https://api.runinfra.ai/v1', apiKey, options?.headers),
                'runinfra'
            )
        case 'salad-cloud':
            return withProviderId(
                openaiProvider('https://matrix.salad.com/api/v1', apiKey, options?.headers),
                'salad-cloud'
            )
        case 'scaleway':
            return withProviderId(
                openaiProvider('https://api.scaleway.ai/v1', apiKey, options?.headers),
                'scaleway'
            )
        case 'stackit':
            return withProviderId(
                openaiProvider(
                    'https://api.openai-compat.model-serving.eu01.onstackit.cloud/v1',
                    apiKey,
                    options?.headers
                ),
                'stackit'
            )
        case 'standardcompute':
            return withProviderId(
                openaiProvider('https://api.stdcmpt.com/v1', apiKey, options?.headers),
                'standardcompute'
            )
        case 'subconscious':
            return withProviderId(
                anthropicProvider('https://api.subconscious.dev/v1', apiKey, options?.headers),
                'subconscious'
            )
        case 'synthetic':
            return withProviderId(
                openaiProvider('https://api.synthetic.new/openai/v1', apiKey, options?.headers),
                'synthetic'
            )
        case 'tencent-tokenhub':
            return withProviderId(
                openaiProvider('https://tokenhub.tencentmaas.com/v1', apiKey, options?.headers),
                'tencent-tokenhub'
            )
        case 'the-grid-ai':
            return withProviderId(
                openaiProvider('https://api.thegrid.ai/v1', apiKey, options?.headers),
                'the-grid-ai'
            )
        case 'tinfoil':
            return withProviderId(
                openaiProvider('https://inference.tinfoil.sh/v1', apiKey, options?.headers),
                'tinfoil'
            )
        case 'venice':
            return withProviderId(
                openaiProvider('https://api.venice.ai/api/v1', apiKey, options?.headers),
                'venice'
            )
        case 'vercel':
            return withProviderId(
                openaiProvider('https://ai-gateway.vercel.sh/v1', apiKey, options?.headers),
                'vercel'
            )
        case 'vivgrid':
            return withProviderId(
                openaiProvider('https://api.vivgrid.com/v1', apiKey, options?.headers),
                'vivgrid'
            )
        case 'volcengine':
            return withProviderId(
                openaiProvider(
                    'https://ark.cn-beijing.volces.com/api/v3',
                    apiKey,
                    options?.headers
                ),
                'volcengine'
            )
        case 'vultr':
            return withProviderId(
                openaiProvider('https://api.vultrinference.com/v1', apiKey, options?.headers),
                'vultr'
            )
        case 'wafer.ai':
            return withProviderId(
                openaiProvider('https://pass.wafer.ai/v1', apiKey, options?.headers),
                'wafer.ai'
            )
        case 'watsonx':
            return withProviderId(
                openaiProvider('https://us-south.ml.cloud.ibm.com/v1', apiKey, options?.headers),
                'watsonx'
            )
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
        case 'dashscope-intl':
        case 'alibaba':
            return withProviderId(
                openaiProvider(
                    'https://dashscope-intl.aliyuncs.com/compatible-mode/v1',
                    apiKey,
                    options?.headers
                ),
                'dashscope-intl'
            )
        case 'dashscope':
        case 'dashscope-cn':
        case 'alibaba-cn':
        case 'qwen':
            return withProviderId(
                openaiProvider(
                    'https://dashscope.aliyuncs.com/compatible-mode/v1',
                    apiKey,
                    options?.headers
                ),
                'dashscope'
            )
        default: {
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
