// Consolidated Agent Utilities

// ----------------------------------------------------
// 1. Retry Utilities (from server/src/utils/retry.ts)
// ----------------------------------------------------

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export interface RetryAsyncOptions<T> {
    label: string
    maxAttempts?: number
    initialDelayMs?: number
    maxDelayMs?: number
    task: (attempt: number, lastError: Error | null) => Promise<T>
}

export const retryAsync = async <T>(options: RetryAsyncOptions<T>) => {
    const { label, maxAttempts = 3, initialDelayMs = 250, maxDelayMs = 1500, task } = options

    let lastError: Error | null = null

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        try {
            return await task(attempt, lastError)
        } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error))

            if (attempt === maxAttempts) {
                throw new Error(
                    `${label} failed after ${maxAttempts} attempts | ${lastError.message}`,
                    { cause: lastError }
                )
            }

            const delayMs = Math.min(initialDelayMs * 2 ** (attempt - 1), maxDelayMs)
            await sleep(delayMs)
        }
    }

    throw new Error(`${label} failed without producing a result`)
}

// -------------------------------------------------------------------------
// 2. Chat Completion Text Reader (from server/src/utils/readChatCompletionText.ts)
// -------------------------------------------------------------------------

export type CompletionTextPart =
    | string
    | {
          type?: string
          text?: string
      }

export type ChatCompletionLike = {
    choices?: Array<{
        message?: {
            content?: string | CompletionTextPart[] | null
        }
    }>
}

export const readChatCompletionText = (completion: ChatCompletionLike | null | undefined) => {
    const content = completion?.choices?.[0]?.message?.content

    if (typeof content === 'string') {
        return content
    }

    if (Array.isArray(content)) {
        const text = content
            .map((part) => {
                if (typeof part === 'string') {
                    return part
                }

                return typeof part.text === 'string' ? part.text : ''
            })
            .join('')
            .trim()

        return text || null
    }

    return null
}

// -------------------------------------------------------------------------
// 3. Model JSON Parsing (from server/src/utils/parseModelJson.ts)
// -------------------------------------------------------------------------

const stripCodeFence = (content: string) => {
    const trimmed = content.trim()

    if (!trimmed.startsWith('```')) {
        return trimmed
    }

    return trimmed
        .replace(/^```json\s*/i, '')
        .replace(/\s*```$/, '')
        .trim()
}

const extractBalancedJson = (content: string) => {
    const startIndex = content.search(/[[{]/)

    if (startIndex === -1) {
        return null
    }

    const openingChar = content[startIndex]
    const closingChar = openingChar === '{' ? '}' : ']'
    let depth = 0
    let inString = false
    let isEscaped = false

    for (let index = startIndex; index < content.length; index += 1) {
        const char = content[index]

        if (inString) {
            if (isEscaped) {
                isEscaped = false
                continue
            }

            if (char === '\\') {
                isEscaped = true
                continue
            }

            if (char === '"') {
                inString = false
            }

            continue
        }

        if (char === '"') {
            inString = true
            continue
        }

        if (char === openingChar) {
            depth += 1
            continue
        }

        if (char === closingChar) {
            depth -= 1

            if (depth === 0) {
                return content.slice(startIndex, index + 1)
            }
        }
    }

    return content.slice(startIndex).trim()
}

const normalizeJsonLikeContent = (content: string) => {
    return stripCodeFence(content)
        .replace(/[\u201C\u201D]/g, '"')
        .replace(/[\u2018\u2019]/g, "'")
        .trim()
}

const escapeControlCharactersInsideStrings = (content: string) => {
    let escaped = ''
    let inString = false
    let isEscaped = false

    for (const char of content) {
        if (!inString) {
            escaped += char

            if (char === '"') {
                inString = true
            }

            continue
        }

        if (isEscaped) {
            escaped += char
            isEscaped = false
            continue
        }

        if (char === '\\') {
            escaped += char
            isEscaped = true
            continue
        }

        if (char === '"') {
            escaped += char
            inString = false
            continue
        }

        if (char === '\n') {
            escaped += '\\n'
            continue
        }

        if (char === '\r') {
            escaped += '\\r'
            continue
        }

        if (char === '\t') {
            escaped += '\\t'
            continue
        }

        escaped += char
    }

    return escaped
}

export const parseModelJson = <T>(content: string, agentName: string): T => {
    const normalizedContent = normalizeJsonLikeContent(content)
    const balancedJson = extractBalancedJson(normalizedContent)
    const parseAttempts = [
        normalizedContent,
        balancedJson,
        escapeControlCharactersInsideStrings(normalizedContent),
        balancedJson ? escapeControlCharactersInsideStrings(balancedJson) : null,
    ].filter((value): value is string => Boolean(value))

    for (const candidate of parseAttempts) {
        try {
            return JSON.parse(candidate) as T
        } catch {
            continue
        }
    }

    const preview = normalizedContent.slice(0, 300)
    throw new Error(`invalid JSON response | ${agentName} | ${preview}`)
}
