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
    branch?: string | null
    gitRef?: string | null
    issueNumber?: number | null
    lastMessage: string | null
    isPinned?: boolean
    isArchived?: boolean
    tags?: string[]
    prNumber?: number | null
    prState?: 'open' | 'closed' | 'merged' | 'draft' | null
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
    isPinned?: boolean
    tags?: string[]
    sortBy?: 'updatedAt' | 'createdAt'
    sortOrder?: 'asc' | 'desc'
    search?: string
    page?: number
    limit?: number
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

export type UpdateGeneralSettingsInput = {
    name?: string
    description?: string | null
    isStarred?: boolean
}

const buildVersionQuery = (versionId?: string | null) =>
    versionId ? `?versionId=${encodeURIComponent(versionId)}` : ''

export const sessionAPI = {
    getSessions: async (filters?: SessionFilters): Promise<PaginatedSessionsResponse> => {
        const queryParams = new URLSearchParams()
        if (filters?.type) queryParams.append('type', filters.type)
        if (filters?.isArchived !== undefined)
            queryParams.append('isArchived', filters.isArchived.toString())
        if (filters?.isPinned !== undefined)
            queryParams.append('isPinned', filters.isPinned.toString())
        if (filters?.tags && filters.tags.length > 0)
            queryParams.append('tags', filters.tags.join(','))
        if (filters?.sortBy) queryParams.append('sortBy', filters.sortBy)
        if (filters?.sortOrder) queryParams.append('sortOrder', filters.sortOrder)
        if (filters?.search) queryParams.append('search', filters.search)
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

    rehydrateSession: (sessionId: string) => {
        return apiRequest<{
            session: BackendSession
            chatMessages: BackendMessage[]
            generatedFiles: Record<string, string>
            terminalScrollback: string[]
            gitDiff?: string | null
            gitStatus?: string | null
        }>(`/session/${sessionId}/rehydrate`)
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
    }): Promise<BackendSession> => {
        const res = await apiRequest<{ session: BackendSession }>('/session', {
            method: 'POST',
            body: JSON.stringify(data),
        })
        return res.session
    },

    updateSession: async (
        id: string,
        data: { title?: string; projectId?: string }
    ): Promise<BackendSession> => {
        const res = await apiRequest<{ session: BackendSession }>(`/session/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        })
        return res.session
    },

    updateSessionSettings: async (
        id: string,
        data: { isPinned?: boolean; isArchived?: boolean; tags?: string[] }
    ): Promise<BackendSession> => {
        const res = await apiRequest<{ session: BackendSession }>(`/session/${id}/settings`, {
            method: 'PATCH',
            body: JSON.stringify(data),
        })
        return res.session
    },

    updateGeneralSettings: (sessionId: string, data: UpdateGeneralSettingsInput) => {
        return apiRequest<{ message: string }>(`/session/${sessionId}/general-settings`, {
            method: 'PATCH',
            body: JSON.stringify(data),
        })
    },

    toggleStarSession: (sessionId: string, isStarred: boolean) => {
        return apiRequest<{ message: string }>(`/session/${sessionId}/star`, {
            method: 'POST',
            body: JSON.stringify({ isStarred }),
        })
    },

    duplicateSession: (sessionId: string, name?: string) => {
        return apiRequest<BackendSession>(`/session/${sessionId}/duplicate`, {
            method: 'POST',
            body: JSON.stringify({ name }),
        })
    },

    downloadSession: async (sessionId: string, versionId?: string | null) => {
        const res = await apiFetch(
            `/session/${sessionId}/download${buildVersionQuery(versionId)}`,
            {}
        )

        if (!res.ok) {
            let payload: { message?: string; errors?: unknown } | null

            try {
                payload = await res.json()
            } catch {
                payload = null
            }

            const message =
                (typeof payload?.errors === 'string' && payload.errors) ||
                payload?.message ||
                `Request failed with status ${res.status}`

            throw new ApiError(message, res.status, payload?.errors)
        }

        return {
            blob: await res.blob(),
            fileName:
                res.headers.get('Content-Disposition')?.match(/filename="?([^";]+)"?/)?.[1] ??
                `${sessionId}.zip`,
        }
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
    duplicateProject: sessionAPI.duplicateSession,
    toggleStarProject: sessionAPI.toggleStarSession,
    downloadProject: sessionAPI.downloadSession,
}
