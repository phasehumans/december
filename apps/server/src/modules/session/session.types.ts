import type { SessionEffort, SessionRunConfig, SessionSwitches } from '@december/shared'

export type StoredSessionFile = {
    path: string
    key: string
    contentType?: string
    size: number
}

export type SessionFilters = {
    type?: 'WEB' | 'SEARCH'
    isArchived?: boolean
    tags?: string[]
    sortBy?: 'updatedAt' | 'createdAt'
    sortOrder?: 'asc' | 'desc'
    search?: string
    searchIn?: 'title' | 'all'
    /** title contains any of these words (AI search filters) */
    titleAny?: string[]
    updatedAfter?: Date
    /** GitHub repo name, matched without case */
    repoName?: string
    page?: number
    limit?: number
    vmStatus?: string
    /** only sessions that opened a pull request */
    hasPr?: boolean
    /** pinned sessions first (newest pin first), then the asked sort */
    pinnedFirst?: boolean
    /** only sessions where the agent waits for an answer */
    needsAnswer?: boolean
}

export type PullRequestFilters = {
    /** the states to keep; 'open' also matches a row with no saved state */
    states?: Array<'open' | 'draft' | 'merged' | 'closed'>
    isArchived?: boolean
    /** owner/name, or a name alone */
    repo?: string
    tag?: string
    search?: string
    sortBy?: 'updatedAt' | 'createdAt' | 'prOpenedAt'
    sortOrder?: 'asc' | 'desc'
    page?: number
    limit?: number
}

export type GetPullRequests = {
    userId: string
    filters: PullRequestFilters
}

export type RefreshStalePullRequests = {
    userId: string
}

export type ApplyPullRequestEvent = {
    gitProvider: 'GITHUB' | 'GITLAB'
    repoOwner: string
    repoName: string
    number: number
    state: 'open' | 'draft' | 'merged' | 'closed'
    title?: string
    additions?: number
    deletions?: number
    openedAt?: string | null
    mergedAt?: string | null
    closedAt?: string | null
}

export type GetUserSessions = {
    userId: string
    filters?: SessionFilters
}

export type CreateSession = {
    userId: string
    title?: string
    type?: 'WEB' | 'SEARCH'
    prompt?: string
    projectId?: string
    repoUrl?: string
    branch?: string
    gitRef?: string
    issueNumber?: number
    maxConcurrentSessions?: number
    billingSource?: 'CREDITS' | 'OWN_KEY'
    provider?: string
    model?: string
    tier?: SessionEffort
    planFirst?: boolean
    effort?: SessionEffort
    openPullRequest?: boolean
    disabledPlugins?: string[]
    disabledMcps?: string[]
}

export type ResolveTurnConfig = {
    /** empty for a socket that is not signed in: the default config is used */
    userId?: string
    sessionId: string
    billingSource: 'CREDITS' | 'OWN_KEY'
    model?: string
    provider?: string
    tier?: SessionEffort
    /** sent with a message: changes the session for this turn and the next ones */
    planFirst?: boolean
    effort?: SessionEffort
    /** the + menu switches; a list sent with a message replaces the saved one */
    disabledPlugins?: string[]
    disabledMcps?: string[]
}

export type RecordUserPrompt = {
    userId?: string
    sessionId: string
    prompt: string
}

export type GetUserRunDefaults = {
    userId: string
}

export type TurnConfig = SessionRunConfig &
    SessionSwitches & {
        model?: string
        provider?: string
    }

export type GetSession = {
    userId: string
    sessionId: string
}

export type RenameSession = {
    userId: string
    sessionId: string
    title: string
}

export type ArchiveSession = {
    userId: string
    sessionId: string
}

export type UnarchiveSession = {
    userId: string
    sessionId: string
}

export type PinSession = {
    userId: string
    sessionId: string
}

export type UnpinSession = {
    userId: string
    sessionId: string
}

export type ArchiveMergedSessions = {
    userId: string
}

/** a pin that archive removed, so an undo can put it back in its old place */
export type RemovedPin = {
    sessionId: string
    pinnedAt: Date
}

export type UnarchiveSessions = {
    userId: string
    sessionIds: string[]
    /** pins to bring back with the undo, from archive merged or from the list row */
    pins?: RemovedPin[]
}

export type GetSessionCounts = {
    userId: string
}

export type SessionCounts = {
    running: number
    openPullRequests: number
    merged: number
}

export type UpdateSessionTags = {
    userId: string
    sessionId: string
    tags: string[]
}

export type GetSessionMessages = {
    userId: string
    sessionId: string
    beforeSequence?: number
    limit?: number
}

export type DeleteSession = {
    userId: string
    sessionId: string
}

export type DeleteAllSessions = {
    userId: string
}

export type EndSessionRuns = {
    sessionIds: string[]
}

export type DisconnectSession = {
    userId: string
    sessionId: string
}

export type RehydrateSession = {
    userId: string
    sessionId: string
}

export type TouchPreviewActivity = {
    sessionId: string
}

export type RecordPreviewActivity = {
    userId: string
    sessionId: string
}

export type ProxyPreview = {
    userId: string
    sessionId: string
    port: number
    reqPath?: string
}

export type LoadSessionFiles = {
    sessionId: string
    userId?: string
}

export type SmartSearchSessions = {
    userId: string
    query: string
    signal?: AbortSignal
}

/** filters the model returns for a typed description, checked by smartSearchFiltersSchema */
export type SmartSearchFilters = {
    topic: string[]
    updatedWithinDays: number | null
    repo: string | null
    running: boolean
    archived: boolean
    sort: 'newest' | 'oldest'
}

export type BuildSmartSearchPrompt = {
    today: Date
    repoNames: string[]
}

export type StreamSearchResponse = {
    userId: string
    sessionId: string
    prompt: string
    messageHistory?: Array<{
        role: 'user' | 'assistant' | 'system'
        content: string
    }>
    res: import('express').Response
    signal?: AbortSignal
}

export type GetSessionDiff = {
    userId: string
    sessionId: string
}

export type GetSessionFileTree = {
    userId: string
    sessionId: string
}

export type GetSessionFileContent = {
    userId: string
    sessionId: string
    path: string
}

export type GetSessionPullRequests = {
    userId: string
    sessionId: string
}

export type GetSessionPlan = {
    userId: string
    sessionId: string
}

export type SessionPullRequest = {
    prNumber?: number
    url?: string
    title: string
    state: string
    headRef: string
    baseRef: string
    diffSummary: {
        additions: number
        deletions: number
        changedFiles: number
    }
    ciStatus: 'passing' | 'pending' | 'failed'
    createdAt?: string
    updatedAt?: string
}

export interface GetSessionTests {
    userId: string
    sessionId: string
}

export interface GetSessionPreviewPort {
    userId: string
    sessionId: string
}

export interface SessionPreviewPortResult {
    sessionId: string
    port: number | null
    ports: number[]
    previewUrl: string | null
}

export interface SubmitQuestionAnswer {
    userId: string
    sessionId: string
    questionId?: string
    answer: string | string[]
}

export interface MarkQuestionAsked {
    sessionId: string
}

export interface ClearPendingQuestion {
    userId: string
    sessionId: string
}

export interface GetPendingQuestion {
    userId: string
    sessionId: string
}

export interface GetSessionDesktopViewport {
    userId: string
    sessionId: string
}

export interface SessionDesktopViewportResult {
    viewport: {
        url?: string
        title?: string
        action?: string
        screenshot?: string
        screenshotPath?: string
        consoleErrors?: string[]
        networkErrors?: string[]
        timestamp?: number
    } | null
}

/** one event of a run, relayed from the worker by socket.ts (#636) */
export type HandleRunEvent = {
    sessionId: string
    event: { type?: string; error?: unknown; balanceInCents?: unknown }
}

export type NotifySessionOwner = {
    owner: { id: string; userId: string; title: string | null }
    kind: 'SESSION_FINISHED' | 'SESSION_NEEDS_INPUT' | 'SESSION_FAILED' | 'LOW_CREDITS'
    detail?: string
}
