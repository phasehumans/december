import type { StoredMemory } from './memory.types'

/** a memory as the web sees it */
export const toPublicMemory = (memory: StoredMemory) => ({
    id: memory.id,
    content: memory.content,
    source: memory.source,
    sessionId: memory.sessionId,
    sessionTitle: memory.sessionTitle,
    createdAt: memory.createdAt,
    updatedAt: memory.updatedAt,
})
