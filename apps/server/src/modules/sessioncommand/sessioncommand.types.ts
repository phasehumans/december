/** the session commands the web runs from the slash menu (#632 section 3) */

export type SessionRef = {
    userId: string
    sessionId: string
}

export type CompactSession = SessionRef & {
    /** what the summary should keep, from `/compact <focus>` */
    focus?: string
}

export type RewindSession = SessionRef & {
    /** the user message to go back to: it and everything after it are removed */
    sequence: number
}

export type AskSideQuestion = SessionRef & {
    question: string
}

export type SearchSessionCode = SessionRef & {
    query: string
}

export type GetCheck = {
    userId: string
    sessionId?: string
}

export type StartReview = {
    userId: string
    url: string
}

export type RunCommandPrompt = {
    userId: string
    system: string
    prompt: string
    /** the usage kind, one daily usage row per kind */
    kind: string
    maxOutputChars?: number
}

export type ContextUsage = {
    usedTokens: number
    limitTokens: number | null
    percent: number | null
    messages: number
    model: string | null
}

export type CodeSearchMatch = {
    path: string
    line: number
    preview: string
}

export type SandboxTask = {
    pid: number
    /** seconds since the process started */
    elapsedSeconds: number
    command: string
}
