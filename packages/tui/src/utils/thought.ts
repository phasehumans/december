/**
 * Clean up and extract concise thought topics from raw model thinking strings.
 * Ported from the React & Ink bot message component.
 */

export function formatThought(raw: string): string {
    if (!raw) return ''

    const lines = raw.split(/\r?\n/)
    const cleanedLines: string[] = []

    for (const line of lines) {
        let trimmed = line.trim()
        if (!trimmed) continue

        // 1. Strip section scaffolding labels like:
        //    *  **Goal Understanding:** ...
        //    *  **Goal Understanding**: ...
        //    **Goal Understanding:** ...
        //    ### Goal Understanding: ...
        //    * Goal Understanding: ...
        trimmed = trimmed
            .replace(/^[*•-]*\s*\*\*([^*]+)\*\*:?\s*/i, '')
            .replace(/^#{1,4}\s*([^:\n]+):?\s*/i, '')
            .replace(
                /^[*•-]*\s*(?:goal understanding|analysis|next steps|approach|plan|execution plan|thoughts?|reasoning):\s*/i,
                ''
            )

        // If the line was ONLY a standalone header with no subsequent text on that line, skip it
        if (!trimmed) continue

        // 2. Strip leading list bullet markers and numbered list markers
        trimmed = trimmed.replace(/^[*•-]+\s*/, '')
        trimmed = trimmed.replace(/^\d+[.)]\s*/, '')

        // 3. Strip unparsed bold / italic markdown tags while preserving backticks
        trimmed = trimmed.replace(/\*\*([^*]+)\*\*/g, '$1')
        trimmed = trimmed.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '$1')

        trimmed = trimmed.trim()
        if (trimmed) {
            cleanedLines.push(trimmed)
        }
    }

    return cleanedLines.join('\n')
}

export function extractThoughtTopic(raw: string): string {
    if (!raw) return ''
    const cleaned = formatThought(raw)
    if (!cleaned) return ''

    const lines = cleaned
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean)
    if (lines.length === 0) return ''

    let current = lines[lines.length - 1]!
    if (current.length < 5 && lines.length > 1) {
        current = lines[lines.length - 2]!
    }

    const sentences = current
        .split(/(?<=[.!?])\s+/)
        .map((s) => s.trim())
        .filter(Boolean)
    if (sentences.length > 0) {
        current = sentences[sentences.length - 1]!
    }

    current = current
        .replace(/^[^a-zA-Z0-9]+/, '')
        .replace(/[.:;,]+$/, '')
        .trim()
    current = current
        .replace(/^(?:line \d+|step \d+):\s*/i, '')
        .replace(
            /^(?:first(?:ly)?|now|next|then|so)?\s*,?\s*(?:i am|i'm|i need to|i should|i will|i want to|let's|let me|we need to|we should|thinking about|going to)\s+/i,
            ''
        )
        .trim()

    if (current) {
        current = current.charAt(0).toLowerCase() + current.slice(1)
    }

    const MAX_TOPIC_LEN = 48
    if (current.length > MAX_TOPIC_LEN) {
        current = current.substring(0, MAX_TOPIC_LEN - 3) + '...'
    }

    return current
}
