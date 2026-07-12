export function parseErrorMessage(err: any): string {
    let errMsg = ''
    try {
        errMsg = err?.message || String(err)
        if (typeof errMsg !== 'string') {
            errMsg = JSON.stringify(errMsg)
        }
    } catch (e) {
        return 'Unknown error occurred.'
    }

    const extractMessage = (str: string): string | null => {
        if (!str) return null

        // 1. Try regex extraction first, since it's the most robust against broken JSON
        const msgMatch = str.match(/"message"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/)
        if (msgMatch) {
            try {
                return JSON.parse(`"${msgMatch[1]}"`)
            } catch (e) {
                return msgMatch[1]
            }
        }

        // 2. Try JSON parse
        try {
            const parsed = JSON.parse(str)
            if (parsed && typeof parsed === 'object') {
                // If the error field itself is a stringified JSON, recurse
                if (typeof parsed.error === 'string' && parsed.error.trim().startsWith('{')) {
                    const extracted = extractMessage(parsed.error)
                    if (extracted) return extracted
                }
                if (typeof parsed.message === 'string' && parsed.message.trim().startsWith('{')) {
                    const extracted = extractMessage(parsed.message)
                    if (extracted) return extracted
                }

                // Normal object access
                if (typeof parsed.error?.message === 'string') return parsed.error.message
                if (typeof parsed.message === 'string') return parsed.message
                if (typeof parsed.error === 'string') return parsed.error
            }
        } catch (e) {}

        // 3. Try JSON block extraction
        const firstBrace = str.indexOf('{')
        const lastBrace = str.lastIndexOf('}')
        if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
            const jsonStr = str.slice(firstBrace, lastBrace + 1)
            try {
                const parsed = JSON.parse(jsonStr)
                if (parsed?.error?.message && typeof parsed.error.message === 'string')
                    return parsed.error.message
                if (parsed?.message && typeof parsed.message === 'string') return parsed.message
            } catch (e) {}
        }

        return null
    }

    const extracted = extractMessage(errMsg)
    if (extracted) return extracted

    return errMsg.replace(/^\[.*?Error\]:\s*/, '').trim()
}
