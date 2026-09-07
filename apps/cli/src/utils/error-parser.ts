import util from 'util'

export interface ErrorParseContext {
    provider?: string
    model?: string
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
        id: 'zai',
        name: 'Zhipu AI',
        match: (str) =>
            (str.includes('zai') || str.includes('zhipu') || str.includes('bigmodel.cn')) &&
            isCreditOrBalanceError(str),
        notice: 'Insufficient balance in your Zhipu AI account. Please top up your balance at https://open.bigmodel.cn/\n',
        message: 'Insufficient balance in your Zhipu AI account.',
        hint: 'Please top up your balance at https://open.bigmodel.cn/ or switch models using /model.',
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
]

export const UNIVERSAL_CREDIT_FALLBACK: ProviderCreditRule = {
    id: 'universal_fallback',
    name: 'LLM Provider',
    match: (str) => isCreditOrBalanceError(str),
    notice: 'Insufficient balance or credits with your LLM provider. Please check your account balance and top up credits with your provider, or switch models using /model\n',
    message: 'Insufficient balance or credits with your LLM provider.',
    hint: 'Please check your account balance and top up credits with your provider, or switch models using /model.',
}

export function findMatchingCreditRule(combined: string): ProviderCreditRule | null {
    for (const rule of PROVIDER_CREDIT_RULES) {
        if (rule.match(combined)) {
            return rule
        }
    }
    if (UNIVERSAL_CREDIT_FALLBACK.match(combined)) {
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
        const creditRule = findMatchingCreditRule(lowerStr)
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
        const creditRule = findMatchingCreditRule(combined)
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
