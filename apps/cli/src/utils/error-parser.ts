import util from 'util'

import { inferProviderFromModel } from './usage-rates'

export interface ErrorParseContext {
    provider?: string
    model?: string
    baseURL?: string
}

export interface ProviderCreditRule {
    id: string
    name: string
    match: (combined: string) => boolean
    notice: string
    message: string
    hint: string
}

export function isCreditOrBalanceError(combined: string): boolean {
    return (
        combined.includes('insufficient balance') ||
        combined.includes('insufficient credits') ||
        combined.includes('insufficient_balance') ||
        combined.includes('insufficient_credits') ||
        combined.includes('insufficient_quota') ||
        combined.includes('balance is insufficient') ||
        combined.includes('balance insufficient') ||
        combined.includes('balance exhausted') ||
        combined.includes('out of credits') ||
        combined.includes('credit balance is too low') ||
        combined.includes('credits exhausted') ||
        combined.includes('requires more credits') ||
        combined.includes('can only afford') ||
        combined.includes('payment required') ||
        combined.includes('quota exceeded') ||
        combined.includes('quota_exhausted') ||
        combined.includes('402') ||
        combined.includes('1008') ||
        combined.includes('20009') ||
        ((combined.includes('credits') || combined.includes('balance')) &&
            (combined.includes('insufficient') ||
                combined.includes('exhausted') ||
                combined.includes('empty') ||
                combined.includes('zero') ||
                combined.includes('low') ||
                combined.includes('top up') ||
                combined.includes('recharge') ||
                combined.includes('afford') ||
                combined.includes('add credits')))
    )
}

export const PROVIDER_CREDIT_RULES: ProviderCreditRule[] = [
    {
        id: 'minimax',
        name: 'MiniMax',
        match: (str) =>
            str.includes('1008') ||
            ((str.includes('minimax') || str.includes('api.minimax.io')) &&
                isCreditOrBalanceError(str)),
        notice: 'Insufficient balance in your MiniMax account. Please top up your balance at https://platform.minimax.io/\n',
        message: 'Insufficient balance in your MiniMax account.',
        hint: 'Please top up your balance at https://platform.minimax.io/ or switch models using /model.',
    },
    {
        id: 'openrouter',
        name: 'OpenRouter',
        match: (str) =>
            (str.includes('openrouter') ||
                str.includes('requires more credits') ||
                str.includes('can only afford')) &&
            (str.includes('credits') || str.includes('afford') || str.includes('402')),
        notice: 'OpenRouter credits exhausted or insufficient. Please add credits at https://openrouter.ai/settings/credits\n',
        message: 'OpenRouter credits exhausted or insufficient.',
        hint: 'Please add credits at https://openrouter.ai/settings/credits',
    },
    {
        id: 'arcee',
        name: 'Arcee AI',
        match: (str) =>
            (str.includes('arcee') || str.includes('trinity')) &&
            (str.includes('credits') || str.includes('402') || isCreditOrBalanceError(str)),
        notice: 'Insufficient credits in your Arcee AI account. Please add credits or top up your balance at https://platform.arcee.ai/api/api-keys\n',
        message: 'Insufficient credits in your Arcee AI account.',
        hint: 'Please add credits or top up your balance at https://platform.arcee.ai/api/api-keys',
    },
    {
        id: 'meta',
        name: 'Meta',
        match: (str) =>
            (str.includes('meta') || str.includes('muse-spark') || str.includes('dev.meta.ai')) &&
            (str.includes('credits') || str.includes('402') || isCreditOrBalanceError(str)),
        notice: 'Insufficient credits in your Meta account. Please add credits or top up your balance at https://dev.meta.ai/\n',
        message: 'Insufficient credits in your Meta account.',
        hint: 'Please add credits or top up your balance at https://dev.meta.ai/',
    },
    {
        id: 'deepseek',
        name: 'DeepSeek',
        match: (str) =>
            (str.includes('deepseek') || str.includes('api.deepseek.com')) &&
            isCreditOrBalanceError(str),
        notice: 'Insufficient balance in your DeepSeek account. Please top up your balance at https://platform.deepseek.com/top_up\n',
        message: 'Insufficient balance in your DeepSeek account.',
        hint: 'Please top up your balance at https://platform.deepseek.com/top_up or switch models using /model.',
    },
    {
        id: 'siliconflow',
        name: 'SiliconFlow',
        match: (str) =>
            str.includes('20009') ||
            ((str.includes('siliconflow') ||
                str.includes('siliconcloud') ||
                str.includes('siliconflow.cn')) &&
                isCreditOrBalanceError(str)),
        notice: 'Insufficient balance in your SiliconFlow account. Please top up your balance at https://cloud.siliconflow.cn/\n',
        message: 'Insufficient balance in your SiliconFlow account.',
        hint: 'Please top up your balance at https://cloud.siliconflow.cn/ or switch models using /model.',
    },
    {
        id: 'moonshot',
        name: 'Moonshot AI',
        match: (str) =>
            (str.includes('moonshot') ||
                str.includes('kimi') ||
                str.includes('api.moonshot.cn') ||
                str.includes('api.kimi.com')) &&
            isCreditOrBalanceError(str),
        notice: 'Insufficient balance in your Moonshot AI account. Please top up your balance at https://platform.moonshot.cn/\n',
        message: 'Insufficient balance in your Moonshot AI account.',
        hint: 'Please top up your balance at https://platform.moonshot.cn/ or switch models using /model.',
    },
    {
        id: 'together',
        name: 'Together AI',
        match: (str) =>
            (str.includes('together') ||
                str.includes('together.xyz') ||
                str.includes('together.ai')) &&
            isCreditOrBalanceError(str),
        notice: 'Insufficient credits in your Together AI account. Please add credits at https://api.together.ai/settings/billing\n',
        message: 'Insufficient credits in your Together AI account.',
        hint: 'Please add credits at https://api.together.ai/settings/billing or switch models using /model.',
    },
    {
        id: 'fireworks',
        name: 'Fireworks AI',
        match: (str) =>
            (str.includes('fireworks') || str.includes('fireworks.ai')) &&
            isCreditOrBalanceError(str),
        notice: 'Insufficient credits in your Fireworks AI account. Please add credits at https://fireworks.ai/account/billing\n',
        message: 'Insufficient credits in your Fireworks AI account.',
        hint: 'Please add credits at https://fireworks.ai/account/billing or switch models using /model.',
    },
    {
        id: 'groq',
        name: 'Groq',
        match: (str) =>
            (str.includes('groq') || str.includes('api.groq.com')) && isCreditOrBalanceError(str),
        notice: 'Rate limit or quota exhausted in your Groq account. Please check your usage and limits at https://console.groq.com/settings/limits\n',
        message: 'Rate limit or quota exhausted in your Groq account.',
        hint: 'Please check your usage and limits at https://console.groq.com/settings/limits or switch models using /model.',
    },
    {
        id: 'mistral',
        name: 'Mistral AI',
        match: (str) =>
            (str.includes('mistral') || str.includes('api.mistral.ai')) &&
            isCreditOrBalanceError(str),
        notice: 'Insufficient credits or quota in your Mistral account. Please check your billing at https://console.mistral.ai/billing/\n',
        message: 'Insufficient credits or quota in your Mistral account.',
        hint: 'Please check your billing at https://console.mistral.ai/billing/ or switch models using /model.',
    },
    {
        id: 'cerebras',
        name: 'Cerebras',
        match: (str) =>
            (str.includes('cerebras') || str.includes('api.cerebras.ai')) &&
            isCreditOrBalanceError(str),
        notice: 'Rate limit or quota exhausted in your Cerebras account. Please check your account at https://cloud.cerebras.ai/\n',
        message: 'Rate limit or quota exhausted in your Cerebras account.',
        hint: 'Please check your account at https://cloud.cerebras.ai/ or switch models using /model.',
    },
    {
        id: 'sambanova',
        name: 'SambaNova',
        match: (str) =>
            (str.includes('sambanova') || str.includes('api.sambanova.ai')) &&
            isCreditOrBalanceError(str),
        notice: 'Rate limit or quota exhausted in your SambaNova account. Please check your account at https://cloud.sambanova.ai/\n',
        message: 'Rate limit or quota exhausted in your SambaNova account.',
        hint: 'Please check your account at https://cloud.sambanova.ai/ or switch models using /model.',
    },
    {
        id: 'hyperbolic',
        name: 'Hyperbolic',
        match: (str) =>
            (str.includes('hyperbolic') || str.includes('hyperbolic.xyz')) &&
            isCreditOrBalanceError(str),
        notice: 'Insufficient credits in your Hyperbolic account. Please add compute credits at https://app.hyperbolic.xyz/settings\n',
        message: 'Insufficient credits in your Hyperbolic account.',
        hint: 'Please add compute credits at https://app.hyperbolic.xyz/settings or switch models using /model.',
    },
    {
        id: 'perplexity',
        name: 'Perplexity',
        match: (str) =>
            (str.includes('perplexity') || str.includes('api.perplexity.ai')) &&
            isCreditOrBalanceError(str),
        notice: 'Insufficient credits or quota in your Perplexity account. Please check your billing at https://www.perplexity.ai/settings/api\n',
        message: 'Insufficient credits or quota in your Perplexity account.',
        hint: 'Please check your billing at https://www.perplexity.ai/settings/api or switch models using /model.',
    },
    {
        id: 'cohere',
        name: 'Cohere',
        match: (str) =>
            (str.includes('cohere') || str.includes('api.cohere.com')) &&
            isCreditOrBalanceError(str),
        notice: 'Rate limit or quota exhausted in your Cohere account. Please check your billing at https://dashboard.cohere.com/billing\n',
        message: 'Rate limit or quota exhausted in your Cohere account.',
        hint: 'Please check your billing at https://dashboard.cohere.com/billing or switch models using /model.',
    },
    {
        id: 'xai',
        name: 'xAI',
        match: (str) =>
            (str.includes('xai') || str.includes('api.x.ai')) && isCreditOrBalanceError(str),
        notice: 'Insufficient credits in your xAI account. Please check your billing at https://console.x.ai/\n',
        message: 'Insufficient credits in your xAI account.',
        hint: 'Please check your billing at https://console.x.ai/ or switch models using /model.',
    },
    {
        id: 'xiaomi',
        name: 'Xiaomi',
        match: (str) =>
            (str.includes('xiaomi') ||
                str.includes('mimo') ||
                str.includes('api.xiaomimimo.com') ||
                str.includes('xiaomimimo.com')) &&
            (isCreditOrBalanceError(str) || str.includes('credits') || str.includes('402')),
        notice: 'Insufficient balance in your Xiaomi account. Please check your account at https://platform.xiaomimimo.com/console/api-keys\n',
        message: 'Insufficient balance in your Xiaomi account.',
        hint: 'Please check your account at https://platform.xiaomimimo.com/console/api-keys or switch models using /model.',
    },
    {
        id: 'zai',
        name: 'Zhipu AI',
        match: (str) =>
            (str.includes('zai') ||
                str.includes('zhipu') ||
                str.includes('zhipuai') ||
                str.includes('bigmodel.cn') ||
                str.includes('z.ai')) &&
            isCreditOrBalanceError(str),
        notice: 'Insufficient balance in your Zhipu AI account. Please top up your balance at https://open.bigmodel.cn/\n',
        message: 'Insufficient balance in your Zhipu AI account.',
        hint: 'Please top up your balance at https://open.bigmodel.cn/ or switch models using /model.',
    },
    {
        id: 'poolside',
        name: 'Poolside',
        match: (str) =>
            (str.includes('poolside') || str.includes('inference.poolside.ai')) &&
            isCreditOrBalanceError(str),
        notice: 'Rate limit or quota exhausted in your Poolside account. Please check your account at https://platform.poolside.ai/api-keys\n',
        message: 'Rate limit or quota exhausted in your Poolside account.',
        hint: 'Please check your account at https://platform.poolside.ai/api-keys or switch models using /model.',
    },
    {
        id: 'sakana',
        name: 'Sakana AI',
        match: (str) =>
            (str.includes('sakana') || str.includes('api.sakana.ai') || str.includes('fugu')) &&
            isCreditOrBalanceError(str),
        notice: 'Rate limit or quota exhausted in your Sakana AI account. Please check your account at https://console.sakana.ai/api-keys\n',
        message: 'Rate limit or quota exhausted in your Sakana AI account.',
        hint: 'Please check your account at https://console.sakana.ai/api-keys or switch models using /model.',
    },
    {
        id: 'dashscope',
        name: 'Alibaba Cloud DashScope',
        match: (str) =>
            (str.includes('dashscope') ||
                str.includes('qwen') ||
                str.includes('aliyuncs.com') ||
                str.includes('allocationexceeded') ||
                str.includes('arrearage')) &&
            (isCreditOrBalanceError(str) ||
                str.includes('allocation') ||
                str.includes('arrearage')),
        notice: 'Insufficient balance or quota in your Alibaba Cloud DashScope account. Please check your balance at https://dashscope.console.aliyun.com/\n',
        message: 'Insufficient balance or quota in your Alibaba Cloud DashScope account.',
        hint: 'Please check your balance at https://dashscope.console.aliyun.com/ or switch models using /model.',
    },
    {
        id: 'anthropic',
        name: 'Anthropic',
        match: (str) =>
            (str.includes('anthropic') || str.includes('claude')) &&
            (isCreditOrBalanceError(str) || str.includes('credit balance is too low')),
        notice: 'Insufficient credits in your Anthropic account. Please add credits at https://console.anthropic.com/settings/billing\n',
        message: 'Insufficient credits in your Anthropic account.',
        hint: 'Please add credits at https://console.anthropic.com/settings/billing or switch models using /model.',
    },
    {
        id: 'openai',
        name: 'OpenAI',
        match: (str) =>
            str.includes('openai') &&
            (str.includes('insufficient_quota') ||
                str.includes('exceeded your current quota') ||
                isCreditOrBalanceError(str)),
        notice: 'OpenAI quota exhausted or insufficient balance. Please check your billing and credits at https://platform.openai.com/account/billing\n',
        message: 'OpenAI quota exhausted or insufficient balance.',
        hint: 'Please check your billing and credits at https://platform.openai.com/account/billing or switch models using /model.',
    },
    {
        id: 'huggingface',
        name: 'Hugging Face',
        match: (str) =>
            (str.includes('huggingface') || str.includes('router.huggingface.co')) &&
            isCreditOrBalanceError(str),
        notice: 'Insufficient credits or quota in your Hugging Face account. Please check your billing at https://huggingface.co/settings/billing\n',
        message: 'Insufficient credits or quota in your Hugging Face account.',
        hint: 'Please check your billing at https://huggingface.co/settings/billing or switch models using /model.',
    },
    {
        id: 'agentrouter',
        name: 'AgentRouter',
        match: (str) => str.includes('agentrouter') && isCreditOrBalanceError(str),
        notice: 'Insufficient credits in your AgentRouter account. Please add credits at https://agentrouter.org/\n',
        message: 'Insufficient credits in your AgentRouter account.',
        hint: 'Please add credits at https://agentrouter.org/ or switch models using /model.',
    },
    {
        id: 'google',
        name: 'Google AI Studio',
        match: (str) =>
            (str.includes('google') || str.includes('gemini') || str.includes('aistudio')) &&
            (isCreditOrBalanceError(str) || str.includes('credits') || str.includes('402')),
        notice: 'Insufficient credits in your Google AI Studio account. Please check your account at https://aistudio.google.com/\n',
        message: 'Insufficient credits in your Google AI Studio account.',
        hint: 'Please check your account at https://aistudio.google.com/ or switch models using /model.',
    },
    {
        id: 'sarvam',
        name: 'Sarvam AI',
        match: (str) =>
            (str.includes('sarvam') || str.includes('indus.sarvam.ai')) &&
            (isCreditOrBalanceError(str) || str.includes('credits') || str.includes('402')),
        notice: 'Insufficient credits in your Sarvam AI account. Please add credits or top up your balance at https://indus.sarvam.ai/\n',
        message: 'Insufficient credits in your Sarvam AI account.',
        hint: 'Please add credits or top up your balance at https://indus.sarvam.ai/',
    },
    {
        id: 'stepfun',
        name: 'StepFun',
        match: (str) =>
            (str.includes('stepfun') || str.includes('stepfun.ai')) &&
            (isCreditOrBalanceError(str) || str.includes('credits') || str.includes('402')),
        notice: 'Insufficient credits in your StepFun account. Please add credits or top up your balance at https://platform.stepfun.ai/interface-key\n',
        message: 'Insufficient credits in your StepFun account.',
        hint: 'Please add credits or top up your balance at https://platform.stepfun.ai/interface-key',
    },
    {
        id: 'upstage',
        name: 'Upstage Solar',
        match: (str) =>
            (str.includes('upstage') || str.includes('solar') || str.includes('upstage.ai')) &&
            (isCreditOrBalanceError(str) || str.includes('credits') || str.includes('402')),
        notice: 'Insufficient credits in your Upstage Solar account. Please add credits or top up your balance at https://console.upstage.ai/\n',
        message: 'Insufficient credits in your Upstage Solar account.',
        hint: 'Please add credits or top up your balance at https://console.upstage.ai/',
    },
    {
        id: 'thinkingmachines',
        name: 'Thinking Machines',
        match: (str) =>
            (str.includes('thinkingmachines') ||
                str.includes('tinker') ||
                str.includes('inkling') ||
                str.includes('thinkingmachines.ai')) &&
            (isCreditOrBalanceError(str) || str.includes('credits') || str.includes('402')),
        notice: 'Insufficient credits in your Thinking Machines account. Please add credits or top up your balance at https://tinker.thinkingmachines.ai/\n',
        message: 'Insufficient credits in your Thinking Machines account.',
        hint: 'Please add credits or top up your balance at https://tinker.thinkingmachines.ai/',
    },
    {
        id: 'nvidia',
        name: 'NVIDIA NIM',
        match: (str) =>
            (str.includes('nvidia') ||
                str.includes('nim') ||
                str.includes('nemotron') ||
                str.includes('build.nvidia.com')) &&
            (isCreditOrBalanceError(str) || str.includes('credits') || str.includes('402')),
        notice: 'Insufficient credits in your NVIDIA NIM account. Please check your account at https://build.nvidia.com/\n',
        message: 'Insufficient credits in your NVIDIA NIM account.',
        hint: 'Please check your account at https://build.nvidia.com/',
    },
]

export const PROVIDER_BILLING_URLS: Record<string, string> = {
    agentrouter: 'https://agentrouter.org/',
    anthropic: 'https://console.anthropic.com/settings/billing',
    arcee: 'https://platform.arcee.ai/api/api-keys',
    cerebras: 'https://cloud.cerebras.ai/',
    cohere: 'https://dashboard.cohere.com/billing',
    dashscope: 'https://dashscope.console.aliyun.com/',
    deepseek: 'https://platform.deepseek.com/top_up',
    fireworks: 'https://fireworks.ai/account/billing',
    google: 'https://aistudio.google.com/',
    groq: 'https://console.groq.com/settings/limits',
    huggingface: 'https://huggingface.co/settings/billing',
    hyperbolic: 'https://app.hyperbolic.xyz/settings',
    meta: 'https://dev.meta.ai/',
    minimax: 'https://platform.minimax.io/',
    mistral: 'https://console.mistral.ai/billing/',
    moonshot: 'https://platform.moonshot.cn/',
    nvidia: 'https://build.nvidia.com/',
    openai: 'https://platform.openai.com/account/billing',
    openrouter: 'https://openrouter.ai/settings/credits',
    perplexity: 'https://www.perplexity.ai/settings/api',
    poolside: 'https://platform.poolside.ai/api-keys',
    sakana: 'https://console.sakana.ai/api-keys',
    sambanova: 'https://cloud.sambanova.ai/',
    sarvam: 'https://indus.sarvam.ai/',
    siliconflow: 'https://cloud.siliconflow.cn/',
    stepfun: 'https://platform.stepfun.ai/interface-key',
    thinkingmachines: 'https://tinker.thinkingmachines.ai/',
    together: 'https://api.together.ai/settings/billing',
    upstage: 'https://console.upstage.ai/',
    xai: 'https://console.x.ai/',
    xiaomi: 'https://platform.xiaomimimo.com/console/api-keys',
    zai: 'https://open.bigmodel.cn/',
    zhipu: 'https://open.bigmodel.cn/',
    zhipuai: 'https://open.bigmodel.cn/',
    mimo: 'https://platform.xiaomimimo.com/console/api-keys',
}

export const PROVIDER_CREDIT_DISPLAY_NAMES: Record<string, string> = {
    agentrouter: 'AgentRouter',
    anthropic: 'Anthropic',
    arcee: 'Arcee AI',
    cerebras: 'Cerebras',
    cohere: 'Cohere',
    dashscope: 'Alibaba Cloud DashScope',
    deepseek: 'DeepSeek',
    fireworks: 'Fireworks AI',
    google: 'Google AI Studio',
    groq: 'Groq',
    huggingface: 'Hugging Face',
    hyperbolic: 'Hyperbolic',
    meta: 'Meta',
    mimo: 'Xiaomi',
    minimax: 'MiniMax',
    mistral: 'Mistral AI',
    moonshot: 'Moonshot AI',
    nvidia: 'NVIDIA NIM',
    openai: 'OpenAI',
    openrouter: 'OpenRouter',
    perplexity: 'Perplexity',
    poolside: 'Poolside',
    sakana: 'Sakana AI',
    sambanova: 'SambaNova',
    sarvam: 'Sarvam AI',
    siliconflow: 'SiliconFlow',
    stepfun: 'StepFun',
    thinkingmachines: 'Thinking Machines',
    together: 'Together AI',
    upstage: 'Upstage Solar',
    xai: 'xAI',
    xiaomi: 'Xiaomi',
    zai: 'Zhipu AI',
    zhipu: 'Zhipu AI',
    zhipuai: 'Zhipu AI',
}

export function normalizeProviderAlias(provider?: string): string {
    if (!provider) return ''
    const lower = provider.trim().toLowerCase()
    switch (lower) {
        case 'gemini':
        case 'google':
        case 'google-ai':
        case 'googleai':
            return 'google'
        case 'claude':
        case 'anthropic':
            return 'anthropic'
        case 'chatgpt':
        case 'codex':
        case 'openai':
            return 'openai'
        case 'arceeai':
        case 'arcee-ai':
        case 'arcee':
            return 'arcee'
        case 'metaai':
        case 'meta-ai':
        case 'meta':
            return 'meta'
        case 'minimaxai':
        case 'minimax-ai':
        case 'minimax':
            return 'minimax'
        case 'mistralai':
        case 'mistral-ai':
        case 'mistral':
            return 'mistral'
        case 'moonshotai':
        case 'moonshot-ai':
        case 'moonshoot':
        case 'kimi':
        case 'moonshot':
            return 'moonshot'
        case 'sakanaai':
        case 'sakana-ai':
        case 'sakana':
            return 'sakana'
        case 'sarvamai':
        case 'sarvam-ai':
        case 'sarvam':
            return 'sarvam'
        case 'stepfunai':
        case 'stepfun-ai':
        case 'stepfun':
            return 'stepfun'
        case 'upstageai':
        case 'solar':
        case 'upstage':
            return 'upstage'
        case 'tinker':
        case 'inkling':
        case 'thinkingmachines':
            return 'thinkingmachines'
        case 'siliconcloud':
        case 'siliconflow':
            return 'siliconflow'
        case 'togetherai':
        case 'together':
            return 'together'
        case 'mimo':
        case 'xiaomi':
            return 'xiaomi'
        case 'zhipuai':
        case 'zhipu-ai':
        case 'zhipu':
        case 'bigmodel':
        case 'zai':
            return 'zai'
        case 'qwen':
        case 'dashscope':
            return 'dashscope'
        default:
            return lower
    }
}

export function detectProviderFromText(str: string): string | null {
    if (!str) return null
    const lower = str.toLowerCase()
    if (lower.includes('arcee') || lower.includes('trinity') || lower.includes('api.arcee.ai'))
        return 'arcee'
    if (lower.includes('sarvam') || lower.includes('indus.sarvam.ai')) return 'sarvam'
    if (lower.includes('stepfun') || lower.includes('stepfun.ai')) return 'stepfun'
    if (lower.includes('upstage') || lower.includes('solar') || lower.includes('upstage.ai'))
        return 'upstage'
    if (
        lower.includes('thinkingmachines') ||
        lower.includes('tinker') ||
        lower.includes('inkling') ||
        lower.includes('thinkingmachines.ai')
    )
        return 'thinkingmachines'
    if (lower.includes('minimax') || lower.includes('api.minimax.io')) return 'minimax'
    if (lower.includes('deepseek') || lower.includes('api.deepseek.com')) return 'deepseek'
    if (lower.includes('openrouter') || lower.includes('openrouter.ai')) return 'openrouter'
    if (lower.includes('meta') || lower.includes('muse-spark') || lower.includes('dev.meta.ai'))
        return 'meta'
    if (
        lower.includes('siliconflow') ||
        lower.includes('siliconcloud') ||
        lower.includes('siliconflow.cn')
    )
        return 'siliconflow'
    if (
        lower.includes('moonshot') ||
        lower.includes('kimi') ||
        lower.includes('moonshot.cn') ||
        lower.includes('kimi.com')
    )
        return 'moonshot'
    if (
        lower.includes('together') ||
        lower.includes('together.ai') ||
        lower.includes('together.xyz')
    )
        return 'together'
    if (lower.includes('fireworks') || lower.includes('fireworks.ai')) return 'fireworks'
    if (lower.includes('groq') || lower.includes('api.groq.com')) return 'groq'
    if (
        lower.includes('mistral') ||
        lower.includes('codestral') ||
        lower.includes('pixtral') ||
        lower.includes('mistral.ai')
    )
        return 'mistral'
    if (lower.includes('cerebras') || lower.includes('api.cerebras.ai')) return 'cerebras'
    if (lower.includes('sambanova') || lower.includes('api.sambanova.ai')) return 'sambanova'
    if (
        lower.includes('hyperbolic') ||
        lower.includes('hyperbolic.xyz') ||
        lower.includes('hyperbolic.ai')
    )
        return 'hyperbolic'
    if (lower.includes('perplexity') || lower.includes('perplexity.ai')) return 'perplexity'
    if (lower.includes('cohere') || lower.includes('api.cohere.com')) return 'cohere'
    if (
        lower.includes('xai') ||
        lower.includes('grok') ||
        lower.includes('api.x.ai') ||
        lower.includes('x.ai')
    )
        return 'xai'
    if (lower.includes('xiaomi') || lower.includes('mimo') || lower.includes('xiaomimimo.com'))
        return 'xiaomi'
    if (
        lower.includes('zai') ||
        lower.includes('zhipu') ||
        lower.includes('zhipuai') ||
        lower.includes('bigmodel.cn') ||
        lower.includes('api.z.ai')
    )
        return 'zai'
    if (lower.includes('poolside') || lower.includes('laguna') || lower.includes('poolside.ai'))
        return 'poolside'
    if (
        lower.includes('sakana') ||
        lower.includes('fugu') ||
        lower.includes('namazu') ||
        lower.includes('sakana.ai')
    )
        return 'sakana'
    if (lower.includes('dashscope') || lower.includes('qwen') || lower.includes('aliyuncs.com'))
        return 'dashscope'
    if (
        lower.includes('anthropic') ||
        lower.includes('claude') ||
        lower.includes('api.anthropic.com')
    )
        return 'anthropic'
    if (lower.includes('openai') || lower.includes('api.openai.com')) return 'openai'
    if (
        lower.includes('google') ||
        lower.includes('gemini') ||
        lower.includes('aistudio') ||
        lower.includes('generativelanguage.googleapis.com')
    )
        return 'google'
    if (lower.includes('huggingface') || lower.includes('router.huggingface.co'))
        return 'huggingface'
    if (lower.includes('agentrouter') || lower.includes('agentrouter.org')) return 'agentrouter'
    if (lower.includes('nvidia') || lower.includes('build.nvidia.com')) return 'nvidia'
    return null
}

export function resolveDynamicCreditRule(
    combined: string,
    context?: ErrorParseContext
): ProviderCreditRule | null {
    let candidate = (context?.provider || '').trim().toLowerCase()
    if (!candidate && context?.model) {
        const inferred = inferProviderFromModel(context.model)
        if (inferred && inferred !== 'openrouter') {
            candidate = inferred
        }
    }
    if (!candidate) {
        candidate = detectProviderFromText(combined) || ''
    }

    const normalized = normalizeProviderAlias(candidate)
    if (normalized && PROVIDER_BILLING_URLS[normalized]) {
        const displayName =
            PROVIDER_CREDIT_DISPLAY_NAMES[normalized] ||
            normalized.charAt(0).toUpperCase() + normalized.slice(1)
        const billingUrl = PROVIDER_BILLING_URLS[normalized]
        return {
            id: normalized,
            name: displayName,
            match: () => true,
            notice: `Insufficient credits in your ${displayName} account. Please add credits or top up your balance at ${billingUrl}\n`,
            message: `Insufficient credits in your ${displayName} account.`,
            hint: `Please add credits or top up your balance at ${billingUrl}`,
        }
    }

    if (context?.baseURL) {
        return {
            id: 'custom_provider',
            name: 'Custom Provider',
            match: () => true,
            notice: `Insufficient credits or balance with your custom provider. Please check your account or top up at ${context.baseURL}\n`,
            message: 'Insufficient credits or balance with your custom provider.',
            hint: `Please check your account or top up at ${context.baseURL} or switch models using /model.`,
        }
    }

    return null
}

export const UNIVERSAL_CREDIT_FALLBACK: ProviderCreditRule = {
    id: 'universal_fallback',
    name: 'LLM Provider',
    match: (str) => isCreditOrBalanceError(str),
    notice: 'Insufficient balance or credits with your LLM provider. Please check your account balance and top up credits with your provider, or switch models using /model\n',
    message: 'Insufficient balance or credits with your LLM provider.',
    hint: 'Please check your account balance and top up credits with your provider, or switch models using /model.',
}

export function findMatchingCreditRule(
    combined: string,
    context?: ErrorParseContext
): ProviderCreditRule | null {
    for (const rule of PROVIDER_CREDIT_RULES) {
        if (rule.match(combined)) {
            return rule
        }
    }

    if (isCreditOrBalanceError(combined)) {
        const dynamicRule = resolveDynamicCreditRule(combined, context)
        if (dynamicRule) {
            return dynamicRule
        }

        return UNIVERSAL_CREDIT_FALLBACK
    }

    return null
}

export function parseErrorMessage(err: any, context?: ErrorParseContext): string {
    let errMsg: string
    try {
        errMsg = err?.message || String(err)
        if (typeof errMsg !== 'string') {
            errMsg = JSON.stringify(errMsg)
        }
    } catch {
        return 'Unknown error occurred.'
    }

    const extractMessage = (str: string): string | null => {
        if (!str) return null

        // 1. try regex extraction first, since it's the most robust against broken json
        const msgMatch = str.match(/"message"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/)
        if (msgMatch) {
            let extractedMatch = msgMatch[1]
            try {
                extractedMatch = JSON.parse(`"${msgMatch[1]}"`)
            } catch {
                // Keep raw match if unescape fails
            }

            if (typeof extractedMatch === 'string' && extractedMatch.trim().startsWith('{')) {
                const nested = extractMessage(extractedMatch)
                if (nested) return nested
            }
            return extractedMatch
        }

        // 2. try json parse
        try {
            const parsed = JSON.parse(str)
            if (parsed && typeof parsed === 'object') {
                // if the error field itself is a stringified json, recurse
                if (typeof parsed.error === 'string' && parsed.error.trim().startsWith('{')) {
                    const extracted = extractMessage(parsed.error)
                    if (extracted) return extracted
                }
                if (typeof parsed.message === 'string' && parsed.message.trim().startsWith('{')) {
                    const extracted = extractMessage(parsed.message)
                    if (extracted) return extracted
                }
                if (
                    typeof parsed.error?.message === 'string' &&
                    parsed.error.message.trim().startsWith('{')
                ) {
                    const extracted = extractMessage(parsed.error.message)
                    if (extracted) return extracted
                }

                // normal object access
                if (typeof parsed.error?.message === 'string') return parsed.error.message
                if (typeof parsed.message === 'string') return parsed.message
                if (typeof parsed.error === 'string') return parsed.error
            }
        } catch {
            // Ignore JSON parse error and continue to fallback extractors
        }

        // 3. try json block extraction
        const firstBrace = str.indexOf('{')
        const lastBrace = str.lastIndexOf('}')
        if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
            const jsonStr = str.slice(firstBrace, lastBrace + 1)
            try {
                const parsed = JSON.parse(jsonStr)
                if (parsed?.error?.message && typeof parsed.error.message === 'string')
                    return parsed.error.message
                if (parsed?.message && typeof parsed.message === 'string') return parsed.message
            } catch {
                // Ignore slice parse error
            }
        }

        return null
    }

    const extracted = extractMessage(errMsg)
    let finalResult = extracted && extracted !== '[object Object]' ? extracted : ''

    if (!finalResult) {
        if (errMsg === '[object Object]' && err && typeof err === 'object') {
            try {
                const inspected = util.inspect(err)
                if (inspected && inspected !== '{}' && inspected !== '{ cause: {} }') {
                    finalResult = inspected
                }
            } catch {
                // Fall back to raw string
            }
        }
    }

    if (!finalResult) {
        const cleaned = errMsg.replace(/^\[.*?Error\]:\s*/, '').trim()
        if (
            cleaned === '{\n  "cause": {}\n}' ||
            cleaned === '{"cause":{}}' ||
            cleaned === '{}' ||
            cleaned === '{ cause: {} }'
        ) {
            finalResult = 'An unknown error occurred while communicating with the model provider.'
        } else {
            finalResult = cleaned
        }
    }

    const rateLimitNotice =
        'Rate limit or quota exhausted from LLM provider. Please upgrade your API key tier with your provider (OpenAI, Anthropic, Gemini) or switch to December Cloud Subscription at https://trydecember.com/pricing\n'

    const contextStr = `${context?.provider || ''} ${context?.model || ''}`.toLowerCase().trim()
    const lowerStr = (
        errMsg +
        ' ' +
        (finalResult || '') +
        (contextStr ? ' ' + contextStr : '')
    ).toLowerCase()
    const isRateLimit =
        lowerStr.includes('429') ||
        lowerStr.includes('quota') ||
        lowerStr.includes('rate limit') ||
        lowerStr.includes('rate_limit') ||
        lowerStr.includes('resource_exhausted') ||
        lowerStr.includes('generativelanguage.googleapis.com')

    if (isRateLimit && !finalResult.includes('Rate limit or quota exhausted from LLM provider')) {
        return rateLimitNotice + finalResult
    }

    const isDecemberCredits =
        lowerStr.includes('december wallet') ||
        lowerStr.includes('trydecember.com') ||
        lowerStr.includes('december cloud')

    if (!isDecemberCredits) {
        const creditRule = findMatchingCreditRule(lowerStr, context)
        if (creditRule) {
            const hasNoticeAlready =
                finalResult.includes(creditRule.message) ||
                (creditRule.hint && finalResult.includes(creditRule.hint))
            if (!hasNoticeAlready) {
                return creditRule.notice + finalResult
            }
        }
    }

    const isChannelError =
        lowerStr.includes('无可用渠道') ||
        lowerStr.includes('no available channel') ||
        lowerStr.includes('channel not found')

    if (isChannelError) {
        return (
            'The selected model is not available or not enabled for your token group on this provider. Please switch models using `/model` (e.g. glm-5.2, gpt-5.5, claude-opus-4-6, glm-4-plus).\n' +
            finalResult
        )
    }

    const isAuthError =
        lowerStr.includes('401') ||
        lowerStr.includes('unauthorized') ||
        lowerStr.includes('invalid token') ||
        lowerStr.includes('access token expired') ||
        lowerStr.includes('session expired') ||
        lowerStr.includes('session not found')

    if (
        isAuthError &&
        !finalResult.includes('Please run `/login`') &&
        !finalResult.includes('Please run /login')
    ) {
        const authNotice =
            'Authentication failed or session expired. Please run `/login` to sign in with your December account (Cloud Wallet), relink your AI Subscription, or configure Bring Your Own Key (BYOK).\n'
        return authNotice + finalResult
    }

    return finalResult
}

export interface ParsedErrorDetails {
    message: string
    cause?: string
    hint?: string
}

export function parseError(err: any, context?: ErrorParseContext): ParsedErrorDetails {
    if (!err) {
        return { message: 'Unknown error occurred.' }
    }

    // Check for explicit cause or originalError on err
    let explicitCause: string | undefined
    if (err?.cause) {
        explicitCause =
            typeof err.cause === 'string'
                ? err.cause
                : err.cause?.message ||
                  (typeof err.cause === 'object' ? util.inspect(err.cause) : String(err.cause))
    } else if (err?.originalError) {
        explicitCause =
            typeof err.originalError === 'string'
                ? err.originalError
                : err.originalError?.message ||
                  (typeof err.originalError === 'object'
                      ? util.inspect(err.originalError)
                      : String(err.originalError))
    } else if (err?.response?.data) {
        explicitCause =
            typeof err.response.data === 'string'
                ? err.response.data
                : JSON.stringify(err.response.data)
    }

    const contextStr = `${context?.provider || ''} ${context?.model || ''}`.toLowerCase().trim()
    const fullMessage = parseErrorMessage(err, context)
    const combined =
        `${fullMessage} ${explicitCause || ''} ${contextStr ? ' ' + contextStr : ''}`.toLowerCase()

    // 1. Rate limit
    const isRateLimit =
        combined.includes('429') ||
        combined.includes('quota') ||
        combined.includes('rate limit') ||
        combined.includes('rate_limit') ||
        combined.includes('resource_exhausted') ||
        combined.includes('generativelanguage.googleapis.com')

    if (isRateLimit) {
        const parts = fullMessage.split('\n')
        const cause =
            explicitCause || (parts.length > 1 ? parts.slice(1).join('\n').trim() : fullMessage)
        return {
            message: 'Rate limit or quota exhausted from LLM provider.',
            cause:
                cause && !cause.startsWith('Rate limit or quota exhausted')
                    ? cause
                    : explicitCause || parts[0],
            hint: 'Please upgrade your API key tier with your provider (OpenAI, Anthropic, Gemini) or switch to December Cloud Subscription at https://trydecember.com/pricing',
        }
    }

    // 2. Provider credits & Universal balance fallback
    const isDecemberCredits =
        combined.includes('december wallet') ||
        combined.includes('trydecember.com') ||
        combined.includes('december cloud')

    if (!isDecemberCredits) {
        const creditRule = findMatchingCreditRule(combined, context)
        if (creditRule) {
            const parts = fullMessage.split('\n')
            const cause =
                explicitCause || (parts.length > 1 ? parts.slice(1).join('\n').trim() : fullMessage)
            return {
                message: creditRule.message,
                cause:
                    cause && !cause.startsWith(creditRule.message)
                        ? cause
                        : explicitCause || parts[0],
                hint: creditRule.hint,
            }
        }
    }

    // 5. Channel error
    const isChannelError =
        combined.includes('无可用渠道') ||
        combined.includes('no available channel') ||
        combined.includes('channel not found')

    if (isChannelError) {
        const parts = fullMessage.split('\n')
        const cause =
            explicitCause || (parts.length > 1 ? parts.slice(1).join('\n').trim() : fullMessage)
        return {
            message:
                'The selected model is not available or not enabled for your token group on this provider.',
            cause: cause,
            hint: 'Please switch models using `/model` (e.g. glm-5.2, gpt-5.5, claude-opus-4-6, glm-4-plus).',
        }
    }

    // 6. Auth error
    const isAuthError =
        combined.includes('401') ||
        combined.includes('unauthorized') ||
        combined.includes('invalid token') ||
        combined.includes('access token expired') ||
        combined.includes('session expired') ||
        combined.includes('session not found')

    if (isAuthError) {
        const parts = fullMessage.split('\n')
        const cause =
            explicitCause || (parts.length > 1 ? parts.slice(1).join('\n').trim() : fullMessage)
        return {
            message: 'Authentication failed or session expired.',
            cause:
                cause && !cause.startsWith('Authentication failed or session expired')
                    ? cause
                    : explicitCause || parts[0],
            hint: 'Please run `/login` to sign in with your December account (Cloud Wallet), relink your AI Subscription, or configure Bring Your Own Key (BYOK).',
        }
    }

    // 7. Overloaded / 503 / 529 error (from agent-loop)
    if (
        combined.includes('high demand') ||
        combined.includes('503') ||
        combined.includes('529') ||
        combined.includes('overloaded') ||
        combined.includes('capacity')
    ) {
        const parts = fullMessage.split('\n')
        return {
            message:
                'Model is currently experiencing high demand or capacity limits from the provider.',
            cause:
                explicitCause ||
                (parts.length > 1 ? parts.slice(1).join('\n').trim() : fullMessage),
            hint: 'Spikes in demand are usually temporary. Please try again in a few moments or switch to a different model.',
        }
    }

    // 8. EADDRINUSE port error
    if (combined.includes('eaddrinuse')) {
        const primaryMessage =
            err?.message && !err.message.includes('EADDRINUSE')
                ? err.message
                : 'Port is already in use by another process.'
        return {
            message: primaryMessage,
            cause: explicitCause || fullMessage,
            hint: 'Another process is already using this port. Free up the port or check running processes.',
        }
    }

    // 9. EACCES / permission denied error
    if (combined.includes('eacces') || combined.includes('permission denied')) {
        const primaryMessage =
            err?.message && !err.message.toLowerCase().includes('permission denied')
                ? err.message
                : 'Permission denied accessing file or resource.'
        return {
            message: primaryMessage,
            cause: explicitCause || fullMessage,
            hint: 'Check file permissions or run the command with appropriate access privileges.',
        }
    }

    // 10. ECONNREFUSED network error
    if (combined.includes('econnrefused')) {
        const primaryMessage =
            err?.message && !err.message.includes('ECONNREFUSED')
                ? err.message
                : 'Connection refused by destination host.'
        return {
            message: primaryMessage,
            cause: explicitCause || fullMessage,
            hint: 'Verify that the server or target service is running and network is reachable.',
        }
    }

    // Default case: return parsed message with explicit cause if present
    const cleanMsg = err?.message || fullMessage
    return {
        message: cleanMsg,
        cause: explicitCause && explicitCause !== cleanMsg ? explicitCause : undefined,
        hint: err?.hint,
    }
}
