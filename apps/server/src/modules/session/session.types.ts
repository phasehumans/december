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
    page?: number
    limit?: number
    vmStatus?: string
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

export type DisconnectSession = {
    userId: string
    sessionId: string
}

export type RehydrateSession = {
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
