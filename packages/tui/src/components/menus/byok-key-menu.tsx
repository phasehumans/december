import { Box, Text } from 'ink'
import TextInput from 'ink-text-input'
import React from 'react'

import { THEME } from '../../theme'
import { Spinner } from '../spinner'

import { MenuFooter } from './menu-footer'

export const PROVIDER_NAMES: Record<string, string> = {
    agentrouter: 'AgentRouter',
    'agentrouter.org': 'AgentRouter',
    anthropic: 'Anthropic',
    arcee: 'Arcee AI',
    arceeai: 'Arcee AI',
    'arcee-ai': 'Arcee AI',
    cerebras: 'Cerebras',
    claude: 'Anthropic',
    codex: 'OpenAI',
    cohere: 'Cohere',
    dashscope: 'Qwen (DashScope)',
    december: 'December Cloud',
    december_proxy: 'December Cloud',
    deepseek: 'DeepSeek',
    fireworks: 'Fireworks AI',
    google: 'Google',
    gemini: 'Google AI Studio',
    groq: 'Groq',
    huggingface: 'Hugging Face',
    hyperbolic: 'Hyperbolic',
    kimi: 'Kimi',
    lmstudio: 'LM Studio',
    llamacpp: 'llama.cpp',
    meta: 'Meta',
    metaai: 'Meta',
    'meta-ai': 'Meta',
    minimax: 'MiniMax',
    minimaxai: 'MiniMax',
    'minimax-ai': 'MiniMax',
    mistral: 'Mistral',
    mistralai: 'Mistral',
    'mistral-ai': 'Mistral',
    moonshot: 'Moonshot AI',
    moonshoot: 'Moonshot AI',
    moonshotai: 'Moonshot AI',
    'moonshot-ai': 'Moonshot AI',
    nvidia: 'NVIDIA NIM',
    ollama: 'Ollama',
    openai: 'OpenAI',
    openrouter: 'OpenRouter',
    perplexity: 'Perplexity AI',
    poolside: 'Poolside',
    qwen: 'Qwen (DashScope)',
    sakana: 'Sakana AI',
    'sakana-ai': 'Sakana AI',
    sakanaai: 'Sakana AI',
    sarvam: 'Sarvam AI',
    sarvamai: 'Sarvam AI',
    'sarvam-ai': 'Sarvam AI',
    sambanova: 'SambaNova Cloud',
    siliconflow: 'SiliconFlow',
    together: 'Together AI',
    xAI: 'xAI',
    xai: 'xAI',
    zai: 'ZAI',
}

export const PROVIDER_KEY_URLS: Record<string, string> = {
    agentrouter: 'https://agentrouter.org/console/token',
    'agentrouter.org': 'https://agentrouter.org/console/token',
    anthropic: 'https://console.anthropic.com/settings/keys',
    arcee: 'https://platform.arcee.ai/api/api-keys',
    arceeai: 'https://platform.arcee.ai/api/api-keys',
    'arcee-ai': 'https://platform.arcee.ai/api/api-keys',
    cerebras: 'https://cloud.cerebras.ai/',
    claude: 'https://console.anthropic.com/settings/keys',
    codex: 'https://platform.openai.com/api-keys',
    cohere: 'https://dashboard.cohere.com/api-keys',
    dashscope: 'https://dashscope.console.aliyun.com/apiKey',
    deepseek: 'https://platform.deepseek.com/api_keys',
    fireworks: 'https://app.fireworks.ai/api-keys',
    google: 'https://aistudio.google.com/app/apikey',
    gemini: 'https://aistudio.google.com/app/apikey',
    groq: 'https://console.groq.com/keys',
    huggingface: 'https://huggingface.co/settings/tokens',
    hyperbolic: 'https://app.hyperbolic.ai/settings',
    kimi: 'https://platform.moonshot.ai/console/api-keys',
    lmstudio: 'https://lmstudio.ai/',
    llamacpp: 'https://github.com/ggerganov/llama.cpp',
    meta: 'https://dev.meta.ai/',
    metaai: 'https://dev.meta.ai/',
    'meta-ai': 'https://dev.meta.ai/',
    minimax: 'https://platform.minimax.io/console/access',
    minimaxai: 'https://platform.minimax.io/console/access',
    'minimax-ai': 'https://platform.minimax.io/console/access',
    mistral: 'https://console.mistral.ai/api-keys/',
    mistralai: 'https://console.mistral.ai/api-keys/',
    'mistral-ai': 'https://console.mistral.ai/api-keys/',
    moonshot: 'https://platform.moonshot.ai/console/api-keys',
    moonshoot: 'https://platform.moonshot.ai/console/api-keys',
    moonshotai: 'https://platform.moonshot.ai/console/api-keys',
    'moonshot-ai': 'https://platform.moonshot.ai/console/api-keys',
    nvidia: 'https://build.nvidia.com/',
    ollama: 'https://ollama.com/download',
    openai: 'https://platform.openai.com/api-keys',
    openrouter: 'https://openrouter.ai/settings/keys',
    perplexity: 'https://www.perplexity.ai/settings/api',
    poolside: 'https://platform.poolside.ai/api-keys',
    qwen: 'https://dashscope.console.aliyun.com/apiKey',
    sakana: 'https://console.sakana.ai/api-keys',
    'sakana-ai': 'https://console.sakana.ai/api-keys',
    sakanaai: 'https://console.sakana.ai/api-keys',
    sarvam: 'https://indus.sarvam.ai/',
    sarvamai: 'https://indus.sarvam.ai/',
    'sarvam-ai': 'https://indus.sarvam.ai/',
    sambanova: 'https://cloud.sambanova.ai/apis',
    siliconflow: 'https://cloud.siliconflow.cn/account/ak',
    siliconcloud: 'https://cloud.siliconflow.cn/account/ak',
    together: 'https://api.together.ai/settings/api-keys',
    togetherai: 'https://api.together.ai/settings/api-keys',
    xAI: 'https://console.x.ai/',
    xai: 'https://console.x.ai/',
    zai: 'https://open.bigmodel.cn/usercenter/apikeys',
}

export function formatProviderName(provider?: string): string {
    if (!provider) return 'Provider'
    return PROVIDER_NAMES[provider] || provider.charAt(0).toUpperCase() + provider.slice(1)
}

export function ByokKeyMenu(props: any) {
    const { selectedProvider, apiKey, setApiKey, handleKeySubmit, isStreaming, authError } = props
    const formattedProvider = formatProviderName(selectedProvider)
    const keyUrl = selectedProvider ? PROVIDER_KEY_URLS[selectedProvider] : undefined

    return (
        <Box flexDirection="column" paddingX={THEME.padding.paddingX}>
            <Box flexDirection="column" marginBottom={1}>
                <Text color={THEME.colors.text}>Enter API Key for {formattedProvider}:</Text>
                {keyUrl && (
                    <Text italic color={THEME.colors.muted}>
                        {"Don't have an API key? Get one at "}
                        <Text color={THEME.colors.brand}>{keyUrl}</Text>
                    </Text>
                )}
            </Box>
            <Box>
                <Text color={THEME.colors.brand} bold={false}>
                    {`${THEME.glyphs.prompt} `}
                </Text>
                <TextInput
                    focus={!isStreaming}
                    value={apiKey}
                    onChange={setApiKey}
                    onSubmit={handleKeySubmit}
                />
            </Box>
            {isStreaming ? (
                <Box marginTop={1}>
                    <Spinner label={`Verifying and saving API key for ${formattedProvider}...`} />
                </Box>
            ) : (
                <>
                    {authError && (
                        <Box marginTop={1}>
                            <Text color={THEME.colors.error}>{authError}</Text>
                        </Box>
                    )}
                    <MenuFooter
                        items={[
                            { key: 'enter', label: 'Submit' },
                            { key: 'esc', label: 'Cancel' },
                        ]}
                    />
                </>
            )}
        </Box>
    )
}
