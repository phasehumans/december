import { apiRequest } from '@/shared/api/client'

export type BackendSession = {
    id: string
    title: string | null
    type: 'WEB' | 'CLI' | 'SEARCH'
    createdAt: string
    updatedAt: string
    projectId: string | null
    projectName: string | null
    lastMessage: string | null
    isPinned?: boolean
    isArchived?: boolean
    tags?: string[]
    prNumber?: number | null
    prState?: 'open' | 'closed' | 'merged' | 'draft' | null
    createdBy?: string | null
}

export type SessionFilters = {
    type?: 'WEB' | 'CLI' | 'SEARCH'
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

    createSession: async (data: {
        title?: string
        projectId?: string
        type?: 'WEB' | 'CLI' | 'SEARCH'
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

    getSessionInsights: async (id: string): Promise<{ insights: any[] }> => {
        return apiRequest<{ insights: any[] }>(`/session/${id}/insights`)
    },
}
