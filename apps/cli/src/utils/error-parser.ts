import util from 'util'
export function parseErrorMessage(err: any): string {
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

    const lowerStr = (errMsg + ' ' + (finalResult || '')).toLowerCase()
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

    const isOpenRouterCredits =
        !isDecemberCredits &&
        (lowerStr.includes('openrouter') ||
            lowerStr.includes('requires more credits') ||
            lowerStr.includes('can only afford'))

    if (
        isOpenRouterCredits &&
        (lowerStr.includes('credits') || lowerStr.includes('afford') || lowerStr.includes('402')) &&
        !finalResult.includes('OpenRouter credits exhausted or insufficient') &&
        !finalResult.includes('https://openrouter.ai/settings/credits')
    ) {
        const openRouterCreditsNotice =
            'OpenRouter credits exhausted or insufficient. Please add credits at https://openrouter.ai/settings/credits\n'
        return openRouterCreditsNotice + finalResult
    }

    const isArceeCredits =
        !isDecemberCredits &&
        (lowerStr.includes('arcee') || lowerStr.includes('trinity')) &&
        (lowerStr.includes('credits') || lowerStr.includes('402'))

    if (isArceeCredits && !finalResult.includes('Insufficient credits in your Arcee AI account')) {
        const arceeCreditsNotice =
            'Insufficient credits in your Arcee AI account. Please add credits or top up your balance at https://platform.arcee.ai/api/api-keys\n'
        return arceeCreditsNotice + finalResult
    }

    const isMetaCredits =
        !isDecemberCredits &&
        (lowerStr.includes('meta') ||
            lowerStr.includes('muse-spark') ||
            lowerStr.includes('dev.meta.ai')) &&
        (lowerStr.includes('credits') || lowerStr.includes('402'))

    if (isMetaCredits && !finalResult.includes('Insufficient credits in your Meta account')) {
        const metaCreditsNotice =
            'Insufficient credits in your Meta account. Please add credits or top up your balance at https://dev.meta.ai/\n'
        return metaCreditsNotice + finalResult
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

export function parseError(err: any): ParsedErrorDetails {
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

    const fullMessage = parseErrorMessage(err)
    const combined = `${fullMessage} ${explicitCause || ''}`.toLowerCase()

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

    // 2. OpenRouter credits
    const isDecemberCredits =
        combined.includes('december wallet') ||
        combined.includes('trydecember.com') ||
        combined.includes('december cloud')

    const isOpenRouterCredits =
        !isDecemberCredits &&
        (combined.includes('openrouter') ||
            combined.includes('requires more credits') ||
            combined.includes('can only afford')) &&
        (combined.includes('credits') || combined.includes('afford') || combined.includes('402'))

    if (isOpenRouterCredits) {
        const parts = fullMessage.split('\n')
        const cause =
            explicitCause || (parts.length > 1 ? parts.slice(1).join('\n').trim() : fullMessage)
        return {
            message: 'OpenRouter credits exhausted or insufficient.',
            cause:
                cause && !cause.startsWith('OpenRouter credits exhausted')
                    ? cause
                    : explicitCause || parts[0],
            hint: 'Please add credits at https://openrouter.ai/settings/credits',
        }
    }

    // 3. Arcee credits
    const isArceeCredits =
        !isDecemberCredits &&
        (combined.includes('arcee') || combined.includes('trinity')) &&
        (combined.includes('credits') || combined.includes('402'))

    if (isArceeCredits) {
        const parts = fullMessage.split('\n')
        const cause =
            explicitCause || (parts.length > 1 ? parts.slice(1).join('\n').trim() : fullMessage)
        return {
            message: 'Insufficient credits in your Arcee AI account.',
            cause:
                cause && !cause.startsWith('Insufficient credits in your Arcee')
                    ? cause
                    : explicitCause || parts[0],
            hint: 'Please add credits or top up your balance at https://platform.arcee.ai/api/api-keys',
        }
    }

    // 4. Meta credits
    const isMetaCredits =
        !isDecemberCredits &&
        (combined.includes('meta') ||
            combined.includes('muse-spark') ||
            combined.includes('dev.meta.ai')) &&
        (combined.includes('credits') || combined.includes('402'))

    if (isMetaCredits) {
        const parts = fullMessage.split('\n')
        const cause =
            explicitCause || (parts.length > 1 ? parts.slice(1).join('\n').trim() : fullMessage)
        return {
            message: 'Insufficient credits in your Meta account.',
            cause:
                cause && !cause.startsWith('Insufficient credits in your Meta')
                    ? cause
                    : explicitCause || parts[0],
            hint: 'Please add credits or top up your balance at https://dev.meta.ai/',
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
