export interface ModelRate {
    name: string
    inputRate: number // USD per 1M tokens
    outputRate: number // USD per 1M tokens
}

export const OFFICIAL_MODEL_RATES: Record<string, ModelRate> = {
    // Google Gemini
    'gemini-3.7-flash': { name: 'gemini-3.7-flash', inputRate: 0.1, outputRate: 0.4 },
    'gemini-3.6-flash': { name: 'gemini-3.6-flash', inputRate: 0.1, outputRate: 0.4 },
    'gemini-3.5-flash': { name: 'gemini-3.5-flash', inputRate: 0.1, outputRate: 0.4 },
    'gemini-3.5-flash-lite': { name: 'gemini-3.5-flash-lite', inputRate: 0.05, outputRate: 0.2 },
    'gemini-2.5-flash': { name: 'gemini-2.5-flash', inputRate: 0.075, outputRate: 0.3 },
    'gemini-2.5-pro': { name: 'gemini-2.5-pro', inputRate: 1.25, outputRate: 5.0 },
    'gemini-3-pro-preview': { name: 'gemini-3-pro-preview', inputRate: 1.25, outputRate: 5.0 },
    'gemini-3.1-pro': { name: 'gemini-3.1-pro', inputRate: 1.25, outputRate: 5.0 },

    // Anthropic Claude
    'claude-3-7-sonnet': { name: 'claude-3-7-sonnet', inputRate: 3.0, outputRate: 15.0 },
    'claude-3-7-sonnet-latest': {
        name: 'claude-3-7-sonnet-latest',
        inputRate: 3.0,
        outputRate: 15.0,
    },
    'claude-3-5-sonnet': { name: 'claude-3-5-sonnet', inputRate: 3.0, outputRate: 15.0 },
    'claude-3-5-sonnet-latest': {
        name: 'claude-3-5-sonnet-latest',
        inputRate: 3.0,
        outputRate: 15.0,
    },
    'claude-3-5-haiku': { name: 'claude-3-5-haiku', inputRate: 0.8, outputRate: 4.0 },
    'claude-3-5-haiku-latest': {
        name: 'claude-3-5-haiku-latest',
        inputRate: 0.8,
        outputRate: 4.0,
    },
    'claude-3-opus': { name: 'claude-3-opus', inputRate: 15.0, outputRate: 75.0 },
    'claude-3-opus-latest': { name: 'claude-3-opus-latest', inputRate: 15.0, outputRate: 75.0 },

    // OpenAI
    'gpt-4o': { name: 'gpt-4o', inputRate: 2.5, outputRate: 10.0 },
    'gpt-4o-mini': { name: 'gpt-4o-mini', inputRate: 0.15, outputRate: 0.6 },
    'gpt-4.5-preview': { name: 'gpt-4.5-preview', inputRate: 75.0, outputRate: 150.0 },
    'o3-mini': { name: 'o3-mini', inputRate: 1.1, outputRate: 4.4 },
    o1: { name: 'o1', inputRate: 15.0, outputRate: 60.0 },
    'o1-mini': { name: 'o1-mini', inputRate: 1.1, outputRate: 4.4 },

    // DeepSeek
    'deepseek-chat': { name: 'deepseek-chat', inputRate: 0.14, outputRate: 0.28 },
    'deepseek-v3': { name: 'deepseek-v3', inputRate: 0.14, outputRate: 0.28 },
    'deepseek-reasoner': { name: 'deepseek-reasoner', inputRate: 0.55, outputRate: 2.19 },
    'deepseek-r1': { name: 'deepseek-r1', inputRate: 0.55, outputRate: 2.19 },

    // Meta (Muse Spark)
    'muse-spark-1.3': { name: 'muse-spark-1.3', inputRate: 1.25, outputRate: 4.25 },
    'muse-spark-1.3-contributor': {
        name: 'muse-spark-1.3-contributor',
        inputRate: 0.1,
        outputRate: 0.2,
    },
    'muse-spark-1.2': { name: 'muse-spark-1.2', inputRate: 1.25, outputRate: 4.25 },
    'muse-spark-1.2-contributor': {
        name: 'muse-spark-1.2-contributor',
        inputRate: 0.1,
        outputRate: 0.2,
    },
    'muse-spark-1.1': { name: 'muse-spark-1.1', inputRate: 1.25, outputRate: 4.25 },

    // MiniMax
    'minimax-m3': { name: 'minimax-m3', inputRate: 0.3, outputRate: 1.2 },
    'minimax-m2.7': { name: 'minimax-m2.7', inputRate: 0.3, outputRate: 1.2 },
    'minimax-m2.7-highspeed': { name: 'minimax-m2.7-highspeed', inputRate: 0.6, outputRate: 2.4 },
    'minimax-m2.5': { name: 'minimax-m2.5', inputRate: 0.3, outputRate: 1.2 },
    'minimax-m2.5-highspeed': { name: 'minimax-m2.5-highspeed', inputRate: 0.6, outputRate: 2.4 },
    'minimax-m2.1': { name: 'minimax-m2.1', inputRate: 0.3, outputRate: 1.2 },
    'minimax-m2.1-highspeed': { name: 'minimax-m2.1-highspeed', inputRate: 0.6, outputRate: 2.4 },
    'minimax-m2': { name: 'minimax-m2', inputRate: 0.3, outputRate: 1.2 },
    'minimax-text-01': { name: 'minimax-text-01', inputRate: 0.15, outputRate: 1.2 },
    'minimax-vl-01': { name: 'minimax-vl-01', inputRate: 0.15, outputRate: 1.2 },

    // Moonshot AI / Kimi
    'kimi-k3': { name: 'kimi-k3', inputRate: 3.0, outputRate: 15.0 },
    'moonshotai/kimi-k3': { name: 'moonshotai/kimi-k3', inputRate: 3.0, outputRate: 15.0 },
    'kimi-k2.7-code': { name: 'kimi-k2.7-code', inputRate: 0.95, outputRate: 4.0 },
    'kimi-k2.7-code-highspeed': {
        name: 'kimi-k2.7-code-highspeed',
        inputRate: 1.9,
        outputRate: 8.0,
    },
    'kimi-k2.6': { name: 'kimi-k2.6', inputRate: 0.95, outputRate: 4.0 },
    'kimi-k2.5': { name: 'kimi-k2.5', inputRate: 0.95, outputRate: 4.0 },

    // Mistral AI
    'mistral-large-latest': { name: 'mistral-large-latest', inputRate: 0.5, outputRate: 1.5 },
    'mistral-large-2512': { name: 'mistral-large-2512', inputRate: 0.5, outputRate: 1.5 },
    'mistral-medium-latest': { name: 'mistral-medium-latest', inputRate: 1.5, outputRate: 7.5 },
    'mistral-medium-2604': { name: 'mistral-medium-2604', inputRate: 1.5, outputRate: 7.5 },
    'mistral-small-latest': { name: 'mistral-small-latest', inputRate: 0.15, outputRate: 0.6 },
    'mistral-small-2603': { name: 'mistral-small-2603', inputRate: 0.15, outputRate: 0.6 },
    'codestral-latest': { name: 'codestral-latest', inputRate: 0.3, outputRate: 0.9 },
    'codestral-2501': { name: 'codestral-2501', inputRate: 0.3, outputRate: 0.9 },
    'devstral-2512': { name: 'devstral-2512', inputRate: 0.4, outputRate: 2.0 },
    'devstral-latest': { name: 'devstral-latest', inputRate: 0.4, outputRate: 2.0 },
    'magistral-medium-latest': {
        name: 'magistral-medium-latest',
        inputRate: 2.0,
        outputRate: 5.0,
    },
    'magistral-small': { name: 'magistral-small', inputRate: 0.5, outputRate: 1.5 },
    'ministral-8b-latest': { name: 'ministral-8b-latest', inputRate: 0.1, outputRate: 0.1 },
    'ministral-3b-latest': { name: 'ministral-3b-latest', inputRate: 0.04, outputRate: 0.04 },
    'mistral-nemo': { name: 'mistral-nemo', inputRate: 0.15, outputRate: 0.15 },

    // Sarvam AI
    'sarvam-105b': { name: 'sarvam-105b', inputRate: 0.75, outputRate: 3.0 },
    'sarvam-30b': { name: 'sarvam-30b', inputRate: 0.25, outputRate: 1.0 },

    // StepFun
    'step-3.7-flash': { name: 'step-3.7-flash', inputRate: 0.1, outputRate: 0.4 },
    'step-3.5-flash': { name: 'step-3.5-flash', inputRate: 0.1, outputRate: 0.4 },
    'step-1-32k': { name: 'step-1-32k', inputRate: 0.2, outputRate: 0.8 },

    // Ollama / Local
    ollama: { name: 'ollama', inputRate: 0.0, outputRate: 0.0 },
}

export function resolveModelRate(
    modelName: string,
    customCache?: Map<string, ModelRate>
): ModelRate {
    const normalized = (modelName || '').trim().toLowerCase()
    const stripped = normalized.includes('/') ? normalized.split('/').pop()! : normalized

    if (customCache) {
        if (customCache.has(normalized)) return customCache.get(normalized)!
        if (customCache.has(stripped)) return customCache.get(stripped)!
    }

    if (OFFICIAL_MODEL_RATES[normalized]) return OFFICIAL_MODEL_RATES[normalized]
    if (OFFICIAL_MODEL_RATES[stripped]) return OFFICIAL_MODEL_RATES[stripped]

    if (normalized.includes('ollama') || stripped.includes('llama') || stripped.includes('qwen')) {
        return { name: modelName, inputRate: 0.0, outputRate: 0.0 }
    }

    const fallbackInput = parseFloat(process.env.FALLBACK_MODEL_INPUT_RATE ?? '2.00')
    const fallbackOutput = parseFloat(process.env.FALLBACK_MODEL_OUTPUT_RATE ?? '8.00')

    return {
        name: modelName,
        inputRate: isNaN(fallbackInput) ? 2.0 : fallbackInput,
        outputRate: isNaN(fallbackOutput) ? 8.0 : fallbackOutput,
    }
}

export function calculateGenerationCost(data: {
    modelName: string
    inputTokens: number
    outputTokens: number
    customCache?: Map<string, ModelRate>
}): number {
    const { modelName, inputTokens, outputTokens, customCache } = data
    if (inputTokens === 0 && outputTokens === 0) {
        return 0
    }

    let targetModel = modelName
    if (targetModel === 'auto') {
        targetModel = (
            process.env.DEFAULT_MODEL ||
            process.env.AUTO_MODEL ||
            'openai/gpt-oss-20b:free'
        ).trim()
    }

    const rate = resolveModelRate(targetModel, customCache)

    // convert usd per 1m tokens to cents per token:
    // cents/token = (usd/1m * 100) / 1,000,000 = usd/1m / 10,000
    const inputCentsPerToken = rate.inputRate / 10000
    const outputCentsPerToken = rate.outputRate / 10000

    const rawCost = inputTokens * inputCentsPerToken + outputTokens * outputCentsPerToken

    if (rawCost <= 0) {
        return 0
    }

    // Exact sub-cent precision rounded to 6 decimal places (micro-cent resolution)
    return Math.round(rawCost * 1_000_000) / 1_000_000
}

export function startOfUtcMonth(date: Date = new Date()): Date {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1))
}

export function startOfNextUtcMonth(date: Date = new Date()): Date {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1))
}

export const PROVIDER_BILLING_LINKS: Record<string, string> = {
    december: 'https://trydecember.com/settings/billing',
    december_proxy: 'https://trydecember.com/settings/billing',
    google: 'https://aistudio.google.com/app/usage',
    gemini: 'https://aistudio.google.com/app/usage',
    anthropic: 'https://console.anthropic.com/settings/billing',
    openai: 'https://platform.openai.com/usage',
    openrouter: 'https://openrouter.ai/settings/credits',
    deepseek: 'https://platform.deepseek.com/usage',
    groq: 'https://console.groq.com/usage',
    mistral: 'https://console.mistral.ai/billing/',
    mistralai: 'https://console.mistral.ai/billing/',
    'mistral-ai': 'https://console.mistral.ai/billing/',
    moonshot: 'https://platform.moonshot.ai/console/api-keys',
    moonshotai: 'https://platform.moonshot.ai/console/api-keys',
    'moonshot-ai': 'https://platform.moonshot.ai/console/api-keys',
    moonshoot: 'https://platform.moonshot.ai/console/api-keys',
    kimi: 'https://platform.moonshot.ai/console/api-keys',
    xai: 'https://console.x.ai/',
    zai: 'https://open.bigmodel.cn/usercenter/apikeys',
    nvidia: 'https://build.nvidia.com/',
    sambanova: 'https://cloud.sambanova.ai/',
    cerebras: 'https://cloud.cerebras.ai/',
    siliconflow: 'https://cloud.siliconflow.cn/account/ak',
    together: 'https://api.together.ai/settings/billing',
    hyperbolic: 'https://app.hyperbolic.ai/settings',
    fireworks: 'https://app.fireworks.ai/settings/billing',
    perplexity: 'https://www.perplexity.ai/settings/api',
    cohere: 'https://dashboard.cohere.com/billing',
    huggingface: 'https://huggingface.co/settings/billing',
    agentrouter: 'https://agentrouter.org/console/token',
    arcee: 'https://platform.arcee.ai/api/api-keys',
    arceeai: 'https://platform.arcee.ai/api/api-keys',
    'arcee-ai': 'https://platform.arcee.ai/api/api-keys',
    meta: 'https://dev.meta.ai/',
    metaai: 'https://dev.meta.ai/',
    'meta-ai': 'https://dev.meta.ai/',
    minimax: 'https://platform.minimax.io/console/access',
    minimaxai: 'https://platform.minimax.io/console/access',
    'minimax-ai': 'https://platform.minimax.io/console/access',
    poolside: 'https://platform.poolside.ai/api-keys',
    sakana: 'https://console.sakana.ai/api-keys',
    ollama: 'http://localhost:11434',
}

export const PROVIDER_DISPLAY_NAMES: Record<string, string> = {
    december: 'December Wallet',
    december_proxy: 'December Wallet',
    google: 'Google AI Studio',
    gemini: 'Google AI Studio',
    anthropic: 'Anthropic Console',
    openai: 'OpenAI Platform',
    openrouter: 'OpenRouter',
    deepseek: 'DeepSeek Platform',
    groq: 'GroqCloud Console',
    mistral: 'Mistral Console',
    mistralai: 'Mistral Console',
    'mistral-ai': 'Mistral Console',
    moonshot: 'Moonshot AI Platform',
    moonshotai: 'Moonshot AI Platform',
    'moonshot-ai': 'Moonshot AI Platform',
    moonshoot: 'Moonshot AI Platform',
    kimi: 'Moonshot Kimi Console',
    xai: 'xAI Console',
    zai: 'ZAI Platform',
    nvidia: 'NVIDIA NIM Console',
    sambanova: 'SambaNova Cloud',
    cerebras: 'Cerebras Cloud',
    siliconflow: 'SiliconFlow Cloud',
    together: 'Together AI Console',
    hyperbolic: 'Hyperbolic Console',
    fireworks: 'Fireworks AI Console',
    perplexity: 'Perplexity Settings',
    cohere: 'Cohere Dashboard',
    huggingface: 'HuggingFace Settings',
    agentrouter: 'AgentRouter Token Console',
    arcee: 'Arcee AI',
    arceeai: 'Arcee AI',
    'arcee-ai': 'Arcee AI',
    meta: 'Meta',
    metaai: 'Meta',
    'meta-ai': 'Meta',
    minimax: 'MiniMax',
    minimaxai: 'MiniMax',
    'minimax-ai': 'MiniMax',
    poolside: 'Poolside',
    sakana: 'Sakana AI',
    ollama: 'Ollama (Local)',
}

export function formatInsufficientCreditsNotice(
    provider?: string,
    model?: string,
    rawErrorMsg?: string
): string {
    const rawLower = (rawErrorMsg || '').toLowerCase()
    let normalized = (provider || '').toLowerCase().trim()

    // Infer provider from model name if provider is generic (e.g. 'openai') or empty
    if (!normalized || normalized === 'openai') {
        const modelLower = (model || '').toLowerCase()
        if (
            modelLower.includes('trinity') ||
            modelLower.includes('inkling') ||
            modelLower.includes('arcee')
        ) {
            normalized = 'arcee'
        } else if (modelLower.includes('muse')) {
            normalized = 'meta'
        } else if (modelLower.includes('minimax')) {
            normalized = 'minimax'
        } else if (modelLower.includes('laguna')) {
            normalized = 'poolside'
        } else if (
            modelLower.includes('fugu') ||
            modelLower.includes('namazu') ||
            modelLower.includes('sakana')
        ) {
            normalized = 'sakana'
        } else if (modelLower.includes('deepseek')) {
            normalized = 'deepseek'
        } else if (modelLower.includes('kimi') || modelLower.includes('moonshot')) {
            normalized = 'moonshot'
        } else if (
            modelLower.includes('mistral') ||
            modelLower.includes('codestral') ||
            modelLower.includes('magistral') ||
            modelLower.includes('ministral') ||
            modelLower.includes('devstral')
        ) {
            normalized = 'mistral'
        } else if (modelLower.includes('grok')) {
            normalized = 'xai'
        } else if (modelLower.includes('glm')) {
            normalized = 'zai'
        }
    }

    // Explicit December Wallet check or default december provider
    const isDecember =
        normalized === 'december' ||
        normalized === 'december_proxy' ||
        rawLower.includes('december wallet') ||
        rawLower.includes('trydecember.com')

    if (isDecember || (!normalized && !model)) {
        return 'Insufficient credits in December Wallet. Please add credits at https://trydecember.com/settings/billing or configure Bring Your Own Key (BYOK) via `/login` to continue using December.'
    }

    if (normalized === 'arcee' || normalized === 'arceeai' || normalized === 'arcee-ai') {
        return 'Insufficient credits in your Arcee AI account. Please add credits or top up your balance at https://platform.arcee.ai/api/api-keys'
    }

    if (normalized === 'meta' || normalized === 'metaai' || normalized === 'meta-ai') {
        return 'Insufficient credits in your Meta account. Please add credits or top up your balance at https://dev.meta.ai/'
    }

    if (normalized === 'minimax' || normalized === 'minimaxai' || normalized === 'minimax-ai') {
        return 'Insufficient credits in your MiniMax account. Please add credits or top up your balance at https://platform.minimax.io/console/access'
    }

    const displayName = PROVIDER_DISPLAY_NAMES[normalized] || normalized.toUpperCase()
    const billingLink = PROVIDER_BILLING_LINKS[normalized]

    if (billingLink) {
        return `Insufficient credits in your ${displayName} account. Please add credits or top up your balance at ${billingLink}`
    }

    return `Insufficient credits in your ${displayName} account. Please add credits or check your account billing status with your provider.`
}
