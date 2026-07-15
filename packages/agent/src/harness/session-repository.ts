import type { AgentMessage } from '@december/shared'

export interface SessionRepository {
    saveContext(sessionId: string, messages: AgentMessage[]): Promise<void>
    loadContext(sessionId: string): Promise<AgentMessage[]>
    deleteSession?(sessionId: string): Promise<void>
    renameSession?(oldSessionId: string, newSessionId: string): Promise<void>
}
