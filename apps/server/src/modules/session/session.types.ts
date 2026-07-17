export type CreateSession = {
    userId: string
    title?: string
    projectId?: string | null
    type?: 'WEB' | 'CLI' | 'SEARCH'
    prompt?: string
}

export type GetSession = {
    userId: string
    sessionId: string
}

export type UpdateSessionSettings = {
    userId: string
    sessionId: string
    title?: string
    projectId?: string | null
    isPinned?: boolean
    isArchived?: boolean
    tags?: string[]
}

export type DeleteSession = {
    userId: string
    sessionId: string
}

export type DuplicateSession = {
    userId: string
    sessionId: string
    title?: string
}

export type GetCollaborators = {
    userId: string
    sessionId: string
}

export type AddCollaborator = {
    userId: string
    sessionId: string
    email: string
}

export type RemoveCollaborator = {
    userId: string
    sessionId: string
    email: string
}

export type StoredSessionFile = {
    path: string
    key: string
    contentType?: string
    size: number
}

export type SessionFilters = {
    type?: 'WEB' | 'CLI' | 'SEARCH'
    isArchived?: boolean
    isPinned?: boolean
    tags?: string[]
    sortBy?: 'updatedAt' | 'createdAt'
    sortOrder?: 'asc' | 'desc'
}
