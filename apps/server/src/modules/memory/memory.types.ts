/** what the agent remembers across cloud sessions (connections, memory tab) */

export type UserRef = {
    userId: string
}

export type SetMemoryEnabled = {
    userId: string
    enabled: boolean
}

export type AddMemory = {
    userId: string
    content: string
}

export type UpdateMemory = {
    userId: string
    id: string
    content: string
}

export type MemoryRef = {
    userId: string
    id: string
}

export type StoredMemory = {
    id: string
    content: string
    source: string
    sessionId: string | null
    sessionTitle: string | null
    createdAt: Date
    updatedAt: Date
}
