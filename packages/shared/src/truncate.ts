import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

export const DEFAULT_MAX_BYTES = 10_000
export const DEFAULT_MAX_LINES = 200

export interface TruncationResult {
    originalLength: number
    originalBytes: number
    truncated: boolean
    text: string
    spillPath?: string
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

    let spillPath: string | undefined
    try {
        spillPath = path.join(
            os.tmpdir(),
            `december-output-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.log`
        )
        fs.writeFileSync(spillPath, text, 'utf8')
    } catch {
        // Intentionally swallowed: spill file creation fallback handled
    }

    const kb = (omittedBytes / 1024).toFixed(1)
    const spillNotice = spillPath ? ` Full output spilled to ${spillPath}.` : ''
    const marker = `\n<... ${omittedLines} lines (${kb}KB) truncated.${spillNotice} ...>\n`

    return {
        originalLength: lines.length,
        originalBytes: bytes,
        truncated: true,
        text: head.join('\n') + marker + tail.join('\n'),
        spillPath,
    }
}
