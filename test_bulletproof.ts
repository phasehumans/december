const parseErrorMessage = (err: any): string => {
    let errMsg = err?.message || String(err)

    const tryParse = (str: string): string | null => {
        try {
            const parsed = JSON.parse(str)
            if (!parsed || typeof parsed !== 'object') return null
            if (typeof parsed.error === 'string') {
                return tryParse(parsed.error) || parsed.error
            }
            if (parsed.error?.message) {
                return typeof parsed.error.message === 'string'
                    ? parsed.error.message
                    : JSON.stringify(parsed.error.message)
            }
            if (parsed.message) {
                return typeof parsed.message === 'string'
                    ? parsed.message
                    : JSON.stringify(parsed.message)
            }
        } catch (e) {}
        return null
    }

    let parsedResult = tryParse(errMsg)
    if (parsedResult) return parsedResult

    const firstBrace = errMsg.indexOf('{')
    const lastBrace = errMsg.lastIndexOf('}')
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        const jsonStr = errMsg.slice(firstBrace, lastBrace + 1)
        parsedResult = tryParse(jsonStr)
        if (parsedResult) return parsedResult
    }

    const msgMatch = errMsg.match(/"message"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/)
    if (msgMatch) {
        try {
            return JSON.parse(`"${msgMatch[1]}"`)
        } catch (e) {
            return msgMatch[1]
        }
    }

    return errMsg.replace(/^\[.*?Error\]:\s*/, '').trim()
}

// Emulate user's exact broken string with physical newlines inside the quotes
const err = new Error(`✖ Failed to start interview: {
      "error": {
        "code": 429,
        "message": "You exceeded your current quota, please check your plan and billing details. For more information 
    on this error, head to: https://ai.google.dev/gemini-api/docs/rate-limits. To monitor your current usage, head to: 
    https://ai.dev/rate-limit. \\n* Quota exceeded for metric: 
    generativelanguage.googleapis.com/generate_content_free_tier_input_token_count, limit: 0, model: gemini-2.5-pro\\n* 
    Quota exceeded for metric: generativelanguage.googleapis.com/generate_content_free_tier_input_token_count, limit: 
    0, model: gemini-2.5-pro\\n* Quota exceeded for metric: 
    generativelanguage.googleapis.com/generate_content_free_tier_requests, limit: 0, model: gemini-2.5-pro\\n* Quota 
    exceeded for metric: generativelanguage.googleapis.com/generate_content_free_tier_requests, limit: 0, model: 
    gemini-2.5-pro\\nPlease retry in 5.713276691s.",
        "status": "RESOURCE_EXHAUSTED",
        "details": []
      }
    }`)

console.log('RESULT:', parseErrorMessage(err))
