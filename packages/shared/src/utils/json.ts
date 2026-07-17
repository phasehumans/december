export function safeParseJson(text: string): any {
    if (!text || text.trim() === '') {
        return {}
    }

    let cleanText = text.trim()

    // Remove markdown code blocks if present
    if (cleanText.startsWith('```')) {
        const lines = cleanText.split('\n')
        // Remove the first line (e.g. ```json)
        lines.shift()
        // Remove the last line if it's just ```
        if (lines.length > 0 && lines[lines.length - 1]?.trim() === '```') {
            lines.pop()
        }
        cleanText = lines.join('\n').trim()
    }

    try {
        return JSON.parse(cleanText)
    } catch (err: any) {
        // Attempt basic fixes for common LLM hallucinations:
        // 1. Missing closing brace
        if (cleanText.startsWith('{') && !cleanText.endsWith('}')) {
            try {
                return JSON.parse(cleanText + '}')
            } catch (e) {
                // fall through
            }
        }
        // 2. Extra trailing comma
        if (cleanText.endsWith(',}') || cleanText.endsWith(', }') || cleanText.match(/,\s*\}/)) {
            try {
                return JSON.parse(cleanText.replace(/,\s*\}/g, '}'))
            } catch (e) {
                // fall through
            }
        }

        throw new Error(`Failed to parse JSON tool arguments: ${err.message}\nRaw text: ${text}`)
    }
}
