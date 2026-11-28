import { apiRequest } from '@/shared/api/client'

// what the agent remembers across cloud sessions (connections, memory tab). server module: memory

export type ApiMemory = {
    id: string
    content: string
    /** agent: saved by a session; user: added on the memory tab */
    source: 'agent' | 'user'
    sessionId: string | null
    sessionTitle: string | null
    createdAt: string
    updatedAt: string
}

export type MemoryList = {
    /** the agent reads and saves memories while this is on */
    enabled: boolean
    /** newest first */
    memories: ApiMemory[]
}

const memoryPath = (id: string) => `/connections/memory/${encodeURIComponent(id)}`

const listMemories = () => apiRequest<MemoryList>('/connections/memory')

const setMemoryEnabled = (enabled: boolean) =>
    apiRequest<{ enabled: boolean }>('/connections/memory/settings', {
        method: 'PUT',
        body: JSON.stringify({ enabled }),
    })

const addMemory = async (content: string) => {
    const data = await apiRequest<{ memory: ApiMemory }>('/connections/memory', {
        method: 'POST',
        body: JSON.stringify({ content }),
    })
    return data.memory
}

const updateMemory = async (id: string, content: string) => {
    const data = await apiRequest<{ memory: ApiMemory }>(memoryPath(id), {
        method: 'PATCH',
        body: JSON.stringify({ content }),
    })
    return data.memory
}

const deleteMemory = (id: string) =>
    apiRequest<{ deleted: boolean }>(memoryPath(id), { method: 'DELETE' })

const deleteAllMemories = () =>
    apiRequest<{ deleted: number }>('/connections/memory', { method: 'DELETE' })

export const memoryAPI = {
    listMemories,
    setMemoryEnabled,
    addMemory,
    updateMemory,
    deleteMemory,
    deleteAllMemories,
}
