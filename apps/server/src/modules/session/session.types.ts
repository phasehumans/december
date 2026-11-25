import type {
    SessionEffort,
    SessionRunConfig,
    SessionSwitches,
    SpendLimitKind,
} from '@december/shared'

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
    /** one repository, matched without case: `owner/name`, or a name alone (any owner) */
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
    /** not sent: an open or draft pull request of an archived session is left out */
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

/** what a new prompt does (#637): start a run, reach the running agent, or wait in the web */
export type PromptRoute = 'run' | 'steer' | 'queued'

/** the account preference `messageWhileWorking` */
export type MessageWhileWorking = 'queue' | 'send'

export type DecidePromptRoute = {
    runActive: boolean
    mode: MessageWhileWorking
}

export type RoutePrompt = {
    userId?: string
    sessionId: string
}

/** what a prompt does, and the id of the run it claimed when it starts one */
export type RoutedPrompt = {
    route: PromptRoute
    runId: string | null
}

/** `run`: the run ended in between, and this message claimed a new one */
export type SteeringDelivery =
    | { delivery: 'steered'; runId: null }
    | { delivery: 'run'; runId: string }

/** a message for the running agent, as the worker reads it (run-steering.ts) */
export type SteeringMessage = {
    prompt: string
    userMessageSequence?: number
    attachments?: unknown[]
    skills?: string[]
    clientMessageId?: string
}

export type DeliverSteering = {
    sessionId: string
    message: SteeringMessage
}

export type ClaimSessionRun = {
    sessionId: string
}

export type ReleaseRun = {
    sessionId: string
    /** the run that was claimed and not queued */
    runId: string
}

export type GetUserRunDefaults = {
    userId: string
}

export type ResolveOwnKeyModel = {
    userId: string
    provider?: string
    model?: string
}

export type ResolveOwnKeyTurnModel = {
    userId: string
    sessionId: string
    provider?: string
    model?: string
}

/** the model of a session on the user's own key. empty when the request named none */
export type OwnKeyModel = {
    provider?: string
    model?: string
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

/** the repository filter of the list, split: owner is null for a name alone */
export type RepoFilter = {
    owner: string | null
    name: string
}

export type GetSessionFacets = {
    userId: string
    /** only sessions that opened a pull request (the Pull requests page) */
    hasPr?: boolean
}

/** the user's repositories (`owner/name` when the owner is known) and tags, for the menus */
export type SessionFacets = {
    repos: string[]
    tags: string[]
}

/** one spelling of a repository on the user's sessions, as the facets query reads it */
export type SessionFacetRepoRow = {
    githubRepoOwner: string | null
    githubRepoName: string | null
    /** only for an old row that has no saved name */
    repoUrl: string | null
    /** how many sessions have this spelling */
    sessions: number
}

export type SessionFacetRows = {
    repos: SessionFacetRepoRow[]
    tags: string[]
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

/** a socket event names a session: the id comes from the client, so it can be anything */
export interface OwnsSession {
    userId?: string | null
    sessionId: unknown
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
    event: {
        type?: string
        error?: unknown
        balanceInCents?: unknown
        /** on AgentEnd: the run failed (the worker sent an AgentError before it) */
        failed?: unknown
        /** on AgentEnd: the run was stopped (#637), with the reason ('user' | 'limit') */
        stopped?: unknown
        reason?: unknown
        /** on SpendLimitReached (#638): the limit the charge or the start reached */
        kind?: unknown
    }
}

// spend limits (#638)
export type PauseAtLimit = {
    sessionId: string
}

export type AnswerLimitQuestion = {
    userId: string
    sessionId: string
    /** the id of the question card. an answer to another card is not for the limit question */
    questionId?: string
    answer: string | string[]
}

/** what a held run adds to the run of a new prompt (the held text is in the history) */
export type HeldRunParts = {
    attachments: unknown[]
    skills: string[]
}

export type MergeHeldRun = {
    /** the held run that the new prompt replaces, or null */
    heldRun: HeldRunParts | null
    /** the files and skills of the new prompt */
    attachments: unknown[]
    skills: string[]
}

export type ContinueAtLimit = {
    userId: string
    sessionId: string
    kind: SpendLimitKind
    /** the run that was held before it started; none when a running session was paused */
    heldRun: Record<string, unknown> | null
}

export type PromptAtLimit = {
    /** empty for a socket that is not signed in */
    userId?: string
    sessionId: string
    billingSource: 'CREDITS' | 'OWN_KEY'
}

export type InvalidateRecentSessions = {
    userId: string
}

/** what the limit question is made from */
export type ToLimitQuestionPrompt = {
    sessionId: string
    kind: SpendLimitKind
    limitCents: number
}

/** the limit question, in the shape of the agent's question (AskQuestionPrompt) */
export type LimitQuestionPrompt = {
    type: 'AskQuestionPrompt'
    source: 'spend-limit'
    kind: SpendLimitKind
    sessionId: string
    questionId: string
    questions: Array<{ question: string; options: string[] }>
}

export type IsUserWatchingSession = {
    sessionId: string
    userId: string
}

export type NotifySessionOwner = {
    owner: { id: string; userId: string; title: string | null }
    kind:
        | 'SESSION_FINISHED'
        | 'SESSION_NEEDS_INPUT'
        | 'SESSION_FAILED'
        | 'LOW_CREDITS'
        | 'SPEND_LIMIT'
    detail?: string
}

/** who asks for the stop of a run (#637): the user (stop button) or a spend limit */
export type RunStopReason = 'user' | 'limit'

export type RequestRunStop = {
    sessionId: string
    /** the owner of the session */
    userId: string
    reason: RunStopReason
}

export type StopSession = {
    userId: string
    sessionId: string
}

/**
 * The state the stop leads to. The worker saves it a moment later, when the run has ended
 * and the sandbox is paused.
 */
export type StopSessionResult = {
    sessionId: string
    vmStatus: string
    sandboxStatus: string | null
}

export type GetRunningSandboxes = {
    userId: string
}

/** one row of the "running now" list of the sandbox settings (#637) */
export type RunningSandbox = {
    sessionId: string
    title: string | null
    /** `owner/name`, null for a session with no repository */
    repoFullName: string | null
    /** when the sandbox last started or resumed; the start of the session when not saved */
    startedAt: Date
    /** the session's cost so far on december credits */
    costInCents: number
    sandboxStatus: 'STARTING' | 'RUNNING'
}
