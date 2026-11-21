import type { LLMProvider } from '@december/providers'
import type { AgentMessage } from '@december/shared'

/**
 * how a session got its title. the order is also the priority:
 * a `manual` title is never replaced by an automatic one, and a `prompt`
 * title (cut from the first prompt) is upgraded to an `auto` (llm) title once.
 */
export type SessionTitleSource = 'prompt' | 'auto' | 'manual'

export interface SessionMeta {
    title?: string
    titleSource?: SessionTitleSource
}

export const MAX_SESSION_TITLE_LENGTH = 80
const PROMPT_TITLE_LENGTH = 50
const TRANSCRIPT_CHAR_BUDGET = 2400
const TITLE_TIMEOUT_MS = 15_000

const TITLE_SYSTEM_PROMPT = `You name coding sessions. Read the conversation and reply with one short title of 3 to 6 words that says what the session is about.

Rules:
- Reply with the title only. No quotes, no markdown, no trailing period.
- Use sentence case, for example: Fix rewind snapshot ordering
- Prefer concrete nouns from the conversation (files, features, bugs) over generic words like "help" or "question".`

/** replaces ascii control characters (newlines, tabs, escapes) with spaces */
function replaceControlChars(raw: string): string {
    let out = ''
    for (const ch of raw) {
        const code = ch.charCodeAt(0)
        out += code < 32 || code === 127 ? ' ' : ch
    }
    return out
}

function stripMarkup(raw: string): string {
    return replaceControlChars(raw)
        .replace(/<context_file[^>]*>[\s\S]*?<\/context_file>/gi, ' ')
        .replace(/<piped_stdin>[\s\S]*?<\/piped_stdin>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/```[\s\S]*?```/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
}

function truncateAtWord(text: string, max: number): string {
    if (text.length <= max) return text
    const cut = text.slice(0, max)
    const lastSpace = cut.lastIndexOf(' ')
    const base = lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut
    return `${base.replace(/[\s,.;:!?-]+$/, '')}...`
}

/**
 * cleans a title that a person typed (for /rename or the /resume picker).
 * returns an empty string when nothing usable is left.
 */
export function normalizeSessionTitle(raw: string): string {
    const cleaned = replaceControlChars(raw || '')
        .replace(/\s+/g, ' ')
        .trim()
    return cleaned.length > MAX_SESSION_TITLE_LENGTH
        ? truncateAtWord(cleaned, MAX_SESSION_TITLE_LENGTH)
        : cleaned
}

/**
 * instant, offline title from the first prompt. used until the llm title
 * arrives, and kept when the llm call fails.
 */
export function deriveTitleFromPrompt(prompt: string): string {
    const text = stripMarkup(prompt || '')
    if (!text) return ''
    return truncateAtWord(text, PROMPT_TITLE_LENGTH)
}

/**
 * cleans raw model output into a title. models sometimes add a label,
 * quotes, markdown, or a second line, so this keeps only the title itself.
 */
export function cleanGeneratedTitle(raw: string): string {
    const firstLine =
        (raw || '')
            .replace(/<think(?:ing)?>[\s\S]*?<\/think(?:ing)?>/gi, '')
            .split('\n')
            .map((l) => l.trim())
            .find((l) => l.length > 0) || ''
    const cleaned = firstLine
        .replace(/^#+\s*/, '')
        .replace(/^(session\s+)?title\s*:\s*/i, '')
        .replace(/^[*_`"'“‘]+|[*_`"'”’]+$/g, '')
        .replace(/[.!]+$/, '')
        .trim()
    return normalizeSessionTitle(cleaned)
}

function messageText(msg: AgentMessage): string {
    const content: unknown = (msg as any).content
    if (typeof content === 'string') return content
    if (Array.isArray(content)) {
        return content
            .map((part: any) => (typeof part === 'string' ? part : part?.text || ''))
            .join(' ')
    }
    return ''
}

/**
 * builds a short transcript of the user and assistant text (no tool output),
 * shared fairly between the start of the session and its latest turns.
 */
export function buildTitleTranscript(messages: AgentMessage[]): string {
    const lines: string[] = []
    for (const msg of messages) {
        if (msg.role !== 'user' && msg.role !== 'assistant') continue
        const text = stripMarkup(messageText(msg))
        if (!text) continue
        lines.push(`${msg.role === 'user' ? 'User' : 'Assistant'}: ${text.slice(0, 600)}`)
    }
    const full = lines.join('\n')
    if (full.length <= TRANSCRIPT_CHAR_BUDGET) return full
    const half = Math.floor(TRANSCRIPT_CHAR_BUDGET / 2)
    return `${full.slice(0, half)}\n...\n${full.slice(-half)}`
}

export interface GenerateSessionTitleData {
    llm: LLMProvider
    messages: AgentMessage[]
    modelOptions?: Record<string, any>
    signal?: AbortSignal
}

/**
 * asks the session's own model for a short title. returns an empty string
 * when there is nothing to name or the call fails, so callers can keep
 * their fallback title.
 */
export async function generateSessionTitle(data: GenerateSessionTitleData): Promise<string> {
    const { llm, messages, modelOptions, signal } = data
    const transcript = buildTitleTranscript(messages)
    if (!transcript) return ''

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), TITLE_TIMEOUT_MS)
    const onParentAbort = () => controller.abort()
    signal?.addEventListener('abort', onParentAbort, { once: true })

    try {
        const stream = llm.stream(
            [{ role: 'user', content: `Conversation:\n${transcript}\n\nTitle:` }],
            undefined,
            TITLE_SYSTEM_PROMPT,
            { ...modelOptions, thinkingLevel: 'off' },
            controller.signal
        )
        let raw = ''
        for await (const chunk of stream) {
            if (controller.signal.aborted) break
            if (chunk.type === 'text') {
                raw += chunk.text
                if (raw.length > 400) break
            }
        }
        return cleanGeneratedTitle(raw)
    } catch {
        // Intentionally swallowed: the caller keeps its fallback title
        return ''
    } finally {
        clearTimeout(timer)
        signal?.removeEventListener('abort', onParentAbort)
    }
}
