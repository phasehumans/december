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
}

export const sessionAPI = {
    getSessions: async (): Promise<BackendSession[]> => {
        const data = await apiRequest<{ sessions: BackendSession[] }>('/session')
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
}
