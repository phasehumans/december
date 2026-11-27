import { ApiError, apiFetch, apiRequest } from '@/shared/api/client'

export type BackendSession = {
    id: string
    title: string | null
    type: 'WEB' | 'SEARCH'
    createdAt: string
    updatedAt: string
    projectId?: string | null
    projectName?: string | null
    repoUrl?: string | null
    /** the owner of the repository. the list sends it apart from the name */
    githubRepoOwner?: string | null
    githubRepoName?: string | null
    /** the git host of the repository; old cached rows may not have it */
    gitProvider?: 'GITHUB' | 'GITLAB'
    branch?: string | null
    gitRef?: string | null
    issueNumber?: number | null
    lastMessage: string | null
    isArchived?: boolean
    /** pinned sessions come first in the Recent list */
    isPinned?: boolean
    /** when it was pinned. an undo of an archive sends it back to keep the pin order */
    pinnedAt?: string | null
    /** the agent asked a question and waits for an answer */
    needsAnswer?: boolean
    tags?: string[]
    prNumber?: number | null
    prState?: 'open' | 'closed' | 'merged' | 'draft' | null
    prTitle?: string | null
    prUrl?: string | null
    /** the branch the pull request was opened from */
    prBranch?: string | null
    createdBy?: string | null
    createdByName?: string | null
    vmStatus?: 'PROVISIONING' | 'RUNNING' | 'STOPPED' | 'PAUSED' | 'FAILED' | string | null
    status?: string | null
}

export type BackendSessionVersionSummary = {
    id: string
    versionNumber: number
    label: string
    sourcePrompt: string
    summary: string | null
    status: 'GENERATING' | 'READY' | 'FAILED'
    objectStoragePrefix: string
    fileCount: number
    createdAt: string
    updatedAt: string
}

export type BackendMessage = {
    id: string
    role: 'USER' | 'ASSISTANT' | 'SYSTEM'
    content: string
    blocks?: import('@/features/chat/types').MessageBlock[] | null
    status?: 'thinking' | 'building' | 'done' | 'error' | null
    sequence: number
    createdAt: string
    updatedAt: string
    /** the files sent with a user message (#634) */
    attachments?: Array<{ id: string; name: string; contentType: string; sizeBytes: number }>
}

export type BackendSessionDetail = {
    project: BackendSession & { name?: string; prompt?: string; status?: string }
    versions: BackendSessionVersionSummary[]
    selectedVersionId: string | null
    activeVersion:
        | (BackendSessionVersionSummary & {
              intent: unknown
              plan: unknown
          })
        | null
    chatMessages: BackendMessage[]
    generatedFiles: Record<string, string>
    canvasState?: unknown
}

export type SessionFilters = {
    type?: 'WEB' | 'SEARCH'
    isArchived?: boolean
    tags?: string[]
    /** 'running' matches running and starting sessions */
    vmStatus?: 'running'
    /** only sessions that opened a pull request */
    hasPr?: boolean
    /** only sessions where the agent waits for an answer */
    needsAnswer?: boolean
    /** pinned sessions first (newest pin first), then the sort */
    pinnedFirst?: boolean
    /** one repository: owner/name, or a name alone for that name under any owner */
    repoName?: string
    sortBy?: 'updatedAt' | 'createdAt'
    sortOrder?: 'asc' | 'desc'
    search?: string
    searchIn?: 'title' | 'all'
    page?: number
    limit?: number
}

/** a pin that an archive removed; an undo puts it back */
export type RemovedPin = {
    sessionId: string
    pinnedAt: string
}

/** counts for the list switches and menus, archived sessions left out */
export type SessionCounts = {
    running: number
    /** the agent asked a question and waits */
    needsAnswer: number
    /** running or waiting for an answer, each session once (Home Recent count) */
    needsYou: number
    openPullRequests: number
    /** merged and not running: what "Archive merged" archives */
    merged: number
}

/** every repository (owner/name) and tag of the user, for the sort and filter menus */
export type SessionFacets = {
    repos: string[]
    tags: string[]
}

export type PaginatedSessionsResponse = {
    sessions: BackendSession[]
    pagination?: {
        total: number
        page: number
        limit: number
        totalPages: number
    }
}

const buildVersionQuery = (versionId?: string | null) =>
    versionId ? `?versionId=${encodeURIComponent(versionId)}` : ''

export interface SessionContextUse {
    usedTokens: number
    limitTokens: number | null
    percent: number | null
    messages: number
    model: string | null
}

export interface SessionUsageTotals {
    inputTokens: number
    outputTokens: number
    totalTokens: number
    costInCents: number
    byModel: Array<{
        model: string
        billingSource: 'CREDITS' | 'OWN_KEY'
        requests: number
        totalTokens: number
        costInCents: number
    }>
}

export interface SetupCheck {
    github: { connected: boolean; appInstalled: boolean; accounts: string[] }
    gitlab: { connected: boolean; username: string | null }
    credits: { balanceInCents: number; enoughToStart: boolean }
    keys: Array<{ provider: string; keyHint: string }>
    machine: { vmStatus: string; sandboxStatus: string | null } | null
    /** the MCP servers of the account. an answer from an older server has none */
    mcpServers?: Array<{
        name: string
        enabled: boolean
        /** what the last session found: `unknown`, `connected` or `error` */
        status: string
        lastError: string | null
        toolCount: number
        checkedAt: string | null
    }>
}

export interface BackendPullRequest {
    sessionId: string
    title: string
    tags: string[]
    gitProvider: 'GITHUB' | 'GITLAB'
    /** owner/name */
    repo: string | null
    prNumber: number
    prState: 'open' | 'draft' | 'merged' | 'closed'
    prTitle: string | null
    prUrl: string | null
    prBranch: string | null
    additions: number | null
    deletions: number | null
    prOpenedAt: string | null
    prMergedAt: string | null
    prClosedAt: string | null
    /** the last change of the pull request on the host */
    prUpdatedAt: string | null
    /** the run state of the session: Running and Stop on the row */
    vmStatus?: string | null
    /** archived on merge or by hand. merged and closed rows stay listed when archived */
    isArchived?: boolean
    createdAt: string
    updatedAt: string
}

export interface PullRequestsPagination {
    page: number
    limit: number
    total: number
    totalPages: number
    /** where the next page starts, or null on the last page */
    nextCursor?: string | null
}

/** the filters, sort and page of GET /session/pull-requests */
export interface PullRequestsParams {
    /** one state or several, comma separated: "open,draft" */
    state?: string
    /** owner/name */
    repo?: string
    tag?: string
    search?: string
    sortBy?: 'updatedAt' | 'createdAt' | 'prOpenedAt' | 'prUpdatedAt'
    sortOrder?: 'asc' | 'desc'
    page?: number
    limit?: number
    /** the nextCursor of the page before */
    cursor?: string
}

export interface PullRequestsResponse {
    pullRequests: BackendPullRequest[]
    pagination: PullRequestsPagination
    /** the Open count, read with the rows; only on the first page */
    openCount?: number
}

export const sessionAPI = {
    getSessions: async (filters?: SessionFilters): Promise<PaginatedSessionsResponse> => {
        const queryParams = new URLSearchParams()
        if (filters?.type) queryParams.append('type', filters.type)
        if (filters?.isArchived !== undefined)
            queryParams.append('isArchived', filters.isArchived.toString())
        if (filters?.vmStatus) queryParams.append('vmStatus', filters.vmStatus)
        if (filters?.hasPr) queryParams.append('hasPr', 'true')
        if (filters?.needsAnswer) queryParams.append('needsAnswer', 'true')
        if (filters?.pinnedFirst) queryParams.append('pinnedFirst', 'true')
        if (filters?.repoName) queryParams.append('repoName', filters.repoName)
        if (filters?.tags && filters.tags.length > 0)
            queryParams.append('tags', filters.tags.join(','))
        if (filters?.sortBy) queryParams.append('sortBy', filters.sortBy)
        if (filters?.sortOrder) queryParams.append('sortOrder', filters.sortOrder)
        if (filters?.search) queryParams.append('search', filters.search)
        if (filters?.searchIn) queryParams.append('searchIn', filters.searchIn)
        if (filters?.page) queryParams.append('page', filters.page.toString())
        if (filters?.limit) queryParams.append('limit', filters.limit.toString())

        const queryString = queryParams.toString()
        const url = `/session${queryString ? `?${queryString}` : ''}`

        const data = await apiRequest<{ sessions: BackendSession[]; pagination?: any }>(url)
        return {
            sessions: data.sessions || [],
            pagination: data.pagination,
        }
    },

    /** AI filters from a description; applied is false when plain results should stay */
    smartSearchSessions: async (
        query: string,
        signal?: AbortSignal
    ): Promise<{ applied: boolean; sessions: BackendSession[] }> => {
        const params = new URLSearchParams({ q: query })
        return apiRequest<{ applied: boolean; sessions: BackendSession[] }>(
            `/session/smart-search?${params.toString()}`,
            { signal }
        )
    },

    getSession: async (id: string): Promise<BackendSession> => {
        const data = await apiRequest<{ session: BackendSession }>(`/session/${id}`)
        return data.session
    },

    getSessionMessages: async (
        sessionId: string,
        params?: { beforeSequence?: number; limit?: number }
    ): Promise<BackendMessage[]> => {
        const queryParams = new URLSearchParams()
        if (params?.beforeSequence !== undefined)
            queryParams.append('beforeSequence', params.beforeSequence.toString())
        if (params?.limit !== undefined) queryParams.append('limit', params.limit.toString())
        const qs = queryParams.toString()
        const data = await apiRequest<{ messages: BackendMessage[] }>(
            `/session/${sessionId}/messages${qs ? `?${qs}` : ''}`
        )
        return data.messages || []
    },

    getSessionDetail: (sessionId: string, versionId?: string | null) => {
        return apiRequest<BackendSessionDetail>(
            `/session/${sessionId}${buildVersionQuery(versionId)}`
        )
    },

    getSessionDiff: async (sessionId: string): Promise<{ gitStatus: string; gitDiff: string }> => {
        const data = await apiRequest<{ gitStatus: string; gitDiff: string }>(
            `/session/${sessionId}/diff`
        )
        return data || { gitStatus: '', gitDiff: '' }
    },

    getSessionPullRequests: async (sessionId: string): Promise<{ pullRequest: any | null }> => {
        const data = await apiRequest<{ pullRequest: any | null }>(
            `/session/${sessionId}/pull-requests`
        )
        return data || { pullRequest: null }
    },

    getSessionPlan: async (sessionId: string): Promise<{ plan: any | null }> => {
        const data = await apiRequest<{ plan: any | null }>(`/session/${sessionId}/plan`)
        return data || { plan: null }
    },

    getSessionTests: async (
        sessionId: string
    ): Promise<import('@/features/preview/types').SessionTestReport | null> => {
        const data = await apiRequest<import('@/features/preview/types').SessionTestReport | null>(
            `/session/${sessionId}/tests`
        )
        return data || null
    },

    getSessionPreviewPort: async (
        sessionId: string
    ): Promise<{ port: number | null; ports: number[]; previewUrl: string | null }> => {
        const data = await apiRequest<{
            port: number | null
            ports: number[]
            previewUrl: string | null
        }>(`/session/${sessionId}/preview-port`)
        return data || { port: null, ports: [], previewUrl: null }
    },

    getSessionDesktopViewport: async (
        sessionId: string
    ): Promise<import('@/features/preview/types').BrowserViewportData | null> => {
        const data = await apiRequest<{
            viewport: import('@/features/preview/types').BrowserViewportData | null
        } | null>(`/session/${sessionId}/desktop-viewport`)
        return data?.viewport ?? null
    },

    submitQuestionAnswer: async (data: {
        sessionId: string
        questionId?: string
        answer: string | string[]
    }): Promise<{ success: boolean }> => {
        const res = await apiRequest<{ success: boolean }>(
            `/session/${data.sessionId}/question-answer`,
            {
                method: 'POST',
                body: JSON.stringify({
                    questionId: data.questionId,
                    answer: data.answer,
                }),
            }
        )
        return res || { success: false }
    },

    getPendingQuestion: async (sessionId: string): Promise<any | null> => {
        const data = await apiRequest<any | null>(`/session/${sessionId}/pending-question`)
        return data || null
    },

    createSession: async (data: {
        title?: string
        projectId?: string
        type?: 'WEB' | 'SEARCH'
        prompt?: string
        repoUrl?: string
        branch?: string
        gitRef?: string
        issueNumber?: number
        billingSource?: 'CREDITS' | 'OWN_KEY'
        provider?: string
        model?: string
        tier?: 'fast' | 'deep'
        planFirst?: boolean
        effort?: 'fast' | 'deep'
        openPullRequest?: boolean
        /** plugins and MCP servers switched off for this session only */
        disabledPlugins?: string[]
        disabledMcps?: string[]
    }): Promise<BackendSession> => {
        const res = await apiRequest<{ session: BackendSession }>('/session', {
            method: 'POST',
            body: JSON.stringify(data),
        })
        return res.session
    },

    renameSession: async (id: string, title: string): Promise<BackendSession> => {
        const res = await apiRequest<{ session: BackendSession }>(`/session/${id}/rename`, {
            method: 'PATCH',
            body: JSON.stringify({ title }),
        })
        return res.session
    },

    archiveSession: async (id: string): Promise<BackendSession> => {
        const res = await apiRequest<{ session: BackendSession }>(`/session/${id}/archive`, {
            method: 'PATCH',
        })
        return res.session
    },

    unarchiveSession: async (id: string): Promise<BackendSession> => {
        const res = await apiRequest<{ session: BackendSession }>(`/session/${id}/unarchive`, {
            method: 'PATCH',
        })
        return res.session
    },

    pinSession: async (id: string): Promise<BackendSession> => {
        const res = await apiRequest<{ session: BackendSession }>(`/session/${id}/pin`, {
            method: 'PATCH',
        })
        return res.session
    },

    unpinSession: async (id: string): Promise<BackendSession> => {
        const res = await apiRequest<{ session: BackendSession }>(`/session/${id}/unpin`, {
            method: 'PATCH',
        })
        return res.session
    },

    /** archives every merged, not running session; the ids and pins are for the undo */
    archiveMergedSessions: (): Promise<{ sessionIds: string[]; pins: RemovedPin[] }> =>
        apiRequest<{ sessionIds: string[]; pins: RemovedPin[] }>('/session/archive-merged', {
            method: 'POST',
        }),

    /** the undo of an archive: unarchives the sessions and puts their pins back */
    unarchiveSessions: (
        sessionIds: string[],
        pins?: RemovedPin[]
    ): Promise<{ sessionIds: string[] }> =>
        apiRequest<{ sessionIds: string[] }>('/session/unarchive', {
            method: 'POST',
            body: JSON.stringify({ sessionIds, pins }),
        }),

    getSessionCounts: (): Promise<SessionCounts> => apiRequest<SessionCounts>('/session/counts'),

    /** hasPr: only from the sessions that opened a pull request */
    getSessionFacets: (options?: { hasPr?: boolean }): Promise<SessionFacets> =>
        apiRequest<SessionFacets>(`/session/facets${options?.hasPr ? '?hasPr=true' : ''}`),

    // the slash commands of a session (#632 section 3)
    getContext: (id: string) => apiRequest<SessionContextUse>(`/session/${id}/context`),
    compactSession: (id: string, focus?: string) =>
        apiRequest<{ summary: string; sequence: number; context: SessionContextUse }>(
            `/session/${id}/compact`,
            { method: 'POST', body: JSON.stringify(focus ? { focus } : {}) }
        ),
    clearSession: (id: string) =>
        apiRequest<{ contextStartSequence: number }>(`/session/${id}/clear`, { method: 'POST' }),
    forkSession: (id: string) =>
        apiRequest<{ session: BackendSession }>(`/session/${id}/fork`, { method: 'POST' }),
    getTurns: (id: string) =>
        apiRequest<{ turns: Array<{ sequence: number; prompt: string; createdAt: string }> }>(
            `/session/${id}/turns`
        ),
    rewindSession: (id: string, sequence: number) =>
        apiRequest<{ prompt: string; filesRestored: boolean; filesNote: string | null }>(
            `/session/${id}/rewind`,
            { method: 'POST', body: JSON.stringify({ sequence }) }
        ),
    askSideQuestion: (id: string, question: string) =>
        apiRequest<{ answer: string }>(`/session/${id}/btw`, {
            method: 'POST',
            body: JSON.stringify({ question }),
        }),
    generateTitle: (id: string) =>
        apiRequest<{ title: string }>(`/session/${id}/title`, { method: 'POST' }),
    searchCode: (id: string, query: string) =>
        apiRequest<{ matches: Array<{ path: string; line: number; preview: string }> }>(
            `/session/${id}/code-search?q=${encodeURIComponent(query)}`
        ),
    getTasks: (id: string) =>
        apiRequest<{ tasks: Array<{ pid: number; elapsedSeconds: number; command: string }> }>(
            `/session/${id}/tasks`
        ),
    getSessionUsage: (id: string) => apiRequest<SessionUsageTotals>(`/session/${id}/usage`),
    getCheck: (sessionId?: string) =>
        apiRequest<SetupCheck>(
            `/session/check${sessionId ? `?sessionId=${encodeURIComponent(sessionId)}` : ''}`
        ),

    // the pull requests list (#632): one row per session that opened a pull request
    getPullRequests: (params: PullRequestsParams): Promise<PullRequestsResponse> => {
        const query = new URLSearchParams()
        for (const [key, value] of Object.entries(params)) {
            if (value !== undefined && value !== '') query.set(key, String(value))
        }
        return apiRequest(`/session/pull-requests?${query.toString()}`)
    },

    updateSessionTags: async (id: string, tags: string[]): Promise<BackendSession> => {
        const res = await apiRequest<{ session: BackendSession }>(`/session/${id}/tags`, {
            method: 'PUT',
            body: JSON.stringify({ tags }),
        })
        return res.session
    },

    deleteSession: async (id: string): Promise<void> => {
        await apiRequest<void>(`/session/${id}`, {
            method: 'DELETE',
        })
    },

    // every session of the user, after the sandboxes stop (#636). the server checks the confirm
    deleteAllSessions: async () =>
        apiRequest<{ deleted: number; sandboxesStopped: number }>('/session', {
            method: 'DELETE',
            body: JSON.stringify({ confirm: 'delete' }),
        }),

    streamSearch: async (
        sessionId: string,
        payload: {
            prompt: string
            messageHistory?: Array<{
                role: 'user' | 'assistant' | 'system'
                content: string
            }>
        },
        options?: {
            signal?: AbortSignal
            onToken?: (token: string) => void
            onThought?: (thought: string) => void
            onDone?: (data: {
                inputTokens: number
                outputTokens: number
                totalTokens: number
                costInCents: number
            }) => void
            onError?: (error: string) => void
        }
    ): Promise<void> => {
        const response = await apiFetch(`/session/${sessionId}/search/stream`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
            signal: options?.signal,
        })

        if (!response.ok) {
            let errorMsg = 'Failed to stream search response'
            try {
                const errorJson = await response.json()
                errorMsg = errorJson.message || errorJson.error || errorMsg
            } catch {
                // Intentionally swallowed: fallback to status text
            }
            throw new ApiError(errorMsg, response.status)
        }

        if (!response.body) return

        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''

        try {
            while (true) {
                const { done, value } = await reader.read()
                if (done) break

                buffer += decoder.decode(value, { stream: true })
                const parts = buffer.split('\n\n')
                buffer = parts.pop() || ''

                for (const part of parts) {
                    const lines = part.split('\n')
                    let eventName = 'token'
                    let dataStr = ''

                    for (const line of lines) {
                        if (line.startsWith('event:')) {
                            eventName = line.slice('event:'.length).trim()
                        } else if (line.startsWith('data:')) {
                            dataStr = line.slice('data:'.length).trim()
                        }
                    }

                    if (!dataStr) continue

                    try {
                        const dataObj = JSON.parse(dataStr)
                        if (eventName === 'token') {
                            options?.onToken?.(dataObj.token || dataObj.text || '')
                        } else if (eventName === 'thought') {
                            options?.onThought?.(dataObj.thought || dataObj.text || '')
                        } else if (eventName === 'done') {
                            options?.onDone?.(dataObj)
                        } else if (eventName === 'error') {
                            options?.onError?.(dataObj.message || dataObj.error || 'Stream error')
                        }
                    } catch {
                        // Intentionally swallowed: parsing malformed SSE chunk
                    }
                }
            }
        } finally {
            reader.releaseLock()
        }
    },
}

// Backward-compatibility aliases during migration
export type BackendProject = BackendSession & {
    name?: string
    prompt?: string
    isStarred?: boolean
    projectStatus?: any
}
export type BackendProjectVersionSummary = BackendSessionVersionSummary
export type BackendProjectDetail = BackendSessionDetail
export const projectAPI = {
    ...sessionAPI,
    getProjects: async () => {
        const res = await sessionAPI.getSessions()
        return res.sessions as unknown as BackendProject[]
    },
    getProject: sessionAPI.getSessionDetail,
    createProject: async (data: { name: string; description?: string; prompt: string }) => {
        return sessionAPI.createSession({
            title: data.name,
            prompt: data.prompt,
        }) as unknown as Promise<BackendProject>
    },
    updateProject: (id: string, data: { rename: string }) =>
        sessionAPI.renameSession(id, data.rename),
    deleteProject: sessionAPI.deleteSession,
}
