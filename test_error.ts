const parseErrorMessage = (err: any): string => {
    let errMsg = err?.message || String(err)
    try {
        // Repeatedly try parsing if it's double-stringified
        let parsed = JSON.parse(errMsg)
        if (typeof parsed.error === 'string') {
            try {
                parsed = JSON.parse(parsed.error)
            } catch (e) {}
        }

        if (parsed.error?.message) {
            return typeof parsed.error.message === 'string'
                ? parsed.error.message
                : JSON.stringify(parsed.error.message)
        } else if (parsed.message) {
            return typeof parsed.message === 'string'
                ? parsed.message
                : JSON.stringify(parsed.message)
        } else if (parsed.error && typeof parsed.error === 'string') {
            return parsed.error
        }
    } catch (e) {
        // Regex fallback if it's wrapped in other text
        const match = errMsg.match(/\{[\s\S]*\}/)
        if (match) {
            try {
                let parsed = JSON.parse(match[0])
                if (typeof parsed.error === 'string') {
                    try {
                        parsed = JSON.parse(parsed.error)
                    } catch (e) {}
                }
                if (parsed.error?.message) return parsed.error.message
                if (parsed.message) return parsed.message
            } catch (e) {}
        }
    }
    return errMsg
}

const err = new Error(`[GoogleGenerativeAI Error]: {
  "error": {
    "code": 429,
    "message": "You exceeded your current quota, please check your plan and billing details.",
    "status": "RESOURCE_EXHAUSTED",
    "details": []
  }
}`)

console.log(parseErrorMessage(err))
