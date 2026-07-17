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
}

export type SessionFilters = {
    type?: 'WEB' | 'CLI' | 'SEARCH'
    isArchived?: boolean
    isPinned?: boolean
    tags?: string[]
    sortBy?: 'updatedAt' | 'createdAt'
    sortOrder?: 'asc' | 'desc'
}

export const sessionAPI = {
    getSessions: async (filters?: SessionFilters): Promise<BackendSession[]> => {
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

        const queryString = queryParams.toString()
        const url = `/session${queryString ? `?${queryString}` : ''}`

        const data = await apiRequest<{ sessions: BackendSession[] }>(url)
        return data.sessions
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
}
