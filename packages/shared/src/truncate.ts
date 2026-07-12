export const DEFAULT_MAX_BYTES = 10_000
export const DEFAULT_MAX_LINES = 200

export interface TruncationResult {
    originalLength: number
    originalBytes: number
    truncated: boolean
    text: string
}

export function truncateOutput(
    text: string,
    maxBytes = DEFAULT_MAX_BYTES,
    maxLines = DEFAULT_MAX_LINES
): TruncationResult {
    const bytes = Buffer.byteLength(text, 'utf8')
    const lines = text.split('\n')

    if (bytes <= maxBytes && lines.length <= maxLines) {
        return {
            originalLength: lines.length,
            originalBytes: bytes,
            truncated: false,
            text,
        }
    }

    const headLines = Math.floor(maxLines / 2)
    const tailLines = maxLines - headLines

    const head = lines.slice(0, headLines)
    const tail = lines.slice(-tailLines)
    const omittedLines = lines.length - maxLines
    const omittedBytes = bytes - Buffer.byteLength(head.join('\n') + '\n' + tail.join('\n'), 'utf8')

    const kb = (omittedBytes / 1024).toFixed(1)
    const marker = `\n<... ${omittedLines} lines (${kb}KB) truncated ...>\n`

    return {
        originalLength: lines.length,
        originalBytes: bytes,
        truncated: true,
        text: head.join('\n') + marker + tail.join('\n'),
    }
}
